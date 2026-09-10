"""Offline contracts and transactions; synthetic data stays in temporary directories."""

import copy
from datetime import date, timedelta
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from src.data_pipelines.dashboards.german_electricity import history as h
from src.data_pipelines.dashboards.german_electricity import pipeline as ge


AS_OF = date(2026, 9, 10)
CUTOFF = date(2026, 9, 8)


def source(years):
    result = {}
    for year in years:
        result[year] = {column: {} for column in h.DAILY_SERIES}
        for day in h.days(date(year, 1, 1), date(year, 12, 31)):
            for column in h.DAILY_SERIES:
                value = -10.0 if column.startswith("price") else h.hours(day) * 1000.0
                if column.startswith("price") and day < h.PRICE_START:
                    value = None
                if column == "nuclear" and day > h.SHUTDOWN:
                    value = None if day >= date(2024, 1, 30) else 0
                if (day, column) in h.KNOWN_ENERGY_GAPS:
                    value = None
                result[year][column][day] = value
    return result


def partition(year, end=None):
    return h.partition(year, h.make_rows(source([year]), date(year, 1, 1), end or date(year, 12, 31)))


def snapshot(cutoff=CUTOFF):
    end = ge.midnight_ms(cutoff + timedelta(days=1))
    start = ge.midnight_ms(cutoff - timedelta(days=29))
    rows = [[timestamp, *([1.0] * 12), -10.0] for timestamp in range(start, end, ge.HOUR_MS)]
    return ge.make_snapshot(rows, start, end, created_at=ge.iso_utc(end), now_ms=end)


