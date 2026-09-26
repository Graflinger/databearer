"""Offline tests for the electricity price / renewables / gas correlation article.

Run from pipeline/: PYTHONPATH=. python -m unittest discover -s tests -p test_strompreis_korrelation.py -v
Needs duckdb, numpy, openpyxl, jinja2 and PyYAML; no network access and no dbt run.
The last test class checks the Git-tracked frozen article files against the
Git-tracked SMARD history, so reviewers can reproduce the published numbers.
"""

import csv
import importlib.util
import io
import json
import math
import os
import re
import shutil
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

import duckdb
import numpy as np
from jinja2 import Environment, StrictUndefined
from openpyxl import Workbook

PIPELINE = Path(__file__).resolve().parents[1]
REPOSITORY = PIPELINE.parent
DBT = PIPELINE / "src/data_pipelines/databearer_dbt"
FROZEN = REPOSITORY / "frontend/src/data_ingestion/data/2026/strompreis-korrelation"


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, PIPELINE / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ingest = load("ingest_gas_price_data", "src/data_pipelines/get_raw_data/ingest_gas_price_data.py")
exporter = load("strompreis_export", "src/data_pipelines/export_data/2026/strompreis_korrelation/export.py")
SOURCES = ingest.load_sources(PIPELINE / "src/config/datasource_metadata/gas_price_sources.yaml")


def render(path):
    return Environment(undefined=StrictUndefined).from_string(path.read_text()).render(
        ref=lambda name: name, source=lambda schema, table: f"{schema}.{table}", config=lambda **kwargs: "")


