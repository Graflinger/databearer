"""Offline tests for the 2026 PV learning-curve article (Germany's role in global solar).

Run from pipeline/: PYTHONPATH=. python -m unittest discover -s tests -p test_pv_lernkurve.py -v
Needs duckdb, numpy, jinja2 and PyYAML; no network access and no dbt run.
The last test class checks the Git-tracked frozen article files, so reviewers can
reproduce every published number from the CSVs alone.
"""

import csv
import importlib.util
import io
import json
import math
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import duckdb
import numpy as np
from jinja2 import Environment, StrictUndefined

PIPELINE = Path(__file__).resolve().parents[1]
REPOSITORY = PIPELINE.parent
DBT = PIPELINE / "src/data_pipelines/databearer_dbt"
FROZEN = REPOSITORY / "frontend/src/data_ingestion/data/2026/pv-lernkurve"
MODELS = ("owid_pv_kapazitaet", "owid_pv_modulpreis", "owid_co2_anteil", "owid_solar_stromanteil", "fact_solar_pv_world_yearly")


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, PIPELINE / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ingest = load("ingest_pv_lernkurve_data", "src/data_pipelines/get_raw_data/ingest_pv_lernkurve_data.py")
exporter = load("pv_lernkurve_export", "src/data_pipelines/export_data/2026/pv_lernkurve/export.py")
SOURCES = ingest.load_sources(PIPELINE / "src/config/datasource_metadata/pv_lernkurve_sources.yaml")


def render(path):
    return Environment(undefined=StrictUndefined).from_string(path.read_text()).render(
        ref=lambda name: name, source=lambda schema, table: f"{schema}.{table}", config=lambda **kwargs: "")


def parquet(columns, rows, extra_column=True):
    """Serialise rows to Parquet bytes, with one unrelated column like the real catalog tables."""
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "table.parquet"
        with duckdb.connect() as db:
            types = ["VARCHAR", "USMALLINT"] + ["FLOAT"] * (len(columns) - 2)
            names = columns + (["unrelated"] if extra_column else [])
            definition = ", ".join(f'"{name}" {kind}' for name, kind in zip(names, types + ["FLOAT"]))
            db.execute(f"CREATE TABLE t ({definition})")
            db.executemany(f"INSERT INTO t VALUES ({', '.join('?' for _ in names)})", [tuple(row) + ((1.0,) if extra_column else ()) for row in rows])
            db.execute(f"COPY t TO '{path}' (FORMAT PARQUET)")
        return path.read_bytes()


def synthetic_sources(germany_2010=7.0):
    """Plausible synthetic inputs: 1975..2025 prices, 2000..2025 capacity for World/Germany/China."""
    capacity, cost, co2, solar = [], [], [], []
    for year in range(2000, 2026):
        world = 1.0 * 1.4 ** (year - 2000)
        germany = germany_2010 if year == 2010 else 0.3 * world if year < 2013 else 0.05 * world
        capacity += [("World", year, world, 0.1), ("Germany", year, germany, None), ("China", year, 0.2 * world, 0.01)]
        co2 += [("Germany", year, 3 - 0.06 * (year - 2000)), ("World", year, 100.0)]
        solar += [("World", year, 0.01 * (year - 1999)), ("Germany", year, 0.5 * (year - 1999))]
    for year in range(1975, 2026):
        cost.append(("World", year, 100 * 0.9 ** (year - 1975), 0.5 * 1.35 ** (year - 1975)))
    return {
        "irena_capacity": parquet(SOURCES["irena_capacity"]["columns"], capacity),
        "pv_module_cost": parquet(SOURCES["pv_module_cost"]["columns"], cost),
        "co2_share": parquet(SOURCES["co2_share"]["columns"], co2),
        "solar_electricity_share": parquet(SOURCES["solar_electricity_share"]["columns"], solar),
    }


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

    def get(self, url, timeout, stream):
        self.calls.append((url, timeout, stream))
        return FakeResponse(self.responses[url])


