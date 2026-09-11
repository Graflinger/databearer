"""Offline executable SQL contracts; uses only an in-memory DuckDB.

Run from pipeline with PYTHONPATH=. python -m unittest discover -s tests
-p test_battery_storage_models.py. Requires duckdb and jinja2, not dbt or downloads.
Catalogue fixture matches the inspected MaStR export; mutation tests prove the
models/test SQL validate the catalogue rather than merely trusting these IDs.
"""

import re
import unittest
from pathlib import Path
from types import SimpleNamespace

import duckdb
from jinja2 import Environment, StrictUndefined


PROJECT = Path(__file__).resolve().parents[1] / "src/data_pipelines/databearer_dbt"
MODEL_NAMES = [
    "mastr_battery_snapshot",
    "mastr_katalogwerte",
    "mastr_stromspeicher_einheiten",
    "mastr_stromspeicher_anlagen",
    "mastr_battery_freshness",
    "fact_battery_storage_germany_plants",
    "fact_battery_storage_germany_yearly",
    "fact_battery_storage_germany_monthly",
    "fact_battery_storage_germany_by_state",
    "fact_battery_storage_germany_summary",
    "fact_battery_storage_germany_quality",
]
MODEL_PATHS = {name: next((PROJECT / "models").rglob(name + ".sql")) for name in MODEL_NAMES}
UNIT_COLUMNS = [
    "EinheitMastrNummer", "SpeMastrNummer", "Nettonennleistung",
    "Inbetriebnahmedatum", "GeplantesInbetriebnahmedatum",
    "DatumLetzteAktualisierung", "Land", "Technologie", "EinheitSystemstatus",
    "EinheitBetriebsstatus", "Bundesland", "NetzbetreiberpruefungStatus",
]
PLANT_COLUMNS = [
    "MaStRNummer", "NutzbareSpeicherkapazitaet", "VerknuepfteEinheitenMaStRNummern",
    "AnlageBetriebsstatus", "DatumLetzteAktualisierung",
]


def fail(message):
    raise ValueError(message)


def render(path, variables, *, execute=True):
    return Environment(undefined=StrictUndefined).from_string(path.read_text()).render(
        ref=lambda name: name,
        source=lambda schema, table: f"{schema}.{table}",
        var=lambda name: variables[name],
        modules=SimpleNamespace(re=re),
        exceptions=SimpleNamespace(raise_compiler_error=fail),
        execute=execute,
        config=lambda **kwargs: '',
    )