def pink_sheet(rows=None, unit="($/mmbtu)", updated="Updated on September 02, 2026", series="Natural gas, Europe", extra_series=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Monthly Prices"
    sheet.append(["World Bank Commodity Price Data (The Pink Sheet)"])
    sheet.append([updated])
    sheet.append([None, "Crude oil, average", series] + ([series] if extra_series else []))
    sheet.append([None, "($/bbl)", unit])
    for period, value in rows or [("2024M12", 12.5), ("2025M01", "…"), ("2025M02", 14.0)]:
        sheet.append([period, 70.0, value])
    stream = io.BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def ecb_csv(rows=(("2025-01", "1.0353727"), ("2025-02", "1.04125")), key="EXR.M.USD.EUR.SP00.A"):
    lines = ["KEY,FREQ,TIME_PERIOD,OBS_VALUE"] + [f"{key},M,{period},{value}" for period, value in rows]
    return ("\n".join(lines) + "\n").encode()


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def raise_for_status(self):
        pass

    def iter_content(self, size):
        for start in range(0, len(self.data), size):
            yield self.data[start:start + size]


class FakeSession:
    def __init__(self, responses):
        self.responses, self.calls = responses, []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse(self.responses[url])


class SourceParsingTest(unittest.TestCase):
    def test_pink_sheet_series_unit_release_and_missing_markers(self):
        parsed = ingest.parse_pink_sheet(pink_sheet(), "Monthly Prices", "Natural gas, Europe", "($/mmbtu)")
        self.assertEqual(parsed["release_date"], "2026-09-02")
        self.assertEqual(parsed["rows"], [("2024-12", 12.5), ("2025-01", None), ("2025-02", 14.0)])

    def test_pink_sheet_contract_violations_fail(self):
        cases = {
            "unit": pink_sheet(unit="($/mt)"),
            "release": pink_sheet(updated="September 2026"),
            "duplicate series": pink_sheet(extra_series=True),
            "period": pink_sheet(rows=[("2025-01", 1.0)]),
            "duplicate period": pink_sheet(rows=[("2025M01", 1.0), ("2025M01", 2.0)]),
            "descending": pink_sheet(rows=[("2025M02", 1.0), ("2025M01", 2.0)]),
            "negative": pink_sheet(rows=[("2025M01", -1.0)]),
            "text": pink_sheet(rows=[("2025M01", "n/a")]),
        }
        for label, raw in cases.items():
            with self.subTest(label), self.assertRaises(ingest.SourceError):
                ingest.parse_pink_sheet(raw, "Monthly Prices", "Natural gas, Europe", "($/mmbtu)")
        with self.assertRaises(ingest.SourceError):
            ingest.parse_pink_sheet(b"not a workbook", "Monthly Prices", "Natural gas, Europe", "($/mmbtu)")

    def test_ecb_csv(self):
        self.assertEqual(ingest.parse_ecb_csv(ecb_csv(), "EXR.M.USD.EUR.SP00.A"), [("2025-01", 1.0353727), ("2025-02", 1.04125)])
        for label, raw in {
            "series": ecb_csv(key="EXR.M.GBP.EUR.SP00.A"),
            "duplicate": ecb_csv(rows=(("2025-01", "1.1"), ("2025-01", "1.2"))),
            "missing": ecb_csv(rows=(("2025-01", ""),)),
            "period": ecb_csv(rows=(("2025M01", "1.1"),)),
        }.items():
            with self.subTest(label), self.assertRaises(ingest.SourceError):
                ingest.parse_ecb_csv(raw, "EXR.M.USD.EUR.SP00.A")

    def test_download_is_size_capped_and_uses_a_timeout(self):
        session = FakeSession({"https://example.test/a": b"x" * 200_000})
        with self.assertRaises(ingest.SourceError):
            ingest.download("https://example.test/a", 100_000, session)
        self.assertEqual(session.calls[0][1]["timeout"], ingest.TIMEOUT_SECONDS)
        self.assertEqual(ingest.download("https://example.test/a", 300_000, session), b"x" * 200_000)


class IngestAndDbtTest(unittest.TestCase):
    """Ingest into a temporary DuckDB, then execute the real dbt SQL of all three models."""

    def setUp(self):
        self.temporary = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temporary)
        self.database, self.raw = self.temporary / "test.duckdb", self.temporary / "raw"
        months = exporter.months("2018-12", "2026-01")
        self.gas = [(month.replace("-", "M"), 5 + index * 0.1) for index, month in enumerate(months)]
        self.fx = [(month, f"{1.05 + index * 0.001:.6f}") for index, month in enumerate(months[1:-1])]
        self.session = FakeSession({
            SOURCES["world_bank_pink_sheet"]["url"]: pink_sheet(self.gas),
            SOURCES["ecb_usd_eur"]["url"]: ecb_csv(self.fx),
        })

    def run_ingest(self, **kwargs):
        cwd = Path.cwd()
        try:
            os.chdir(PIPELINE)  # the metadata path is pipeline-relative, as in production
            return ingest.ingest(self.database, self.raw, session=self.session, **kwargs)
        finally:
            os.chdir(cwd)

    def build_models(self, db):
        db.execute("CREATE SCHEMA prod_cleaned; CREATE SCHEMA prod_curated")
        for name in ("world_bank_gas_europe_monthly", "ecb_usd_eur_monthly", "fact_gas_price_europe_monthly"):
            db.execute(f"CREATE TABLE {name} AS {render(next((DBT / 'models').rglob(name + '.sql')))}")
        db.execute("CREATE TABLE prod_curated.fact_gas_price_europe_monthly AS SELECT * FROM fact_gas_price_europe_monthly")

    def test_ingest_stores_raw_and_staging_then_models_convert_units(self):
        result = self.run_ingest()
        self.assertEqual(result, {"gas_rows": len(self.gas), "fx_rows": 84, "release_date": "2026-09-02"})
        for name in (ingest.PINK_SHEET_FILE, ingest.ECB_FILE):
            sidecar = json.loads((self.raw / f"{name}.json").read_text())
            self.assertEqual(sidecar["sha256"], ingest.sha256((self.raw / name).read_bytes()))
        with duckdb.connect(str(self.database)) as db:
            self.build_models(db)
            self.assertEqual(db.sql(render(DBT / "tests/gas_price_monthly_contract.sql")).fetchall(), [])
            usd, fx, eur = db.execute("SELECT gas_usd_per_mmbtu, usd_per_eur, gas_eur_per_mwh FROM fact_gas_price_europe_monthly WHERE month = DATE '2019-01-01'").fetchone()
            # 1 MMBtu = 1,055,055,852.62 J; 1 MWh = 3.6e9 J.
            self.assertAlmostEqual(eur, usd / fx * 3.6e9 / 1_055_055_852.62, places=9)
            # Only months with both inputs survive the join (Pink Sheet covers more months).
            self.assertEqual(db.execute("SELECT count(*) FROM fact_gas_price_europe_monthly").fetchone()[0], 84)
            db.execute("DELETE FROM fact_gas_price_europe_monthly WHERE month = DATE '2022-06-01'")
            self.assertEqual(db.sql(render(DBT / "tests/gas_price_monthly_contract.sql")).fetchall(), [("missing_month", date(2022, 6, 1))])

    def test_malformed_download_never_replaces_raw_files_and_from_raw_is_offline(self):
        self.run_ingest()
        original = (self.raw / ingest.PINK_SHEET_FILE).read_bytes()
        self.session.responses[SOURCES["world_bank_pink_sheet"]["url"]] = pink_sheet(unit="($/mt)")
        with self.assertRaises(ingest.SourceError):
            self.run_ingest()
        self.assertEqual((self.raw / ingest.PINK_SHEET_FILE).read_bytes(), original)
        self.session.responses.clear()  # any network use would now raise KeyError
        self.assertEqual(self.run_ingest(from_raw=True)["fx_rows"], 84)
        (self.raw / ingest.ECB_FILE).write_bytes(b"tampered")
        with self.assertRaises(ingest.SourceError):
            self.run_ingest(from_raw=True)


