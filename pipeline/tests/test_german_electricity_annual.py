"""Annual-only acquisition, coherent contracts, daily comparisons and frozen writes."""

import copy
from datetime import date
import io
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from src.data_pipelines.dashboards.german_electricity import annual as a
from src.data_pipelines.dashboards.german_electricity import history as h
from src.data_pipelines.dashboards.german_electricity import pipeline as p


def rows(years=a.YEARS):
    return [{"year": year, "energy_gwh": {key: 20_000.0 for key in a.SERIES},
             "method": "source_annual_aggregate"} for year in years]


def partitions():
    result = {}
    for year in range(2016, 2019):
        daily = []
        count = (date(year + 1, 1, 1) - date(year, 1, 1)).days
        for day in h.days(date(year, 1, 1), date(year, 12, 31)):
            daily.append({"date": day.isoformat(), "hours": h.hours(day),
                          "energy_gwh": {key: None if (day, key) in h.KNOWN_ENERGY_GAPS else 20_000 / count
                                         for key in h.ENERGY},
                          "price_eur_mwh": 30, "price_zone": "DE-AT-LU" if day < h.PRICE_SPLIT else "DE-LU",
                          "nuclear_derived_zero": False})
        result[year] = h.partition(year, daily)
    return result


class SourceTests(unittest.TestCase):
    def test_annual_units_all_categories_leap_and_regular_years(self):
        self.assertEqual(a.year_hours(2016), 8784)
        self.assertEqual(a.year_hours(2018), 8760)
        self.assertEqual(a.SERIES, {k: v for k, v in h.ENERGY.items() if k != "load"})
        self.assertEqual(len(a.SERIES), 12)
        for year, key, mwh, gwh in ((2016, "other_renewables", 1835926.08, 1835.92608),
                                    (2018, "pumped_storage", 8804806.38, 8804.80638)):
            self.assertEqual(a.parse_chunk({"series": [[a.midnight_ms(date(year, 1, 1)), mwh]]}, year, key), gwh)

    def test_invalid_observations_and_duplicate_even_identical(self):
        stamp = a.midnight_ms(date(2016, 1, 1))
        for points in ([], [[stamp, 1], [stamp, 1]], [[stamp + 1, 1]], [[True, 1]],
                       [[a.midnight_ms(date(2018, 1, 1)), 1]], [[stamp]], [[stamp, None]],
                       [[stamp, True]], [[stamp, "1"]], [[stamp, -1]], [[stamp, float("nan")]],
                       [[stamp, float("inf")]], [[stamp, 2e9]]):
            with self.subTest(points=points), self.assertRaises(a.ValidationError):
                a.parse_chunk({"series": points}, 2016, "nuclear")
        with self.assertRaises(a.ValidationError):
            a.AnnualClient.JSON_DECODER(b'{"series":[],"series":[]}')

    def test_invalid_indices_and_explicit_selection(self):
        for payload in ({}, {"timestamps": []}, {"timestamps": [True]}, {"timestamps": [1, 1]},
                        {"timestamps": [a.midnight_ms(date(2016, 1, 2))]}, {"timestamps": [10**99]}):
            with self.subTest(payload=payload), self.assertRaises(a.ValidationError):
                a.parse_index(payload, "nuclear")
        for years in ([], [2016, 2016], [2017], [2016.0], [True], [2026]):
            with self.subTest(years=years), self.assertRaises(a.ValidationError):
                a.selected_years(years)
        client = Mock(get=Mock(return_value={"timestamps": [a.midnight_ms(date(2016, 1, 1))]}))
        with self.assertRaisesRegex(a.ValidationError, "absent from index"):
            a.fetch_annual(client, [2018])
        self.assertTrue(all(url.args[0].endswith("index_year.json") for url in client.get.call_args_list))

    def test_only_yearly_requests_max_three_workers_and_stable_selection(self):
        urls, active, maximum = [], 0, 0
        lock = threading.Lock()

        def get(url):
            nonlocal active, maximum
            with lock:
                urls.append(url)
                active += 1
                maximum = max(maximum, active)
            time.sleep(0.002)
            with lock:
                active -= 1
            if url.endswith("index_year.json"):
                return {"timestamps": [a.midnight_ms(date(year, 1, 1)) for year in range(2015, 2027)]}
            stamp = int(url.split("_")[-1][:-5])
            return {"series": [[stamp, 20_000_000]]}

        client = Mock(get=Mock(side_effect=get))
        self.assertEqual(a.fetch_annual(client, [2018, 2016]), rows())
        self.assertEqual(len(urls), 36)
        self.assertEqual(sum(url.endswith("index_year.json") for url in urls), 12)
        self.assertTrue(all("/DE/" in url and ("/index_year" in url or "_DE_year_" in url) for url in urls))
        self.assertEqual({int(url.split("/")[5]) for url in urls}, set(a.SERIES.values()))
        self.assertGreater(maximum, 1)
        self.assertLessEqual(maximum, 3)
        urls.clear()
        self.assertEqual(a.fetch_annual(client, [2018]), rows([2018]))
        self.assertEqual(len(urls), 24)
        urls.clear()
        self.assertEqual(a.fetch_annual(client, []), [])
        self.assertEqual(urls, [])

    def test_real_http_client_retry_deadline_attempt_and_byte_budgets(self):
        client = a.AnnualClient()
        self.assertEqual((client.MAX_ATTEMPTS, client.FETCH_TIMEOUT), (48, 60))
        with patch.object(p, "urlopen", side_effect=URLError("offline")) as network, patch.object(p.time, "sleep"):
            with self.assertRaises(a.ValidationError):
                client.get("https://www.smard.de/test")
        self.assertEqual(network.call_count, 3)
        self.assertTrue(all(0 < call.kwargs["timeout"] <= 15 for call in network.call_args_list))
        client.requests = 47
        with patch.object(p, "urlopen", side_effect=URLError("offline")) as network, patch.object(p.time, "sleep"):
            with self.assertRaisesRegex(a.ValidationError, "budget"):
                client.get("https://www.smard.de/test")
        self.assertEqual(client.requests, 48)
        self.assertEqual(network.call_count, 1)
        client = a.AnnualClient()
        client.started -= 61
        with patch.object(p, "urlopen") as network, self.assertRaisesRegex(a.ValidationError, "budget"):
            client.get("https://www.smard.de/test")
        network.assert_not_called()
        for body, total in ((b'{"series":[],"series":[]}', 0), (b"x" * 16_001, 0), (b"{}", 200_000)):
            response = Mock()
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            response.read1.side_effect = [body, b""]
            client = a.AnnualClient()
            client.bytes_downloaded = total
            with patch.object(p, "urlopen", return_value=response), self.assertRaises(a.ValidationError):
                client.get("https://www.smard.de/test")
        with patch.object(p, "urlopen", side_effect=HTTPError("url", 404, "missing", {}, None)) as network:
            with self.assertRaises(a.ValidationError):
                a.AnnualClient().get("https://www.smard.de/test")
        self.assertEqual(network.call_count, 1)