class SourceParsingTest(unittest.TestCase):
    def test_documented_columns_are_selected_and_contract_violations_fail(self):
        columns = SOURCES["pv_module_cost"]["columns"]
        rows = ingest.read_columns(parquet(columns, [("World", 1976, 2.0, 3.0), ("World", 1975, 1.0, 2.0)]), columns)
        self.assertEqual(rows, [("World", 1975, 1.0, 2.0), ("World", 1976, 2.0, 3.0)])
        with self.assertRaisesRegex(ingest.SourceError, "lacks columns"):
            ingest.read_columns(parquet(columns[:3], [("World", 1975, 1.0)]), columns)
        with self.assertRaisesRegex(ingest.SourceError, "Duplicate"):
            ingest.read_columns(parquet(columns, [("World", 1975, 1.0, 2.0), ("World", 1975, 1.0, 2.0)]), columns)
        with self.assertRaisesRegex(ingest.SourceError, "Parquet"):
            ingest.read_columns(b"not parquet", columns)

    def test_download_is_size_capped_and_uses_a_timeout(self):
        session = FakeSession({"https://owid.test/a": b"x" * 100})
        self.assertEqual(ingest.download("https://owid.test/a", 100, session), b"x" * 100)
        self.assertEqual(session.calls[0][1:], (ingest.TIMEOUT_SECONDS, True))
        with self.assertRaisesRegex(ingest.SourceError, "exceeds"):
            ingest.download("https://owid.test/a", 99, session)

    def test_every_source_is_a_pinned_catalog_version(self):
        for source in SOURCES.values():
            self.assertRegex(source["url"], r"^https://catalog\.ourworldindata\.org/grapher/[a-z]+/\d{4}-\d{2}-\d{2}/[a-z_]+/[a-z_]+\.parquet$")


class IngestAndDbtTest(unittest.TestCase):
    """Ingest into a temporary DuckDB, then execute the real dbt SQL of all models and the contract test."""

    def setUp(self):
        self.temporary = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temporary)
        self.database, self.raw = self.temporary / "test.duckdb", self.temporary / "raw"
        self.files = synthetic_sources()
        self.session = FakeSession({SOURCES[key]["url"]: data for key, data in self.files.items()})

    def run_ingest(self, **kwargs):
        cwd = Path.cwd()
        try:
            os.chdir(PIPELINE)  # the metadata path is pipeline-relative, as in production
            return ingest.ingest(self.database, self.raw, session=self.session, **kwargs)
        finally:
            os.chdir(cwd)

    def build_models(self, db):
        db.execute("CREATE SCHEMA prod_curated")
        for name in MODELS:
            db.execute(f"CREATE TABLE {name} AS {render(next((DBT / 'models').rglob(name + '.sql')))}")
        db.execute("CREATE TABLE prod_curated.fact_solar_pv_world_yearly AS SELECT * FROM fact_solar_pv_world_yearly")

    def test_ingest_stores_raw_and_staging_then_models_build_the_fact(self):
        result = self.run_ingest()
        self.assertEqual(result["owid_pv_module_cost_capacity"], 51)
        self.assertEqual(result["owid_irena_solar_pv_capacity"], 78)
        for key in SOURCES:
            sidecar = json.loads((self.raw / f"{key}.parquet.json").read_text())
            self.assertEqual(sidecar["sha256"], ingest.sha256((self.raw / f"{key}.parquet").read_bytes()))
        with duckdb.connect(str(self.database)) as db:
            self.build_models(db)
            self.assertEqual(db.sql(render(DBT / "tests/pv_lernkurve_contract.sql")).fetchall(), [])
            welt, deutschland, zubau, anteil, kumuliert = db.execute(
                "SELECT welt_gw, deutschland_gw, zubau_welt_gw, anteil_bestand_deutschland_prozent, kumulierte_leistung_welt_gw "
                "FROM fact_solar_pv_world_yearly WHERE jahr = 2001").fetchone()
            # Off-grid PV counts towards the world; Germany's missing off-grid value counts as zero.
            self.assertAlmostEqual(welt, 1.4 + 0.1, places=5)
            self.assertAlmostEqual(deutschland, 0.3 * 1.4, places=5)
            self.assertAlmostEqual(zubau, 0.4, places=5)
            self.assertAlmostEqual(anteil, 100 * 0.42 / 1.5, places=4)
            self.assertAlmostEqual(kumuliert, 0.5 * 1.35 ** 26 / 1000, places=5)
            db.execute("DELETE FROM fact_solar_pv_world_yearly WHERE jahr = 1990")
            self.assertEqual(db.sql(render(DBT / "tests/pv_lernkurve_contract.sql")).fetchall(), [("missing_year", 1990)])

    def test_malformed_download_never_replaces_raw_files_and_from_raw_is_offline(self):
        self.run_ingest()
        original = (self.raw / "irena_capacity.parquet").read_bytes()
        self.session.responses[SOURCES["irena_capacity"]["url"]] = parquet(["country", "year"], [("World", 2000)])
        with self.assertRaises(ingest.SourceError):
            self.run_ingest()
        self.assertEqual((self.raw / "irena_capacity.parquet").read_bytes(), original)
        self.session.responses.clear()  # any network use would now raise KeyError
        self.assertEqual(self.run_ingest(from_raw=True)["owid_pv_module_cost_capacity"], 51)
        (self.raw / "co2_share.parquet").write_bytes(b"tampered")
        with self.assertRaises(ingest.SourceError):
            self.run_ingest(from_raw=True)