def day_row(day, hours=24, price=50.0, solar=10.0, gas=5.0, pumped=1.0, **overrides):
    energy = {key: 0.0 for key in exporter.ENERGY_KEYS}
    energy.update({"solar": solar, "gas": gas, "pumped_storage": pumped, "load": 1200.0})
    energy.update(overrides)
    return {"date": day, "hours": hours, "price_eur_mwh": price, "price_zone": "DE-LU", "energy_gwh": energy, "nuclear_derived_zero": True}


def month_rows(year, month, **kwargs):
    first = date(year, month, 1)
    following = date(year + (month == 12), month % 12 + 1, 1)
    return [day_row((first + timedelta(days=offset)).isoformat(), **kwargs) for offset in range((following - first).days)]


class ElectricityAggregationTest(unittest.TestCase):
    def test_price_is_hour_weighted_and_share_is_energy_weighted(self):
        rows = month_rows(2024, 3)
        rows[30] = day_row("2024-03-31", hours=23, price=200.0, solar=100.0, gas=0.0, pumped=0.0)
        result = exporter.monthly_electricity(rows)["2024-03"]
        self.assertEqual(result["hours"], 30 * 24 + 23)
        self.assertAlmostEqual(result["price"], (30 * 24 * 50 + 23 * 200) / (30 * 24 + 23))
        # Pumped-storage discharge is generation but not renewable.
        self.assertAlmostEqual(result["renewable_share"], (30 * 10 + 100) / (30 * 16 + 100) * 100)
        self.assertAlmostEqual(result["load_gw"], 31 * 1200 / (30 * 24 + 23))

    def test_unknown_values_and_incomplete_months_fail_instead_of_being_skipped(self):
        for label, change in {
            "price": lambda rows: rows[3].update(price_eur_mwh=None),
            "energy": lambda rows: rows[3]["energy_gwh"].update(solar=None),
            "negative": lambda rows: rows[3]["energy_gwh"].update(wind_onshore=-1.0),
            "zone": lambda rows: rows[3].update(price_zone="DE-AT-LU"),
            "keys": lambda rows: rows[3]["energy_gwh"].pop("nuclear"),
            "day missing": lambda rows: rows.pop(3),
        }.items():
            rows = month_rows(2024, 2)
            change(rows)
            with self.subTest(label), self.assertRaises(exporter.ValidationError):
                exporter.monthly_electricity(rows)