class ContractTests(unittest.TestCase):
    def test_exact_schema_hash_sorted_unique_years_and_numeric_bounds(self):
        value = a.snapshot(rows())
        mutations = [lambda v: v.update(schema_version=True), lambda v: v.update(region="DE-LU"),
                     lambda v: v.update(source={}), lambda v: v.update(resolution="day"),
                     lambda v: v.update(snapshot_created_at="2026-09-10"),
                     lambda v: v.update(content_hash="0" * 64), lambda v: v["years"].reverse(),
                     lambda v: v["years"].__setitem__(1, copy.deepcopy(v["years"][0])),
                     lambda v: v["years"][0].update(method="daily_sum"),
                     lambda v: v["years"][0]["energy_gwh"].pop("nuclear"),
                     lambda v: v["years"][0]["energy_gwh"].update(load=100),
                     lambda v: v["years"][0]["energy_gwh"].update(nuclear=None),
                     lambda v: v["years"][0]["energy_gwh"].update(nuclear=True),
                     lambda v: v["years"][0]["energy_gwh"].update(nuclear=-1),
                     lambda v: v["years"][0]["energy_gwh"].update(nuclear=float("inf")),
                     lambda v: v["years"][0].update(energy_gwh={k: 0 for k in a.SERIES}),
                     lambda v: v["years"][0].update(energy_gwh={k: 200_000 for k in a.SERIES})]
        for mutate in mutations:
            changed = copy.deepcopy(value)
            mutate(changed)
            with self.subTest(value=changed), self.assertRaises(a.ValidationError):
                a.validate_snapshot(changed)
        self.assertEqual(a.digest(value), a.digest({**value, "content_hash": "ignored"}))
        self.assertFalse(a.canonical_bytes(value).endswith(b"\n"))

    def test_all_daily_differences_reported_without_mutation_or_residual_imputation(self):
        daily = partitions()
        original = copy.deepcopy(daily)
        metrics = {}
        a.compare_daily(rows(), daily, metrics)
        report = metrics["daily_comparison"]
        self.assertEqual(len(report), 24)
        self.assertEqual(sum(item["missing_days"] for item in report), 5)
        self.assertEqual(sum(not item["within_rounding"] for item in report), 2)
        self.assertEqual(daily, original)
        # Large positive source-resolution differences are diagnostic, not imputed days.
        fresh = rows()
        fresh[0]["energy_gwh"]["gas"] += 100
        a.compare_daily(fresh, daily, {})
        fresh[0]["energy_gwh"]["gas"] = 20_000 - 0.001
        a.compare_daily(fresh, daily, {})
        fresh[0]["energy_gwh"]["gas"] = 20_000 - 0.01
        metrics = {}
        with self.assertRaisesRegex(a.ValidationError, "below known daily"):
            a.compare_daily(fresh, daily, metrics)
        self.assertEqual(len(metrics["daily_comparison"]), 24)

    def test_missing_or_partial_calendar_history_blocks_comparison(self):
        for daily in ({}, {2016: {"rows": [{"date": "2016-12-30"}]}}):
            with self.assertRaisesRegex(a.ValidationError, "full-calendar"):
                a.compare_daily(rows(), daily, {})


class StorageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.output = self.directory / "annual.json"
        self.history = self.directory / "history"
        self.history.mkdir()
        daily = partitions()
        h.publish_history(self.history, h.make_manifest(daily, date(2026, 9, 10)), daily, None)
        self.history_bytes = {path.name: path.read_bytes() for path in self.history.iterdir()}
        self.addCleanup(patch.stopall)
        self.fetch = patch.object(a, "fetch_annual", side_effect=lambda client, years: rows(years)).start()
        patch("sys.stdout", new_callable=io.StringIO).start()

    def run_annual(self, **kwargs):
        return a.run(output=self.output, history_directory=self.history, **kwargs)

    def test_initial_backfill_no_fetch_rerun_preserves_bytes_mtime_and_daily_history(self):
        first = self.run_annual()
        self.assertEqual(first["years_fetched"], [2016, 2018])
        raw, mtime = self.output.read_bytes(), self.output.stat().st_mtime_ns
        second = self.run_annual()
        self.assertEqual(second["status"], "unchanged")
        self.assertEqual(second["years_fetched"], [])
        self.assertEqual((self.output.read_bytes(), self.output.stat().st_mtime_ns), (raw, mtime))
        self.assertEqual(self.history_bytes, {path.name: path.read_bytes() for path in self.history.iterdir()})

    def test_subset_addition_and_only_explicit_selected_reconciliation(self):
        self.run_annual(years=[2018])
        self.assertEqual([row["year"] for row in a.load_snapshot(self.output)[0]["years"]], [2018])
        self.assertEqual(self.run_annual()["years_fetched"], [2016])
        previous = a.load_snapshot(self.output)[0]
        def revised(client, years):
            result = rows(years)
            for row in result:
                row["energy_gwh"]["nuclear"] += 1
            return result
        self.fetch.side_effect = revised
        self.assertEqual(self.run_annual(years=[2016], reconcile=True)["years_fetched"], [2016])
        new = a.load_snapshot(self.output)[0]
        self.assertEqual(new["years"][1], previous["years"][1])
        self.assertEqual(new["years"][0]["energy_gwh"]["nuclear"], 20_001)

    def test_corrupt_or_noncanonical_existing_even_reconcile_blocks_fetch(self):
        valid = a.canonical_bytes(a.snapshot(rows()))
        for raw in (b"broken", valid + b"\n", valid.replace(b'"schema_version":1', b'"schema_version":1,"schema_version":1'),
                    valid.replace(b'20000.0', b'21000.0', 1)):
            self.output.write_bytes(raw)
            self.fetch.reset_mock()
            with self.assertRaises(a.ValidationError):
                self.run_annual(reconcile=True)
            self.fetch.assert_not_called()
            self.assertEqual(self.output.read_bytes(), raw)

    def test_corrupt_history_blocks_fetch_and_preserves_previous(self):
        self.run_annual()
        raw = self.output.read_bytes()
        path = next(path for path in self.history.iterdir() if path.name.startswith("2016."))
        path.write_bytes(b"broken")
        self.fetch.reset_mock()
        with self.assertRaises(a.ValidationError):
            self.run_annual(reconcile=True)
        self.fetch.assert_not_called()
        self.assertEqual(self.output.read_bytes(), raw)

    def test_fetch_validation_and_atomic_replace_failures_preserve_previous(self):
        self.run_annual()
        raw = self.output.read_bytes()
        self.fetch.side_effect = a.ValidationError("source unavailable")
        with self.assertRaises(a.ValidationError):
            self.run_annual(reconcile=True)
        self.assertEqual(self.output.read_bytes(), raw)
        bad = rows()
        bad[0]["energy_gwh"].pop("nuclear")
        self.fetch.side_effect = lambda client, years: bad
        with self.assertRaises(a.ValidationError):
            self.run_annual(reconcile=True)
        self.assertEqual(self.output.read_bytes(), raw)
        changed = rows()
        changed[0]["energy_gwh"]["nuclear"] += 1
        self.fetch.side_effect = lambda client, years: changed
        with patch.object(h.os, "replace", side_effect=OSError("replace failed")), self.assertRaises(OSError):
            self.run_annual(reconcile=True)
        self.assertEqual(self.output.read_bytes(), raw)
        self.assertEqual(sorted(path.name for path in self.directory.iterdir()), ["annual.json", "history"])

    def test_locks_stale_output_and_changed_history_abort(self):
        self.run_annual()
        raw = self.output.read_bytes()
        with h.writer_lock(self.directory), self.assertRaisesRegex(a.ValidationError, "writer already"):
            self.run_annual(reconcile=True)
        with self.assertRaisesRegex(a.ValidationError, "Stale annual"):
            a.publish(a.snapshot(rows()), self.output, b"stale")
        def changed_history(client, years):
            (self.history / "manifest.json").write_bytes(b"concurrent change")
            return rows(years)
        self.fetch.side_effect = changed_history
        with self.assertRaisesRegex(a.ValidationError, "History manifest changed"):
            self.run_annual(reconcile=True)
        self.assertEqual(self.output.read_bytes(), raw)

    def test_no_refresh_or_unapproved_years_or_symlink_outputs(self):
        for kwargs in ({"mode": "refresh"}, {"years": [2017]}, {"years": [2016, 2016]}):
            with self.assertRaises(a.ValidationError):
                self.run_annual(**kwargs)
        self.fetch.assert_not_called()
        self.output.symlink_to(self.directory / "missing.json")
        with self.assertRaisesRegex(a.ValidationError, "symlink"):
            self.run_annual()
        self.fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