class BatteryModelsTest(unittest.TestCase):
    def setUp(self):
        self.db = duckdb.connect(":memory:")
        self.addCleanup(self.db.close)
        self.variables = {"battery_snapshot_date": "2026-09-01"}
        self.db.execute("CREATE SCHEMA staging")
        self.db.execute("CREATE TABLE staging.mastr_snapshot (snapshot_date DATE, source_url VARCHAR, archive_sha256 VARCHAR, filename VARCHAR)")
        self.db.execute("INSERT INTO staging.mastr_snapshot VALUES (?, ?, ?, ?)", [
            self.variables["battery_snapshot_date"],
            "https://download.marktstammdatenregister.de/Gesamtdatenexport_20260901_26.1.zip",
            "a" * 64, "Gesamtdatenexport_20260901_26.1_battery_subset.zip",
        ])
        self.db.execute("CREATE TABLE staging.mastr_katalogwerte (Id VARCHAR, Wert VARCHAR, KatalogKategorieId VARCHAR)")
        self.db.executemany("INSERT INTO staging.mastr_katalogwerte VALUES (?, ?, ?)", [
            ("84", "Deutschland", "6"), ("524", "Batterie", "29"),
            ("472", "Aktiviert", "19"), ("35", "In Betrieb", "4"),
            ("31", "In Planung", "4"), ("38", "Endgültig stillgelegt", "4"),
            ("580", "geprüft", "36"), ("579", "ungeprüft", "36"),
            ("2954", "Geprüft", "175"), ("2955", "In Prüfung", "175"),
            ("1403", "Bayern", "101"), ("1405", "Hessen", "101"),
        ])
        self.db.execute("CREATE TABLE staging.mastr_katalogkategorien (Id VARCHAR, Name VARCHAR)")
        self.db.executemany("INSERT INTO staging.mastr_katalogkategorien VALUES (?, ?)", [
            ("6", "Land"), ("29", "StromspeicherOhneWasserkraft"),
            ("19", "Systemstatus"), ("4", "Betriebsstatus"),
            ("36", "Prüfungsstatus"), ("101", "Bundesland"),
            ("175", "NBPStatusFilter"),
        ])
        for table, columns in [
            ("mastr_einheiten_strom_speicher", UNIT_COLUMNS),
            ("mastr_anlagen_strom_speicher", PLANT_COLUMNS),
        ]:
            self.db.execute(f"CREATE TABLE staging.{table} ({', '.join(c + ' VARCHAR' for c in columns)})")

    def add(self, number, power="10", energy="20", dates=None, **unit_changes):
        """One plant, optionally multiple unit powers/dates. All quantities source strings."""
        powers = power if isinstance(power, list) else [power]
        dates = dates or ["2024-01-15"] * len(powers)
        plant_id = f"SSE{number:012d}"
        ids = [f"SEE{number * 100 + i:012d}" for i in range(len(powers))]
        status = unit_changes.get("EinheitBetriebsstatus", "35")
        self.db.execute("INSERT INTO staging.mastr_anlagen_strom_speicher VALUES (?, ?, ?, ?, ?)",
                        [plant_id, energy, ", ".join(ids), status, "2026-08-31"])
        for unit_id, unit_power, date in zip(ids, powers, dates):
            row = dict(zip(UNIT_COLUMNS, [
                unit_id, plant_id, unit_power, date, "2027-01-01", "2026-08-31",
                "84", "524", "472", status, "1403", "2954",
            ]))
            row.update(unit_changes)
            self.db.execute(
                f"INSERT INTO staging.mastr_einheiten_strom_speicher VALUES ({', '.join('?' for _ in UNIT_COLUMNS)})",
                [row[c] for c in UNIT_COLUMNS],
            )

    def build(self):
        for name in MODEL_NAMES:
            self.materialize(name)

    def materialize(self, name):
        # A view exercises the ephemeral freshness SQL on every curated query.
        kind = 'VIEW' if name == 'mastr_battery_freshness' else 'TABLE'
        self.db.execute(f"CREATE OR REPLACE {kind} {name} AS {render(MODEL_PATHS[name], self.variables)}")

    def plant(self, number):
        result = self.db.execute("SELECT * FROM fact_battery_storage_germany_plants WHERE spe_mastr_nummer = ?",
                                 [f"SSE{number:012d}"])
        return dict(zip([c[0] for c in result.description], result.fetchone()))

    def assert_dbt_tests_pass(self, *, expect_empty=False):
        for path in sorted((PROJECT / "tests").glob("battery_*.sql")):
            with self.subTest(dbt_test=path.name):
                failures = self.db.sql(render(path, self.variables)).fetchall()
                if expect_empty and path.name == 'battery_nonempty_operating.sql':
                    self.assertEqual(len(failures), 5)
                    self.assertIn(('included_operating_plants',), failures)
                else:
                    self.assertEqual(failures, [])

    def test_multi_unit_energy_once_earliest_date_and_median_of_plants(self):
        self.add(1, ["10", "20"], "60", ["2020-02-01", "2024-04-01"])
        self.add(2, "1000", "100", ["2020-02-01"])
        self.build()
        plant = self.plant(1)
        self.assertEqual((plant["power_kw"], plant["energy_kwh"], plant["duration_hours"]), (30, 60, 2))
        self.assertTrue(plant["has_commissioning_spread"])
        self.assertEqual(str(plant["commissioning_month"]), "2020-02-01")
        self.assertEqual(plant["raw_power_values"], ["10", "20"])
        self.assertEqual(plant["raw_energy_values"], ["60"])
        summary = self.db.sql("SELECT plant_count, unit_count, power_gw, energy_gwh, median_duration_hours FROM fact_battery_storage_germany_summary WHERE size_segment='overall'").fetchone()
        self.assertEqual(summary[:2], (2, 3))
        self.assertAlmostEqual(summary[2], 1030 / 1e6)
        self.assertAlmostEqual(summary[3], 160 / 1e6)
        self.assertAlmostEqual(summary[4], 1.05)
        self.assert_dbt_tests_pass()

    def test_size_thresholds_use_both_dimensions(self):
        values = [("29", "29", "small"), ("30", "20", "medium"),
                  ("20", "30", "medium"), ("999", "999", "medium"),
                  ("1000", "100", "large"), ("100", "1000", "large")]
        for n, (power, energy, _) in enumerate(values, 1):
            self.add(n, power, energy)
        self.build()
        for n, (_, _, segment) in enumerate(values, 1):
            self.assertEqual(self.plant(n)["size_segment"], segment)
            self.assertTrue(self.plant(n)["is_included"])
        self.assert_dbt_tests_pass()

    def test_invalid_values_are_retained_not_zero_or_partial_sum(self):
        values = [("unknown", "20"), (["10", ""], "20"), ("10", "unknown"),
                  ("NaN", "20"), ("10", "Infinity"), ("-1", "20"),
                  ("0.3", "1"), ("1", "0.3"), ("10", "0.9"), ("1", "12.1")]
        for n, (power, energy) in enumerate(values, 1):
            self.add(n, power, energy)
        self.build()
        for n in range(1, len(values) + 1):
            self.assertFalse(self.plant(n)["is_included"])
            self.assertTrue(self.plant(n)["quality_reasons"])
        self.assertIsNone(self.plant(2)["power_kw"])
        self.assertEqual(self.plant(2)["known_positive_unit_power_kw"], 10)
        self.assertIsNone(self.plant(3)["energy_kwh"])
        self.assertEqual(self.db.sql("SELECT relation_count FROM fact_battery_storage_germany_quality WHERE report_type='relation' AND reason='excluded'").fetchone()[0], len(values))
        self.assert_dbt_tests_pass(expect_empty=True)

    def test_duration_boundaries_and_all_unit_dates(self):
        self.add(1, "10", "1", ["1990-01-01"])
        self.add(2, "1", "12", ["2026-09-01"])
        for n, date in enumerate(["1989-12-31", "2026-09-02", "bad", None], 3):
            self.add(n, ["5", "5"], "20", ["2024-01-01", date])
        self.build()
        self.assertTrue(self.plant(1)["is_included"])
        self.assertTrue(self.plant(2)["is_included"])
        for n in range(3, 7):
            self.assertIn("invalid_or_missing_commissioning_date", self.plant(n)["quality_reasons"])
        self.assert_dbt_tests_pass()

    def test_planned_retired_inactive_foreign_nonbattery_and_unknown_separated(self):
        self.add(1)
        self.add(2, dates=[None], EinheitBetriebsstatus="31")
        for n, changes in enumerate([
            {"EinheitBetriebsstatus": "38"}, {"EinheitSystemstatus": "484"},
            {"Land": "85"}, {"Technologie": "525"}, {"EinheitBetriebsstatus": "unknown"},
        ], 3):
            self.add(n, **changes)
        self.build()
        self.assertTrue(self.plant(2)["is_planned_included"])
        self.assertFalse(self.plant(2)["is_included"])
        self.assertEqual(self.db.sql("SELECT SUM(plant_count) FROM fact_battery_storage_germany_yearly WHERE size_segment='overall'").fetchone()[0], 1)
        self.assertEqual(self.db.sql("SELECT operating_status, plant_count FROM fact_battery_storage_germany_summary WHERE size_segment='overall' ORDER BY 1").fetchall(), [("operating", 1), ("planned", 1)])
        for n in range(3, 8):
            self.assertFalse(self.plant(n)["is_included"])
        self.assert_dbt_tests_pass()

    def test_duplicate_ids_and_missing_joins_do_not_multiply_capacity(self):
        for n in range(1, 6):
            self.add(n)
        self.db.execute("INSERT INTO staging.mastr_anlagen_strom_speicher SELECT * FROM staging.mastr_anlagen_strom_speicher WHERE MaStRNummer='SSE000000000001'")
        self.db.execute("INSERT INTO staging.mastr_einheiten_strom_speicher SELECT * FROM staging.mastr_einheiten_strom_speicher WHERE SpeMastrNummer='SSE000000000002'")
        self.db.execute("DELETE FROM staging.mastr_anlagen_strom_speicher WHERE MaStRNummer='SSE000000000003'")
        self.db.execute("DELETE FROM staging.mastr_einheiten_strom_speicher WHERE SpeMastrNummer='SSE000000000004'")
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET SpeMastrNummer='' WHERE SpeMastrNummer='SSE000000000005'")
        self.build()
        self.assertEqual(self.db.sql("SELECT COUNT(*) FROM fact_battery_storage_germany_plants").fetchone()[0], 6)
        self.assertEqual(self.db.sql("SELECT COUNT(*) FROM fact_battery_storage_germany_plants WHERE is_included").fetchone()[0], 0)
        self.assertIsNone(self.plant(1)["energy_kwh"])
        self.assertEqual(self.plant(1)["raw_energy_values"], ["20", "20"])
        self.assert_dbt_tests_pass(expect_empty=True)

    def test_missing_state_retained_conflicting_state_and_status_excluded(self):
        self.add(1, Bundesland=None, NetzbetreiberpruefungStatus=None)
        self.add(2, ["5", "5"])
        self.add(3, ["5", "5"])
        self.add(4, NetzbetreiberpruefungStatus="2955")
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET Bundesland='1405' WHERE EinheitMastrNummer='SEE000000000201'")
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET EinheitBetriebsstatus='31' WHERE EinheitMastrNummer='SEE000000000301'")
        self.build()
        self.assertTrue(self.plant(1)["is_included"])
        self.assertIsNone(self.plant(1)["is_network_verified"])
        self.assertFalse(self.plant(4)["is_network_verified"])
        self.assertIn("conflicting_states", self.plant(2)["quality_reasons"])
        self.assertIn("unknown_mixed_or_conflicting_status", self.plant(3)["quality_reasons"])
        self.assertEqual(self.db.sql("SELECT plant_count FROM fact_battery_storage_germany_by_state WHERE state='Unknown' AND size_segment='overall'").fetchone()[0], 1)
        self.assert_dbt_tests_pass()

    def test_network_status_uses_actual_nbp_catalogue_category(self):
        self.add(1)
        self.add(2, NetzbetreiberpruefungStatus='2955')
        self.add(3, NetzbetreiberpruefungStatus='580')
        self.build()
        self.assertTrue(self.plant(1)['is_network_verified'])
        self.assertFalse(self.plant(2)['is_network_verified'])
        self.assertIsNone(self.plant(3)['is_network_verified'])
        self.assert_dbt_tests_pass()

    def test_catalogue_mutations_fail_source_contract_and_selection(self):
        self.add(1)
        self.build()
        self.assert_dbt_tests_pass()
        for statement in [
            "UPDATE staging.mastr_katalogwerte SET Wert='Wrong' WHERE Id='524'",
            "UPDATE staging.mastr_katalogwerte SET Wert='Batterie', KatalogKategorieId='6' WHERE Id='524'",
            "UPDATE staging.mastr_katalogwerte SET KatalogKategorieId='29' WHERE Id='524'",
        ]:
            self.db.execute(statement)
            if "KatalogKategorieId='29'" in statement:
                self.db.execute("INSERT INTO staging.mastr_katalogwerte SELECT * FROM staging.mastr_katalogwerte WHERE Id='524'")
            self.build()
            self.assertFalse(self.plant(1)["is_included"])
            self.assertEqual(self.db.sql("SELECT COUNT(*) FROM mastr_stromspeicher_einheiten").fetchone()[0], 1)
            failures = self.db.sql(render(PROJECT / "tests/battery_catalogue_contract.sql", self.variables)).fetchall()
            self.assertIn((524,), failures)

    def test_snapshot_required_and_invalid_calendar_date_rejected(self):
        path = MODEL_PATHS["fact_battery_storage_germany_plants"]
        with self.assertRaises(KeyError):
            render(path, {})
        with self.assertRaises(ValueError):
            render(path, {"battery_snapshot_date": "not-a-date"})
        self.add(1)
        self.variables["battery_snapshot_date"] = "2026-02-30"
        with self.assertRaises(duckdb.ConversionException):
            self.build()

    def test_unknown_capacity_exclusion_total_remains_null(self):
        self.add(1, energy=None)
        self.build()
        self.assertIsNone(self.db.sql("SELECT known_energy_gwh FROM fact_battery_storage_germany_quality WHERE report_type='relation' AND reason='excluded'").fetchone()[0])
        self.assert_dbt_tests_pass(expect_empty=True)

    def test_link_mismatch_invalid_identifier_and_plant_status_conflict(self):
        for n in range(1, 4):
            self.add(n)
        self.db.execute("UPDATE staging.mastr_anlagen_strom_speicher SET VerknuepfteEinheitenMaStRNummern='SEE999999999999' WHERE MaStRNummer='SSE000000000001'")
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET EinheitMastrNummer='bad' WHERE SpeMastrNummer='SSE000000000002'")
        self.db.execute("UPDATE staging.mastr_anlagen_strom_speicher SET AnlageBetriebsstatus='31' WHERE MaStRNummer='SSE000000000003'")
        self.build()
        self.assertIn("plant_unit_link_mismatch", self.plant(1)["quality_reasons"])
        self.assertIn("invalid_or_duplicate_identifier", self.plant(2)["quality_reasons"])
        self.assertIn("unknown_mixed_or_conflicting_status", self.plant(3)["quality_reasons"])
        self.assert_dbt_tests_pass(expect_empty=True)

    def test_aggregate_test_detects_dropped_cohort(self):
        self.add(1)
        self.build()
        self.db.execute("DELETE FROM fact_battery_storage_germany_monthly")
        failures = self.db.sql(render(PROJECT / "tests/battery_aggregate_reconciliation.sql", self.variables)).fetchall()
        self.assertIn(("fact_battery_storage_germany_monthly_plant_totals",), failures)

    def test_wrong_plant_prefix_rejected_without_rejecting_actual_sse(self):
        self.add(1)
        self.add(2)
        # Mutate BOTH ends of a valid join: only the prefix is wrong.
        self.db.execute("UPDATE staging.mastr_anlagen_strom_speicher SET MaStRNummer='SPE000000000002' WHERE MaStRNummer='SSE000000000002'")
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET SpeMastrNummer='SPE000000000002' WHERE SpeMastrNummer='SSE000000000002'")
        self.build()
        self.assertTrue(self.plant(1)['is_included'])
        row = self.db.sql("SELECT identifiers_valid, plant_unit_join_valid, is_included, quality_reasons FROM fact_battery_storage_germany_plants WHERE spe_mastr_nummer='SPE000000000002'").fetchone()
        self.assertEqual(row[:3], (False, True, False))
        self.assertIn('invalid_or_duplicate_identifier', row[3])
        self.assert_dbt_tests_pass()

    def test_empty_inclusion_and_planned_only_cannot_pass(self):
        # Both empty sources and plausible planned-only data must fail.
        for planned in [False, True]:
            with self.subTest(planned=planned):
                if planned:
                    self.add(1, dates=[None], EinheitBetriebsstatus='31')
                self.build()
                self.assert_dbt_tests_pass(expect_empty=True)

    def test_missing_operating_aggregate_fails_nonempty_guard(self):
        self.add(1)
        self.build()
        self.db.execute("DELETE FROM fact_battery_storage_germany_summary WHERE operating_status='operating'")
        failures = self.db.sql(render(PROJECT / 'tests/battery_nonempty_operating.sql', self.variables)).fetchall()
        self.assertEqual(failures, [('fact_battery_storage_germany_summary',)])

    def test_source_snapshot_mismatch_fails_build_and_stale_model_test(self):
        self.add(1)
        self.build()
        self.assertEqual(self.plant(1)['archive_sha256'], 'a' * 64)
        self.db.execute("UPDATE staging.mastr_snapshot SET snapshot_date=DATE '2026-06-30'")
        failures = self.db.sql(render(PROJECT / 'tests/battery_snapshot_contract.sql', self.variables)).fetchall()
        self.assertIn(('source_snapshot',), failures)
        self.assertIn(('plant_provenance',), failures)
        with self.assertRaisesRegex(duckdb.InvalidInputException, 'provenance'):
            self.build()

    def test_explicit_date_cannot_relabel_existing_source_snapshot(self):
        self.add(1)
        self.build()
        self.variables['battery_snapshot_date'] = '2026-09-02'
        failures = self.db.sql(render(PROJECT / 'tests/battery_snapshot_contract.sql', self.variables)).fetchall()
        self.assertIn(('source_snapshot',), failures)
        self.assertIn(('cleaned_snapshot',), failures)
        with self.assertRaisesRegex(duckdb.InvalidInputException, 'provenance'):
            self.build()

    def test_snapshot_must_have_exactly_one_complete_row(self):
        self.add(1)
        for mutation in [
            "DELETE FROM staging.mastr_snapshot",
            "INSERT INTO staging.mastr_snapshot SELECT * FROM staging.mastr_snapshot",
            "UPDATE staging.mastr_snapshot SET archive_sha256='bad'",
        ]:
            with self.subTest(mutation=mutation):
                self.db.execute('BEGIN TRANSACTION')
                self.db.execute(mutation)
                try:
                    with self.assertRaisesRegex(duckdb.InvalidInputException, 'provenance'):
                        self.build()
                finally:
                    self.db.execute('ROLLBACK')

    def test_parse_without_vars_keeps_all_dependencies_visible(self):
        for path in MODEL_PATHS.values():
            render(path, {}, execute=False)
        for path in (PROJECT / 'tests').glob('battery_*.sql'):
            render(path, {}, execute=False)
        sql = render(MODEL_PATHS['fact_battery_storage_germany_plants'], {}, execute=False)
        self.assertIn('mastr_battery_freshness', sql)
        self.assertIn('mastr_stromspeicher_einheiten', sql)
        with self.assertRaises(KeyError):
            render(MODEL_PATHS['mastr_battery_snapshot'], {})

    def test_same_rowcount_new_archive_cannot_relabel_stale_cleaned(self):
        self.add(1)
        self.build()
        self.db.execute("UPDATE staging.mastr_einheiten_strom_speicher SET Nettonennleistung='12'")
        self.db.execute("UPDATE staging.mastr_snapshot SET archive_sha256=?", ['b' * 64])
        self.materialize('mastr_battery_snapshot')
        # Snapshot + curated-only rebuild must fail even though date/counts match.
        with self.assertRaisesRegex(duckdb.InvalidInputException, 'Stale MaStR cleaned provenance'):
            self.materialize('fact_battery_storage_germany_plants')
        # Refreshing units alone must not hide the stale catalogue, either.
        with self.assertRaisesRegex(duckdb.InvalidInputException, 'Stale MaStR catalogue provenance'):
            self.materialize('mastr_stromspeicher_einheiten')
        self.build()
        self.assertEqual(self.plant(1)['power_kw'], 12)
        self.assertEqual(self.plant(1)['archive_sha256'], 'b' * 64)
        self.assert_dbt_tests_pass()

    def test_each_cleaned_relation_provenance_checked(self):
        self.add(1)
        self.build()
        for name in ['mastr_katalogwerte', 'mastr_stromspeicher_einheiten', 'mastr_stromspeicher_anlagen']:
            with self.subTest(model=name):
                self.db.execute(f"UPDATE {name} SET archive_sha256=?", ['b' * 64])
                with self.assertRaisesRegex(duckdb.InvalidInputException, 'Stale MaStR cleaned provenance'):
                    self.materialize('fact_battery_storage_germany_plants')
                self.db.execute(f"UPDATE {name} SET archive_sha256=?", ['a' * 64])

    def test_summary_reconciliation_detects_missing_doubled_and_null_totals(self):
        self.add(1)
        self.add(2, dates=[None], EinheitBetriebsstatus='31')
        self.build()
        table = 'fact_battery_storage_germany_summary'
        for mutation in [
            f"DELETE FROM {table} WHERE operating_status='planned'",
            f"INSERT INTO {table} SELECT * FROM {table}",
            f"UPDATE {table} SET plant_count=plant_count*2, unit_count=unit_count*2, power_gw=power_gw*2, energy_gwh=energy_gwh*2",
            f"UPDATE {table} SET power_gw=NULL",
            f"UPDATE {table} SET unit_count=unit_count+1",
        ]:
            with self.subTest(mutation=mutation):
                self.db.execute(mutation)
                failures = self.db.sql(render(PROJECT / 'tests/battery_summary_reconciliation.sql', self.variables)).fetchall()
                self.assertTrue(failures)
                self.materialize(table)
        self.assert_dbt_tests_pass()


if __name__ == "__main__":
    unittest.main()