class StatisticsTest(unittest.TestCase):
    def test_pearson_spearman_and_ties(self):
        self.assertAlmostEqual(exporter.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertAlmostEqual(exporter.pearson([1, 2, 3], [3, 2, 1]), -1.0)
        self.assertEqual(exporter.ranks([10, 20, 20, 5]).tolist(), [2.0, 3.5, 3.5, 1.0])
        # Monotone but non-linear: Spearman 1, Pearson below 1.
        x = [1, 2, 3, 4, 5]
        y = [1, 8, 27, 64, 1000]
        self.assertAlmostEqual(exporter.spearman(x, y), 1.0)
        self.assertLess(exporter.pearson(x, y), 0.9)
        with self.assertRaises(exporter.ValidationError):
            exporter.pearson([1, 1, 1], [1, 2, 3])

    def test_partial_correlation_equals_residual_correlation(self):
        generator = np.random.default_rng(7)
        z = generator.normal(size=200)
        x = z + generator.normal(size=200)
        y = 2 * z - x + generator.normal(size=200)
        residual = lambda v: v - np.polyval(np.polyfit(z, v, 1), z)  # noqa: E731
        expected = exporter.pearson(residual(x), residual(y))
        actual = exporter.partial(exporter.pearson(x, y), exporter.pearson(x, z), exporter.pearson(y, z))
        self.assertAlmostEqual(actual, expected, places=10)

    def test_ols_coefficients_and_newey_west_standard_errors(self):
        generator = np.random.default_rng(3)
        x1, x2 = generator.normal(size=60), generator.normal(size=60)
        y = 1.5 + 2.0 * x1 - 0.5 * x2 + generator.normal(scale=0.3, size=60)
        fit = exporter.ols_hac(y, [x1, x2], lag=0)
        X = np.column_stack([np.ones(60), x1, x2])
        beta = np.linalg.lstsq(X, y, rcond=None)[0]
        np.testing.assert_allclose(fit["coefficients"], beta, rtol=1e-10)
        # Lag 0 is White's HC0 estimator.
        bread = np.linalg.inv(X.T @ X)
        residuals = y - X @ beta
        hc0 = bread @ (X.T * residuals ** 2) @ X @ bread
        np.testing.assert_allclose(fit["standard_errors"], np.sqrt(np.diag(hc0)), rtol=1e-10)
        # Positive autocorrelation in the scores widens lag-3 intervals here.
        self.assertEqual(exporter.ols_hac(y, [x1, x2])["n"], 60)
        with self.assertRaises(exporter.ValidationError):
            exporter.ols_hac(y, [x1, 2 * x1])


class ExportTest(unittest.TestCase):
    """End-to-end export from synthetic history partitions and a synthetic gas fact."""

    def setUp(self):
        self.temporary = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temporary)
        self.history = self.temporary / "history"
        self.history.mkdir()
        generator = np.random.default_rng(11)
        entries = []
        for year in exporter.YEARS:
            rows = []
            for month in range(1, 13):
                gas_price = 20 + 10 * year % 7 + month
                for row in month_rows(year, month, price=float(round(30 + 1.5 * gas_price + generator.normal(), 2)),
                                      solar=float(round(10 + 5 * math.sin(month) + generator.normal(), 3)),
                                      wind_onshore=float(round(20 + generator.normal(), 3)), load=float(round(1200 + 50 * generator.normal(), 3))):
                    rows.append(row)
            payload = json.dumps({"schema_version": 1, "year": year, "timezone": "Europe/Berlin", "source": exporter.EXPECTED_SOURCE, "rows": rows}, sort_keys=True, separators=(",", ":")).encode()
            digest = exporter.sha256(payload)
            (self.history / f"{year}.{digest}.json").write_bytes(payload)
            entries.append({"year": year, "url": f"/data/history/german-electricity/{year}.{digest}.json", "sha256": digest,
                            "first_date": f"{year}-01-01", "last_date": f"{year}-12-31", "days": len(rows), "frozen": True})
        self.manifest = {"schema_version": 1, "kind": "german-electricity-history", "timezone": "Europe/Berlin", "source": exporter.EXPECTED_SOURCE, "years": entries}
        (self.history / "manifest.json").write_text(json.dumps(self.manifest))
        self.db = duckdb.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("CREATE SCHEMA staging; CREATE SCHEMA prod_curated")
        self.db.execute("CREATE TABLE staging.world_bank_gas_europe_monthly AS SELECT 'Natural gas, Europe' AS series, '($/mmbtu)' AS unit, 'https://wb.test' AS source_url, '2026-09-25T22:11:04Z' AS retrieved_at")
        self.db.execute("CREATE TABLE staging.ecb_usd_eur_monthly AS SELECT 'EXR.M.USD.EUR.SP00.A' AS series_key, 'https://ecb.test' AS source_url, '2026-09-25T22:11:05Z' AS retrieved_at")
        self.db.execute("CREATE TABLE prod_curated.fact_gas_price_europe_monthly (month DATE, gas_usd_per_mmbtu DOUBLE, usd_per_eur DOUBLE, gas_eur_per_mwh DOUBLE, gas_release_date DATE, gas_source_sha256 VARCHAR, fx_source_sha256 VARCHAR)")
        for index, month in enumerate(exporter.months("2018-12", "2026-01")):
            year, number = map(int, month.split("-"))
            usd, fx = (20 + 10 * year % 7 + number) * exporter.MWH_PER_MMBTU * 1.1, 1.1
            self.db.execute("INSERT INTO prod_curated.fact_gas_price_europe_monthly VALUES (?, ?, ?, ?, DATE '2026-09-02', ?, ?)",
                            [f"{month}-01", usd, fx, usd / fx / exporter.MWH_PER_MMBTU, "a" * 64, "b" * 64])

    def test_complete_set_is_reproducible_from_the_published_monthly_csv(self):
        files = exporter.build_payloads(self.db, self.history)
        output = self.temporary / "out"
        exporter.promote(files, output)
        metadata = exporter.verify_set(output)
        self.assertEqual(metadata["period"]["months"], 84)
        self.assertEqual([partition["year"] for partition in metadata["sources"]["electricity"]["partitions"]], exporter.YEARS)
        self.assertEqual(metadata["sources"]["gas"]["release_date"], "2026-09-02")
        monthly = list(csv.DictReader(io.StringIO(files[exporter.MONTHLY].decode())))
        self.assertEqual([row["Monat"] for row in monthly], exporter.months("2019-01", "2025-12"))
        self.assertEqual({row["Zeitraum"] for row in monthly[:24]}, {"2019–2020"})
        correlations = list(csv.DictReader(io.StringIO(files[exporter.CORRELATIONS].decode())))
        price = [float(row["Strompreis_EUR_MWh"]) for row in monthly]
        gas = [float(row["Gaspreis_EUR_MWh"]) for row in monthly]
        self.assertEqual(correlations[0]["Pearson_Gas"], f"{exporter.pearson(price, gas):.4f}")
        self.assertEqual([row["Zeitraum"] for row in correlations], [label for _, label, _, _ in exporter.PERIODS])
        self.assertEqual([row["Veraenderungen"] for row in correlations], ["83", "23", "23", "35"])
        regression = list(csv.DictReader(io.StringIO(files[exporter.REGRESSION].decode())))
        self.assertEqual(len(regression), 5)
        self.assertAlmostEqual(float(regression[0]["Gas_Koeffizient"]), 1.5, delta=0.05)
        # Byte-identical when rerun.
        self.assertEqual(exporter.build_payloads(self.db, self.history), files)

    def test_history_integrity_failures(self):
        partition = next(self.history.glob("2021.*.json"))
        original = partition.read_bytes()
        partition.write_bytes(original.replace(b'"price_eur_mwh":', b'"price_eur_mwh": ', 1))
        with self.assertRaisesRegex(exporter.ValidationError, "SHA-256"):
            exporter.read_history(self.history)
        partition.write_bytes(original)
        self.manifest["years"][2]["frozen"] = False
        (self.history / "manifest.json").write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(exporter.ValidationError, "frozen"):
            exporter.read_history(self.history)

    def test_gas_gaps_and_mixed_vintages_fail(self):
        self.db.execute("UPDATE prod_curated.fact_gas_price_europe_monthly SET gas_release_date = DATE '2026-08-04' WHERE month = DATE '2020-05-01'")
        with self.assertRaisesRegex(exporter.ValidationError, "vintages"):
            exporter.read_gas(self.db)
        self.db.execute("DELETE FROM prod_curated.fact_gas_price_europe_monthly WHERE month = DATE '2020-05-01'")
        with self.assertRaisesRegex(exporter.ValidationError, "every month"):
            exporter.read_gas(self.db)

    def test_tampered_output_is_rejected_and_promotion_keeps_the_previous_set(self):
        files = exporter.build_payloads(self.db, self.history)
        output = self.temporary / "out"
        exporter.promote(files, output)
        (output / exporter.CORRELATIONS).write_bytes(files[exporter.CORRELATIONS].replace(b"2019", b"2018", 1))
        with self.assertRaisesRegex(exporter.ValidationError, "hash"):
            exporter.verify_set(output)
        broken = dict(files)
        broken[exporter.MONTHLY] = b"Monat\n"
        with self.assertRaises(exporter.ValidationError):
            exporter.promote(broken, output)
        self.assertEqual((output / exporter.MONTHLY).read_bytes(), files[exporter.MONTHLY])