class DailySourceTests(unittest.TestCase):
    def test_leap_dst_contiguous_dates(self):
        value = partition(2016)
        self.assertEqual(len(value["rows"]), 366)
        rows = {row["date"]: row for row in value["rows"]}
        self.assertEqual(rows["2016-02-29"]["hours"], 24)
        self.assertEqual(rows["2016-03-27"]["hours"], 23)
        self.assertEqual(rows["2016-10-30"]["hours"], 25)
        for broken in (value["rows"][:30] + value["rows"][31:], value["rows"][:30] + value["rows"][29:]):
            with self.assertRaises(h.ValidationError):
                h.partition(2016, broken)

    def test_price_missing_four_and_zone_boundary(self):
        first = partition(2015)["rows"]
        self.assertTrue(all(row["price_eur_mwh"] is None for row in first[:4]))
        self.assertEqual(first[4]["price_eur_mwh"], -10)
        values = source([2018])
        values[2018]["price_old"][date(2018, 9, 30)] = 21
        values[2018]["price"][date(2018, 10, 1)] = 42
        rows = h.make_rows(values, date(2018, 9, 30), date(2018, 10, 1))
        self.assertEqual([(r["price_zone"], r["price_eur_mwh"]) for r in rows], [("DE-AT-LU", 21), ("DE-LU", 42)])
        values[2018]["price"][date(2018, 10, 1)] = None
        with self.assertRaisesRegex(h.ValidationError, "2018-10-01/price"):
            h.make_rows(values, date(2018, 10, 1), date(2018, 10, 1))

    def test_nuclear_observed_derived_and_shutdown_guard(self):
        values = source([2023, 2024])
        rows = h.make_rows(values, date(2023, 4, 15), date(2023, 4, 16))
        self.assertGreater(rows[0]["energy_gwh"]["nuclear"], 0)
        self.assertEqual(rows[1]["energy_gwh"]["nuclear"], 0)
        self.assertFalse(rows[1]["nuclear_derived_zero"])
        rows = h.make_rows(values, date(2024, 1, 29), date(2024, 1, 30))
        self.assertEqual([r["nuclear_derived_zero"] for r in rows], [False, True])
        values[2023]["nuclear"][date(2023, 4, 16)] = 1
        with self.assertRaisesRegex(h.ValidationError, "nonzero nuclear"):
            h.make_rows(values, date(2023, 4, 16), date(2023, 4, 16))
        values[2023]["nuclear"][date(2023, 4, 15)] = None
        with self.assertRaisesRegex(h.ValidationError, "2023-04-15/nuclear"):
            h.make_rows(values, date(2023, 4, 15), date(2023, 4, 15))

    def test_exact_energy_gap_allowlist(self):
        values = source([2016, 2018])
        for day, column in h.KNOWN_ENERGY_GAPS:
            row = h.make_rows(values, day, day)[0]
            self.assertEqual(row["date"], day.isoformat())
            self.assertIsNone(row["energy_gwh"][column])
        day = date(2016, 11, 9)
        values[2016]["other_renewables"][day] = None
        with self.assertRaisesRegex(h.ValidationError, "No dates dropped"):
            h.make_rows(values, day, day)

    def test_chunk_rejects_bad_dates_duplicates_and_numbers(self):
        stamp = ge.midnight_ms(date(2026, 1, 1))
        for points in ([], [[stamp + 1, 1]], [[stamp, 1], [stamp, 1]], [[stamp, True]],
                       [[stamp, float("inf")]], [[stamp, -1]], [[stamp, "1"]], [[stamp]]):
            with self.subTest(points=points), self.assertRaises(h.ValidationError):
                h.parse_chunk({"series": points}, 2026, "gas")
        with self.assertRaisesRegex(h.ValidationError, "nonzero nuclear"):
            h.parse_chunk({"series": [[stamp, 1]]}, 2026, "nuclear")

    def test_annual_selection_budget_absent_nuclear(self):
        urls = []
        client = Mock()

        def get(url):
            urls.append(url)
            series_id = int(url.split("/")[5])
            if url.endswith("index_day.json"):
                years = range(2015, 2025 if series_id == 1224 else 2027)
                return {"timestamps": [ge.midnight_ms(date(year, 1, 1)) for year in years]}
            stamp = int(url.split("_")[-1].removesuffix(".json"))
            return {"series": [[stamp, None if series_id == 1224 else 1]]}

        client.get.side_effect = get
        h.fetch_daily(client, list(range(2015, 2027)))
        self.assertEqual(len(urls), 182)
        self.assertTrue(all("_day" in url for url in urls))
        old_price = [url for url in urls if "251_DE_day_" in url]
        self.assertEqual(len(old_price), 4)
        urls.clear()
        h.fetch_daily(client, [2026])
        self.assertEqual(len(urls), 27)
        self.assertEqual(sum("index_day" in url for url in urls), 14)
        self.assertEqual(h.DailyClient.MAX_ATTEMPTS, 200)

    def test_bad_missing_index(self):
        for payload in ({}, {"timestamps": []}, {"timestamps": [True]}, {"timestamps": [1, 1]},
                        {"timestamps": [ge.midnight_ms(date(2026, 1, 2))]},
                        {"timestamps": [ge.midnight_ms(date(2025, 1, 1))]}):
            client = Mock()
            client.get.return_value = payload
            with self.subTest(payload=payload), self.assertRaises(h.ValidationError):
                h.fetch_daily(client, [2026])

    def test_overlap_rounding_and_partial_sums(self):
        rows = partition(2026, CUTOFF)["rows"]
        self.assertEqual(h.compare_hourly(rows, snapshot())["hourly_overlap_days"], 30)
        rows[-1]["energy_gwh"]["gas"] += 0.00012
        h.compare_hourly(rows, snapshot())
        rows[-1]["energy_gwh"]["gas"] = 12
        with self.assertRaisesRegex(h.ValidationError, "Daily/hourly mismatch"):
            h.compare_hourly(rows, snapshot())


class StorageFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.parts = {2025: partition(2025), 2026: partition(2026, CUTOFF)}
        self.manifest = h.make_manifest(self.parts, AS_OF)

    def publish(self):
        with h.writer_lock(self.directory):
            h.publish_history(self.directory, self.manifest, self.parts, None)

    def files(self):
        return {path.name: path.read_bytes() for path in self.directory.iterdir()}