class ExportTest(unittest.TestCase):
    """End-to-end export from the synthetic sources through dbt SQL into a frozen set."""

    def setUp(self):
        self.temporary = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temporary)
        self.db = duckdb.connect(":memory:")
        self.addCleanup(self.db.close)
        provenance = {"url": "https://owid.test", "sha256": "a" * 64, "retrieved_at": "2026-11-16T20:19:00Z"}
        for key, data in synthetic_sources().items():
            ingest.load_staging(self.db, key, SOURCES[key]["columns"], ingest.read_columns(data, SOURCES[key]["columns"]), provenance)
        IngestAndDbtTest.build_models(self, self.db)

    def test_complete_set_is_reproducible_and_derived_from_rounded_values(self):
        files = exporter.build_payloads(self.db)
        output = self.temporary / "out"
        exporter.promote(files, output)
        metadata = exporter.verify_set(output)
        self.assertEqual(metadata["sources"]["capacity"]["sha256"], "a" * 64)
        read = lambda name: list(csv.DictReader(io.StringIO((output / name).read_text(encoding="utf-8"))))  # noqa: E731
        jahre, zubau = read(exporter.JAHRE), read(exporter.ZUBAU)
        self.assertEqual([row["Jahr"] for row in jahre], [str(year) for year in range(2000, 2026)])
        self.assertEqual([row["Jahr"] for row in zubau], [str(year) for year in range(2001, 2026)])
        self.assertEqual(len(read(exporter.LERNKURVE)), 51)
        self.assertEqual(len(read(exporter.MODULPREIS)), 26)
        # Price falls 10 % per year while capacity grows 35 %: the learning rate is exact.
        rate = 100 * (1 - 0.9 ** (1 / math.log2(1.35)))
        kennzahlen = {(row["Kennzahl"], row["Zeitraum"]): float(row["Wert"]) for row in read(exporter.KENNZAHLEN)}
        self.assertAlmostEqual(kennzahlen[("Lernrate", "1975–2025")], rate, delta=0.01)

    def test_implausible_inputs_fail(self):
        self.db.execute("UPDATE prod_curated.fact_solar_pv_world_yearly SET deutschland_gw = welt_gw WHERE jahr = 2005")
        with self.assertRaisesRegex(exporter.ValidationError, "exceed"):
            exporter.build_payloads(self.db)
        self.db.execute("DELETE FROM prod_curated.fact_solar_pv_world_yearly WHERE jahr = 1980")
        with self.assertRaisesRegex(exporter.ValidationError, "without gaps"):
            exporter.build_payloads(self.db)

    def test_mixed_source_vintages_fail(self):
        self.db.execute("UPDATE staging.owid_gcp_co2_share SET source_sha256 = 'b' WHERE year = 2000")
        with self.assertRaisesRegex(exporter.ValidationError, "vintages"):
            exporter.build_payloads(self.db)

    def test_tampered_output_is_rejected_and_promotion_keeps_the_previous_set(self):
        files = exporter.build_payloads(self.db)
        output = self.temporary / "out"
        exporter.promote(files, output)
        (output / exporter.ZUBAU).write_bytes(files[exporter.ZUBAU].replace(b"2001", b"2000", 1))
        with self.assertRaisesRegex(exporter.ValidationError, "hash"):
            exporter.verify_set(output)
        broken = dict(files)
        broken[exporter.JAHRE] = b"Jahr\n"
        with self.assertRaises(exporter.ValidationError):
            exporter.promote(broken, output)
        self.assertEqual((output / exporter.JAHRE).read_bytes(), files[exporter.JAHRE])