@unittest.skipUnless((FROZEN / exporter.MANIFEST).exists(), "frozen article files not present")
class FrozenArticleTest(unittest.TestCase):
    """The committed article evidence is consistent with committed inputs and methods."""

    @classmethod
    def setUpClass(cls):
        cls.metadata = exporter.verify_set(FROZEN)
        read = lambda name: list(csv.DictReader(io.StringIO((FROZEN / name).read_text(encoding="utf-8"))))  # noqa: E731
        cls.monthly, cls.correlations, cls.regression = read(exporter.MONTHLY), read(exporter.CORRELATIONS), read(exporter.REGRESSION)

    def test_electricity_columns_match_the_tracked_smard_history(self):
        rows, partitions = exporter.read_history()
        self.assertEqual(partitions, self.metadata["sources"]["electricity"]["partitions"])
        electricity = exporter.monthly_electricity(rows)
        for row in self.monthly:
            month = electricity[row["Monat"]]
            self.assertEqual(row["Strompreis_EUR_MWh"], f"{month['price']:.2f}")
            self.assertEqual(row["Erneuerbarenanteil_Prozent"], f"{month['renewable_share']:.2f}")
            self.assertEqual(row["Last_GW"], f"{month['load_gw']:.3f}")
            self.assertEqual(int(row["Stunden"]), month["hours"])

    def test_gas_conversion_and_statistics_reproduce_from_the_monthly_csv(self):
        monthly = []
        for row in self.monthly:
            self.assertEqual(row["Zeitraum"], exporter.period_of(row["Monat"]))
            usd, fx, eur = float(row["Gaspreis_USD_MMBtu"]), float(row["USD_je_EUR"]), float(row["Gaspreis_EUR_MWh"])
            # Published EUR values come from unrounded USD inputs: allow the USD rounding.
            self.assertLess(abs(usd / fx / exporter.MWH_PER_MMBTU - eur), 0.005 / fx / exporter.MWH_PER_MMBTU + 0.005)
            monthly.append({name: (row[name] if name in ("Monat", "Zeitraum") else float(row[name])) for name in exporter.MONTHLY_COLUMNS})
        expected = exporter.csv_bytes(exporter.CORRELATION_COLUMNS, exporter.correlation_rows(monthly))
        self.assertEqual((FROZEN / exporter.CORRELATIONS).read_bytes(), expected)
        expected = exporter.csv_bytes(exporter.REGRESSION_COLUMNS, exporter.regression_rows(monthly))
        self.assertEqual((FROZEN / exporter.REGRESSION).read_bytes(), expected)

    def test_frozen_exporter_version_matches_this_code(self):
        self.assertEqual(self.metadata["exporter_sha256"], exporter.sha256(Path(exporter.__file__).read_bytes()))
        self.assertEqual(self.metadata["period"], {"first_month": "2019-01", "last_month": "2025-12", "months": 84,
                                                   "sub_periods": [{"label": label, "first_month": first, "last_month": last} for _, label, first, last in exporter.SUB_PERIODS]})
        self.assertTrue(re.fullmatch(r"[a-f0-9]{64}", self.metadata["sources"]["gas"]["sha256"]))


if __name__ == "__main__":
    unittest.main()
