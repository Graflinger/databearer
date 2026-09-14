"""Offline export contracts, using real model SQL over a small synthetic database."""

import csv
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import duckdb

import test_battery_storage_models as model_fixtures


MODULE = Path(__file__).resolve().parents[1] / "src/data_pipelines/export_data/2026/batteries_germany/export.py"
SPEC = importlib.util.spec_from_file_location("battery_export", MODULE)
exporter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(exporter)


class BatteryExportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.shared = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.shared.cleanup)
        cls.template = Path(cls.shared.name) / "fixture.duckdb"
        fixture = model_fixtures.BatteryModelsTest()
        fixture.setUp()
        try:
            fixture.variables["battery_snapshot_date"] = "2026-06-30"
            fixture.db.execute("UPDATE staging.mastr_snapshot SET snapshot_date='2026-06-30', source_url='https://download.marktstammdatenregister.de/Gesamtdatenexport_20260630_26.1.zip', filename='Gesamtdatenexport_20260630_26.1_battery_subset.zip'")
            n = 0
            for year in range(2019, 2027):
                for power, energy in [("10", "20"), ("100", "150"), ("1000", "2000")]:
                    n += 1
                    fixture.add(n, power, energy, [f"{year}-01-15"])
            fixture.add(90, "10", "999", ["2024-01-15"])  # selected but implausible duration
            fixture.add(91, "1000000", "2000000", ["2024-01-15"], Technologie="525")
            fixture.add(92, "10", "20", [None], EinheitBetriebsstatus="31")
            fixture.build()
            fixture.db.execute(f"ATTACH '{cls.template}' AS fixture")
            for schema in ("staging", "prod_cleaned", "prod_curated"):
                fixture.db.execute(f"CREATE SCHEMA fixture.{schema}")
            tables = fixture.db.execute("SELECT table_schema,table_name FROM information_schema.tables WHERE table_catalog = current_database()").fetchall()
            for schema, name in tables:
                if name in exporter.EPHEMERAL_MODELS:
                    continue  # Real dbt databases do not materialize ephemeral models.
                target = "staging" if schema == "staging" else exporter.relation(name).split(".")[0]
                fixture.db.execute(f"CREATE TABLE fixture.{target}.{name} AS SELECT * FROM {schema}.{name}")
        finally:
            fixture.doCleanups()

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.database = self.root / "battery.duckdb"
        shutil.copyfile(self.template, self.database)
        self.output = self.root / "output"
        self.electricity = self.root / "electricity.json"
        start_ms = 1786399200000
        data = {
            "schema_version": 1, "timezone": "Europe/Berlin", "units": {"power": "GW", "price": "EUR/MWh"},
            "window_start": exporter.START, "window_end": exporter.END, "data_through": exporter.END,
            "snapshot_created_at": "2026-09-10T00:00:00Z",
            "source": {"name": "Bundesnetzagentur | SMARD.de", "url": "https://www.smard.de/home/marktdaten", "license": "CC BY 4.0"},
            "columns": ["timestamp", "solar", "price"],
            "rows": [[start_ms + n * 3600000, n % 24, n // 24 - 20 + n % 24] for n in range(720)],
        }
        self.write_electricity(data)

    def write_electricity(self, data):
        semantic = {k: v for k, v in data.items() if k not in ("content_hash", "snapshot_created_at")}
        data["content_hash"] = exporter.sha256(exporter.canonical(semantic))
        self.electricity.write_bytes(exporter.canonical(data))

    def run_export(self):
        return exporter.export(self.database, self.output, self.electricity)

    def mutate(self, sql):
        with duckdb.connect(str(self.database)) as db:
            db.execute(sql)

    def output_bytes(self):
        return {path.name: path.read_bytes() for path in self.output.iterdir()}

    def test_deterministic_read_only_complete_set_and_contracts(self):
        before = self.database.read_bytes()
        metadata = self.run_export()
        first = self.output_bytes()
        self.run_export()
        self.assertEqual(first, self.output_bytes())
        self.assertEqual(before, self.database.read_bytes())
        self.assertFalse(self.database.with_suffix(".duckdb.wal").exists())
        self.assertEqual(metadata, exporter.verify_set(self.output))
        self.assertEqual(set(metadata["validation"]["singular_tests_sha256"]), {path.name for path in (exporter.DBT / "tests").glob("battery_*.sql")})
        self.assertTrue(metadata["validation"]["jinja_execute"])
        self.assertEqual(metadata["validation"]["ephemeral_checks"], ["mastr_battery_freshness"])
        self.assertEqual(metadata["mastr"]["snapshot_date"], "2026-06-30")
        self.assertEqual(metadata["mastr"]["archive_sha256"], "a" * 64)
        self.assertEqual(metadata["electricity_profile"]["input_sha256"], exporter.sha256(self.electricity.read_bytes()))
        for name, columns in exporter.CHART_CONTRACTS.items():
            with self.subTest(name=name):
                rows = list(csv.reader(first[name].decode().splitlines()))
                self.assertEqual(rows[0], columns)
                if name.endswith("daily_profile.csv"):
                    self.assertEqual([row[0] for row in rows[1:]], [f"{hour:02d}:00" for hour in range(24)])
                    # Input begins at Berlin midnight (22:00 UTC), not UTC hour 0.
                    self.assertEqual(rows[1], ["00:00", "-5.5", "0"])
                    self.assertEqual(rows[-1], ["23:00", "17.5", "23"])
                else:
                    self.assertEqual([int(row[0]) for row in rows[1:]], exporter.YEARS)
        cohorts = list(csv.DictReader(first["battery_storage_cohorts.csv"].decode().splitlines()))
        self.assertEqual(cohorts[5]["Anzahl_Index"], "100")
        self.assertEqual(cohorts[5]["Energie_Index"], "100")
        yearly = list(csv.DictReader(first["battery_storage_yearly.csv"].decode().splitlines()))
        self.assertTrue(all(row["period_complete"] == "false" for row in yearly if row["commissioning_year"] == "2026"))
        self.assertNotIn(b"SSE000", b"".join(first.values()))
        self.assertNotIn(b"SEE000", b"".join(first.values()))

    def test_quality_scope_excludes_giant_nonbattery_and_planned(self):
        self.run_export()
        report = json.loads((self.output / "battery_storage_quality.json").read_bytes())
        self.assertEqual(report["before_quality_filters"]["relation_count"], 25)
        self.assertEqual(report["included_after_quality_filters"]["relation_count"], 24)
        self.assertEqual(report["excluded_by_quality_filters"]["relation_count"], 1)
        self.assertAlmostEqual(report["excluded_by_quality_filters"]["known_energy_gwh"], 0.000999)
        self.assertLess(report["before_quality_filters"]["known_energy_gwh"], 1)

    def test_failure_preserves_previous_set_and_unrelated_files(self):
        self.run_export()
        (self.output / "unrelated_blog.csv").write_bytes(b"frozen\n")
        previous = self.output_bytes()
        self.mutate("DELETE FROM prod_curated.fact_battery_storage_germany_monthly")
        with self.assertRaisesRegex(exporter.ValidationError, "singular test failed"):
            self.run_export()
        self.assertEqual(previous, self.output_bytes())

    def test_stale_cleaned_provenance_rejected_without_touching_previous_set(self):
        self.run_export()
        previous = self.output_bytes()
        for name in ("mastr_katalogwerte", "mastr_stromspeicher_einheiten", "mastr_stromspeicher_anlagen"):
            for assignment in ("archive_sha256=repeat('b',64)", "snapshot_date=DATE '2026-06-29'"):
                with self.subTest(model=name, assignment=assignment):
                    shutil.copyfile(self.template, self.database)
                    # Change only one row, so a MIN(hash) shortcut would miss it.
                    self.mutate(f"UPDATE prod_cleaned.{name} SET {assignment} WHERE rowid=(SELECT MAX(rowid) FROM prod_cleaned.{name})")
                    with self.assertRaisesRegex(exporter.ValidationError, "battery_snapshot_contract.sql"):
                        self.run_export()
                    self.assertEqual(previous, self.output_bytes())

    def test_ephemeral_ref_expansion_rechecks_current_cleaned_rows(self):
        contract = self.root / "freshness_contract.sql"
        contract.write_text("SELECT is_fresh FROM {{ ref('mastr_battery_freshness') }} AS f")
        sql = exporter.render_sql(contract, "2026-06-30")
        with duckdb.connect(str(self.database), read_only=True) as db:
            self.assertEqual(db.execute(sql).fetchall(), [(True,)])
        self.mutate("UPDATE prod_cleaned.mastr_stromspeicher_anlagen SET archive_sha256=repeat('b',64) WHERE rowid=0")
        with duckdb.connect(str(self.database), read_only=True) as db:
            with self.assertRaisesRegex(duckdb.InvalidInputException, "Stale MaStR cleaned provenance"):
                db.execute(sql).fetchall()

    def test_ephemeral_missing_or_invalid_config_fails_closed(self):
        original = self.root / "ephemeral.sql"
        with patch.dict(exporter.EPHEMERAL_MODELS, {"mastr_battery_freshness": str(original)}, clear=True):
            with self.assertRaises(FileNotFoundError):
                self.run_export()
            original.write_text("SELECT TRUE AS is_fresh")
            with self.assertRaisesRegex(exporter.ValidationError, "explicitly ephemeral"):
                self.run_export()
            original.write_text("{{ config(materialized='table') }} SELECT TRUE AS is_fresh")
            with self.assertRaisesRegex(exporter.ValidationError, "Unsupported"):
                self.run_export()
            original.write_text("{{ config(materialized='ephemeral') }} SELECT FALSE AS is_fresh")
            with self.assertRaisesRegex(exporter.ValidationError, "exactly one true"):
                self.run_export()
        self.assertFalse(self.output.exists())

    def test_missing_planned_summary_fails_new_singular_contract(self):
        self.mutate("DELETE FROM prod_curated.fact_battery_storage_germany_summary WHERE operating_status='planned'")
        with self.assertRaisesRegex(exporter.ValidationError, "battery_summary_reconciliation.sql"):
            self.run_export()
        self.assertFalse(self.output.exists())

    def test_bad_source_date_hash_and_duplicate_metadata_do_not_create_output(self):
        mutations = [
            "UPDATE staging.mastr_snapshot SET snapshot_date='2026-07-01'",
            "UPDATE staging.mastr_snapshot SET archive_sha256='bad'",
            "UPDATE staging.mastr_snapshot SET archive_sha256=repeat('b',64)",
            "INSERT INTO staging.mastr_snapshot SELECT * FROM staging.mastr_snapshot",
            "DELETE FROM staging.mastr_snapshot",
            "UPDATE staging.mastr_snapshot SET source_url='https://example.org/wrong.zip'",
            "UPDATE prod_cleaned.mastr_battery_snapshot SET source_url='wrong'",
            "UPDATE prod_curated.fact_battery_storage_germany_plants SET snapshot_date='2026-07-01'",
        ]
        for sql in mutations:
            with self.subTest(sql=sql):
                shutil.copyfile(self.template, self.database)
                self.mutate(sql)
                with self.assertRaises(exporter.ValidationError):
                    self.run_export()
                self.assertFalse(self.output.exists())

    def test_duplicates_nonfinite_null_stale_dates_and_missing_years_rejected(self):
        mutations = [
            "INSERT INTO prod_curated.fact_battery_storage_germany_yearly SELECT * FROM prod_curated.fact_battery_storage_germany_yearly",
            "UPDATE prod_curated.fact_battery_storage_germany_yearly SET median_duration_hours='NaN' WHERE size_segment='small'",
            "UPDATE prod_curated.fact_battery_storage_germany_yearly SET median_duration_hours=NULL WHERE size_segment='small'",
            "UPDATE prod_curated.fact_battery_storage_germany_by_state SET snapshot_date='2026-07-01'",
            "UPDATE prod_curated.fact_battery_storage_germany_yearly SET commissioning_year=2018 WHERE commissioning_year=2025",
            "UPDATE prod_curated.fact_battery_storage_germany_yearly SET unit_count=unit_count+1 WHERE size_segment='small'",
            "UPDATE prod_curated.fact_battery_storage_germany_summary SET energy_gwh=energy_gwh+1 WHERE operating_status='operating'",
        ]
        for sql in mutations:
            with self.subTest(sql=sql):
                shutil.copyfile(self.template, self.database)
                self.mutate(sql)
                with self.assertRaises(exporter.ValidationError):
                    self.run_export()
                self.assertFalse(self.output.exists())

    def test_electricity_bad_hash_rejected(self):
        data = json.loads(self.electricity.read_bytes())
        data["rows"][0][1] = 3
        self.electricity.write_bytes(exporter.canonical(data))
        with self.assertRaisesRegex(exporter.ValidationError, "content hash mismatch"):
            self.run_export()
        self.assertFalse(self.output.exists())

    def test_missing_database_is_not_created(self):
        missing = self.root / "missing.duckdb"
        with self.assertRaises(duckdb.IOException):
            exporter.export(missing, self.output, self.electricity)
        self.assertFalse(missing.exists())
        self.assertFalse(self.output.exists())

    def test_valid_models_without_completed_2025_are_rejected(self):
        # Keep year/month totals and all six singular contracts valid, but remove
        # a required article year. The export coverage guard must still stop it.
        self.mutate("UPDATE prod_curated.fact_battery_storage_germany_yearly SET commissioning_year=2018 WHERE commissioning_year=2025")
        self.mutate("UPDATE prod_curated.fact_battery_storage_germany_monthly SET commissioning_month=DATE '2018-01-01' WHERE year(commissioning_month)=2025")
        with self.assertRaisesRegex(exporter.ValidationError, "Missing completed"):
            self.run_export()
        self.assertFalse(self.output.exists())

    def test_electricity_window_timezone_grain_duplicates_units_and_nulls(self):
        original = self.electricity.read_bytes()
        mutations = [
            lambda d: d.update(timezone="UTC"),
            lambda d: d.update(window_start="2026-08-11T00:00:00Z"),
            lambda d: d.update(data_through="2026-09-09T21:00:00Z"),
            lambda d: d.update(units={"power": "MW", "price": "EUR/MWh"}),
            lambda d: d["rows"].pop(),
            lambda d: d["rows"][1].__setitem__(0, d["rows"][0][0]),
            lambda d: d["rows"][1].__setitem__(0, d["rows"][0][0] + 900000),
            lambda d: d["rows"][0].__setitem__(1, None),
            lambda d: d["rows"][0].__setitem__(2, True),
            lambda d: d.update(snapshot_created_at="2026-06-30T00:00:00Z"),
        ]
        for index, mutation in enumerate(mutations):
            with self.subTest(mutation=index):
                data = json.loads(original)
                mutation(data)
                self.write_electricity(data)
                with self.assertRaises(exporter.ValidationError):
                    exporter.daily_profile(self.electricity)

    def test_manifest_detects_mixed_set(self):
        self.run_export()
        path = self.output / "battery_storage_cohorts.csv"
        path.write_bytes(path.read_bytes().replace(b"100", b"101", 1))
        with self.assertRaisesRegex(exporter.ValidationError, "hash mismatch"):
            exporter.verify_set(self.output)

    def test_stage_validation_preserves_previous_set(self):
        self.run_export()
        previous = self.output_bytes()
        broken = dict(previous)
        broken["battery_storage_cohorts.csv"] += b"corrupt\n"
        with self.assertRaisesRegex(exporter.ValidationError, "hash mismatch"):
            exporter.promote(broken, self.output)
        self.assertEqual(previous, self.output_bytes())

    def test_manifest_promoted_last_and_io_error_rolls_back(self):
        self.run_export()
        previous = self.output_bytes()
        calls = []
        real_replace = exporter.os.replace

        def observe(src, dst):
            calls.append(Path(dst).name)
            real_replace(src, dst)

        with patch.object(exporter.os, "replace", side_effect=observe):
            exporter.promote(previous, self.output)
        self.assertEqual(calls[-1], exporter.MANIFEST)

        def fail_once(src, dst):
            calls.append(Path(dst).name)
            if len(calls) == 3:
                raise OSError("simulated promotion failure")
            real_replace(src, dst)

        calls.clear()
        with patch.object(exporter.os, "replace", side_effect=fail_once):
            with self.assertRaisesRegex(OSError, "simulated"):
                exporter.promote(previous, self.output)
        self.assertEqual(previous, self.output_bytes())


if __name__ == "__main__":
    unittest.main()