@unittest.skipUnless((FROZEN / exporter.MANIFEST).exists(), "frozen article files not present")
class FrozenArticleTest(unittest.TestCase):
    """The committed article evidence is internally consistent and reproducible from its CSVs."""

    @classmethod
    def setUpClass(cls):
        cls.metadata = exporter.verify_set(FROZEN)
        cls.read = staticmethod(lambda name: list(csv.DictReader(io.StringIO((FROZEN / name).read_text(encoding="utf-8")))))

    def parsed(self, name):
        return [{key: (value if key in ("Jahr", "Kennzahl", "Zeitraum", "Einheit") else float(value)) for key, value in row.items()}
                for row in self.read(name)]

    def test_derived_tables_reproduce_from_the_published_csvs(self):
        jahre, lernkurve = self.parsed(exporter.JAHRE), self.parsed(exporter.LERNKURVE)
        for name, rows in ((exporter.ZUBAU, exporter.zubau_rows(jahre)),
                           (exporter.KENNZAHLEN, exporter.kennzahlen_rows(jahre, exporter.zubau_rows(jahre), lernkurve))):
            self.assertEqual((FROZEN / name).read_bytes(), exporter.csv_bytes(exporter.CONTRACTS[name], rows))
        chart = [row for row in self.read(exporter.LERNKURVE) if int(row["Jahr"]) >= exporter.CHART_PRICE_FIRST]
        self.assertEqual(self.read(exporter.MODULPREIS), [{"Jahr": row["Jahr"], "Modulpreis_USD_W": row["Modulpreis_USD_W"]} for row in chart])
        for row in jahre:
            self.assertAlmostEqual(row["Anteil_Bestand_Deutschland_Prozent"], 100 * row["Deutschland_GW"] / row["Welt_GW"], delta=0.0051)

    def test_learning_rate_is_a_plain_log_log_fit(self):
        rows = self.parsed(exporter.LERNKURVE)
        slope = np.polyfit(np.log2([row["Kumulierte_Leistung_Welt_MW"] for row in rows]), np.log2([row["Modulpreis_USD_W"] for row in rows]), 1)[0]
        kennzahl = next(row for row in self.parsed(exporter.KENNZAHLEN) if row["Kennzahl"] == "Lernrate" and row["Zeitraum"] == "1975–2025")
        self.assertAlmostEqual(kennzahl["Wert"], 100 * (1 - 2 ** slope), delta=0.005)

    def test_frozen_exporter_version_matches_this_code(self):
        self.assertEqual(self.metadata["exporter_sha256"], exporter.sha256(Path(exporter.__file__).read_bytes()))
        self.assertEqual(set(self.metadata["sources"]), set(exporter.STAGING))
        for key, source in self.metadata["sources"].items():
            self.assertEqual(source["url"], SOURCES[{"capacity": "irena_capacity", "module_cost": "pv_module_cost",
                                                      "co2_share": "co2_share", "solar_share": "solar_electricity_share"}[key]]["url"])
            self.assertRegex(source["sha256"], r"^[a-f0-9]{64}$")


if __name__ == "__main__":
    unittest.main()