class HistoryStorageTests(StorageFixture):
    def test_raw_hash_nochange_bytes_mtime(self):
        self.publish()
        before = self.files()
        mtimes = {p.name: p.stat().st_mtime_ns for p in self.directory.iterdir()}
        manifest, parts, raw = h.load_history(self.directory)
        self.assertEqual(parts, self.parts)
        self.assertEqual(manifest, self.manifest)
        with h.writer_lock(self.directory):
            self.assertFalse(h.publish_history(self.directory, manifest, parts, raw))
        self.assertEqual(self.files(), before)
        self.assertEqual(mtimes, {p.name: p.stat().st_mtime_ns for p in self.directory.iterdir()})

    def test_corrupt_existing_not_overwritten(self):
        self.publish()
        path = self.directory / Path(self.manifest["years"][0]["url"]).name
        path.write_bytes(b"{}")
        before = self.files()
        with self.assertRaises(h.ValidationError):
            h.load_history(self.directory)
        with self.assertRaises(h.ValidationError):
            h.publish_history(self.directory, self.manifest, self.parts, None)
        self.assertEqual(self.files(), before)

    def test_manifest_gap_path_hash_type_corruption(self):
        blobs = {year: h.canonical_bytes(p) for year, p in self.parts.items()}
        for key, value in (("url", "../outside.json"), ("sha256", "0" * 64), ("days", True), ("year", [])):
            broken = copy.deepcopy(self.manifest)
            broken["years"][0][key] = value
            (self.directory / "manifest.json").write_bytes(h.canonical_bytes(broken))
            with self.subTest(key=key), self.assertRaises(h.ValidationError):
                h.load_history(self.directory)
        parts = {2024: partition(2024), 2026: self.parts[2026]}
        with self.assertRaisesRegex(h.ValidationError, "History gap"):
            h.validate_history(h.make_manifest(parts, AS_OF), {y: h.canonical_bytes(p) for y, p in parts.items()})
        broken = copy.deepcopy(self.manifest)
        broken["last_date"] = "2026-09-07"
        with self.assertRaisesRegex(h.ValidationError, "coverage mismatch"):
            h.validate_history(broken, blobs)
        with self.assertRaisesRegex(h.ValidationError, "Duplicate JSON key"):
            h.strict_json(b'{"year":2015,"year":2016}')

    def test_manifest_last_failure_rolls_back_new_files(self):
        self.publish()
        before = self.files()
        self.parts[2025]["rows"][0]["energy_gwh"]["gas"] += 1
        self.parts[2026]["rows"][0]["energy_gwh"]["gas"] += 1
        manifest = h.make_manifest(self.parts, AS_OF)
        original = h.os.replace
        calls = []

        def replace(source_path, destination):
            calls.append(destination.name)
            self.assertEqual(h.load_history(self.directory)[0], self.manifest)
            if destination.name == "manifest.json":
                raise OSError("injected manifest failure")
            original(source_path, destination)

        with h.writer_lock(self.directory), patch.object(h.os, "replace", side_effect=replace):
            with self.assertRaisesRegex(OSError, "injected"):
                h.publish_history(self.directory, manifest, self.parts, before["manifest.json"])
        self.assertEqual(calls[-1], "manifest.json")
        self.assertEqual(len(calls), 3)
        self.assertEqual(self.files(), before)

    def test_stale_manifest_and_concurrent_writer(self):
        self.publish()
        with self.assertRaisesRegex(h.ValidationError, "Stale history"):
            h.publish_history(self.directory, self.manifest, self.parts, b"stale")
        with h.writer_lock(self.directory):
            with self.assertRaisesRegex(h.ValidationError, "already running"):
                with h.writer_lock(self.directory):
                    pass

    def test_bounded_versions_preserve_previous(self):
        self.publish()
        old_path = self.directory / Path(self.manifest["years"][-1]["url"]).name
        for revision in (1, 2, 3):
            previous, _, raw = h.load_history(self.directory)
            self.parts[2026]["rows"][-1]["energy_gwh"]["gas"] += revision
            manifest = h.make_manifest(self.parts, AS_OF, previous)
            with h.writer_lock(self.directory):
                h.publish_history(self.directory, manifest, self.parts, raw)
            self.assertEqual(len(list(self.directory.glob("2026.*.json"))), 2)
            if revision == 1:
                self.assertTrue(old_path.exists())
        self.assertFalse(old_path.exists())

    def test_strict_partition_metadata_nulls_flags(self):
        for key, value in (("hours", 23), ("nuclear_derived_zero", 1), ("price_zone", "DE-AT-LU")):
            part = copy.deepcopy(self.parts[2026])
            part["rows"][0][key] = value
            with self.subTest(key=key), self.assertRaises(h.ValidationError):
                h.validate_partition(part)
        part = copy.deepcopy(self.parts[2026])
        part["rows"][0]["energy_gwh"]["gas"] = None
        with self.assertRaises(h.ValidationError):
            h.validate_partition(part)


class RefreshTests(StorageFixture):
    def run_history(self, mode="refresh", as_of=AS_OF, cutoff=CUTOFF, **kwargs):
        with patch.object(h, "recent_snapshot", return_value=(snapshot(cutoff), cutoff)), \
             patch.object(h, "fetch_daily", side_effect=lambda client, years: source(years)) as fetch, \
             patch("sys.stdout", new_callable=io.StringIO):
            result = h.run(mode, as_of, self.directory, **kwargs)
            return result, fetch

    def test_refresh_revises_only_latest35_days_and_appends(self):
        self.parts[2026] = partition(2026, CUTOFF - timedelta(days=1))
        self.parts[2026]["rows"][0]["energy_gwh"]["gas"] = 1
        self.parts[2026]["rows"][-1]["energy_gwh"]["gas"] = 1
        boundary = CUTOFF - timedelta(days=34)
        for row in self.parts[2026]["rows"]:
            if row["date"] in ((boundary - timedelta(days=1)).isoformat(), boundary.isoformat()):
                row["energy_gwh"]["gas"] = 2
        self.manifest = h.make_manifest(self.parts, AS_OF)
        self.publish()
        frozen_raw = self.files()[Path(self.manifest["years"][0]["url"]).name]
        result, fetch = self.run_history()
        self.assertEqual(result["years_fetched"], [2026])
        self.assertEqual(fetch.call_count, 1)
        manifest, parts, _ = h.load_history(self.directory)
        self.assertEqual(parts[2026]["rows"][0]["energy_gwh"]["gas"], 1)
        self.assertEqual(parts[2026]["rows"][-2]["energy_gwh"]["gas"], 24)
        self.assertEqual(parts[2026]["rows"][-1]["date"], CUTOFF.isoformat())
        by_date = {row["date"]: row for row in parts[2026]["rows"]}
        self.assertEqual(by_date[(boundary - timedelta(days=1)).isoformat()]["energy_gwh"]["gas"], 2)
        self.assertEqual(by_date[boundary.isoformat()]["energy_gwh"]["gas"], 24)
        self.assertEqual(frozen_raw, self.files()[Path(manifest["years"][0]["url"]).name])
        before = self.files()
        result, _ = self.run_history()
        self.assertEqual(result["status"], "unchanged")
        self.assertEqual(before, self.files())

    def test_backfill_skips_existing_unless_reconcile(self):
        self.parts[2025]["rows"][0]["energy_gwh"]["gas"] = 1
        self.manifest = h.make_manifest(self.parts, AS_OF)
        self.publish()
        result, fetch = self.run_history("backfill", start_year=2025, end_year=2025)
        self.assertEqual(result["status"], "unchanged")
        fetch.assert_not_called()
        self.run_history("backfill", start_year=2025, end_year=2025, reconcile=True)
        self.assertEqual(h.load_history(self.directory)[1][2025]["rows"][0]["energy_gwh"]["gas"], 24)

    def test_refresh_preserves_closed_versions_after_reconcile(self):
        self.parts[2025]["rows"][0]["energy_gwh"]["gas"] = 1
        self.parts[2026]["rows"][-1]["energy_gwh"]["gas"] = 1
        self.manifest = h.make_manifest(self.parts, AS_OF)
        self.publish()
        old_closed = self.directory / Path(self.manifest["years"][0]["url"]).name
        old_current = self.directory / Path(self.manifest["years"][-1]["url"]).name
        old_closed_raw = old_closed.read_bytes()
        result, _ = self.run_history("backfill", start_year=2025, end_year=2025, reconcile=True)
        self.assertEqual(result["status"], "changed")
        self.assertEqual(old_closed.read_bytes(), old_closed_raw)
        closed = {p.name: (p.read_bytes(), p.stat().st_mtime_ns)
                  for p in self.directory.glob("2025.*.json")}
        self.assertEqual(len(closed), 2)

        for cutoff, status in ((CUTOFF, "changed"), (CUTOFF, "unchanged"),
                               (CUTOFF + timedelta(days=1), "changed")):
            with self.subTest(cutoff=cutoff, status=status):
                before = self.files()
                result, _ = self.run_history(cutoff=cutoff)
                self.assertEqual(result["status"], status)
                self.assertEqual(result["years_fetched"], [2026])
                self.assertEqual(closed, {p.name: (p.read_bytes(), p.stat().st_mtime_ns)
                                         for p in self.directory.glob("2025.*.json")})
                self.assertEqual(old_closed.read_bytes(), old_closed_raw)
                if status == "unchanged":
                    self.assertEqual(self.files(), before)
                self.assertEqual(len(list(self.directory.glob("2026.*.json"))), 2)
        self.assertFalse(old_current.exists())

    def test_explicit_reconcile_cleans_superseded_closed_versions(self):
        self.parts[2025]["rows"][0]["energy_gwh"]["gas"] = 1
        self.manifest = h.make_manifest(self.parts, AS_OF)
        self.publish()
        old_closed = self.directory / Path(self.manifest["years"][0]["url"]).name
        self.run_history("backfill", start_year=2025, end_year=2025, reconcile=True)
        previous = h.load_history(self.directory)[0]
        previous_closed = self.directory / Path(previous["years"][0]["url"]).name
        self.assertTrue(old_closed.exists())
        values = source([2025])
        values[2025]["gas"][date(2025, 1, 1)] = 25000
        with patch.object(h, "fetch_daily", return_value=values), \
             patch("sys.stdout", new_callable=io.StringIO):
            result = h.run("backfill", AS_OF, self.directory,
                           start_year=2025, end_year=2025, reconcile=True)
        self.assertEqual(result["status"], "changed")
        self.assertFalse(old_closed.exists())
        self.assertTrue(previous_closed.exists())
        self.assertEqual(len(list(self.directory.glob("2025.*.json"))), 2)

    def test_missing_history_gaps_stale_snapshot_fail(self):
        with self.assertRaisesRegex(h.ValidationError, "Missing history"):
            self.run_history()
        self.parts[2026] = partition(2026, date(2026, 6, 1))
        self.manifest = h.make_manifest(self.parts, AS_OF)
        self.publish()
        before = self.files()
        with self.assertRaisesRegex(h.ValidationError, "backfill"):
            self.run_history()
        self.assertEqual(before, self.files())
        path = self.directory / "recent.json"
        path.write_bytes(h.canonical_bytes(snapshot()))
        with self.assertRaisesRegex(h.ValidationError, "stale/ahead"):
            h.recent_snapshot(path, date(2026, 9, 20))

    def test_january_freezes_closed_year_and_rejects_unfinished_year(self):
        self.parts = {2025: partition(2025)}
        self.parts[2025]["rows"][-1]["energy_gwh"]["gas"] = 5
        self.manifest = h.make_manifest(self.parts, date(2025, 12, 31))
        self.publish()
        before = self.files()
        self.run_history(as_of=date(2026, 1, 5), cutoff=date(2026, 1, 3))
        manifest, parts, _ = h.load_history(self.directory)
        self.assertEqual(parts[2025]["rows"][-1]["energy_gwh"]["gas"], 5)
        self.assertTrue(manifest["years"][0]["frozen"])
        name = Path(manifest["years"][0]["url"]).name
        self.assertEqual(before[name], self.files()[name])
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            parts = {2025: partition(2025, date(2025, 12, 30))}
            h.publish_history(directory, h.make_manifest(parts, date(2025, 12, 31)), parts, None)
            with patch.object(h, "recent_snapshot", return_value=(snapshot(date(2026, 1, 3)), date(2026, 1, 3))):
                with self.assertRaisesRegex(h.ValidationError, "closed years are frozen"):
                    h.run("refresh", date(2026, 1, 5), directory)

    def test_january_first_no_previous_year_fetch(self):
        self.parts = {2025: partition(2025)}
        self.manifest = h.make_manifest(self.parts, date(2025, 12, 31))
        self.publish()
        result, fetch = self.run_history(as_of=date(2026, 1, 1), cutoff=date(2025, 12, 31))
        fetch.assert_not_called()
        self.assertEqual(result["years_fetched"], [])
        self.assertTrue(h.load_history(self.directory)[0]["years"][0]["frozen"])

    def test_fetch_and_daily_validation_failure_preserve_full_set(self):
        self.publish()
        before = self.files()
        bad_values = source([2026])
        bad_values[2026]["gas"][CUTOFF] = None
        for failure in (h.ValidationError("source unavailable"), bad_values):
            mock = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
            with patch.object(h, "recent_snapshot", return_value=(snapshot(), CUTOFF)), \
                 patch.object(h, "fetch_daily", **mock), patch("sys.stdout", new_callable=io.StringIO):
                with self.assertRaises(h.ValidationError):
                    h.run("refresh", AS_OF, self.directory)
            self.assertEqual(before, self.files())


if __name__ == "__main__":
    unittest.main()
