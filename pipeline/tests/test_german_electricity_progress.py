"""Compact CSV mapping, completed periods, bounded transport and atomic snapshots."""

import copy
import csv
from datetime import date
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from src.data_pipelines.dashboards.german_electricity import progress as g
from src.data_pipelines.dashboards.german_electricity import pipeline as p
from src.data_pipelines.dashboards.german_electricity import history as h


AS_OF = date(2026, 9, 10)


def source_rows(last_month="2026-05"):
    # Real source anchors, synthetic intermediate observations; no raw download fixture.
    rows = [[f"unrelated-{i}", "a header; and\nfooter", "not numeric"] for i in range(128)]
    for year in range(2011, 2027):
        values = ["100"] * 18
        values[5], values[7], values[12:15] = "2900", "9902", ["104856", "68112", "9733"]
        rows.append([g.CAPACITY_GROUP, str(year), *values])
    rows.extend([[g.ANNUAL_GROUP, str(year), "30327", "3058"] for year in range(2015, 2026)])
    for group, energy, cost in ((g.MONTHLY_GROUP, "1119.86", "187.91"),
                                (g.REDISPATCH_GROUP, "868.87", "75.50")):
        for index in range(g.month_index("2022-07"), g.month_index(last_month) + 1):
            year, month = divmod(index, 12)
            rows.append([group, f"{year}-{month + 1:02}-01", energy, cost])
    return rows


def encode(rows):
    stream = io.StringIO(newline="")
    csv.writer(stream, delimiter=";", lineterminator="\r\n").writerows(rows)
    return stream.getvalue().encode()


def client(raw=None):
    return Mock(get=Mock(return_value=raw if raw is not None else encode(source_rows())),
                requests=1, bytes_downloaded=1234)


def response(body):
    result = Mock()
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
    result.read1.side_effect = [body, b""]
    return result


class SourceTests(unittest.TestCase):
    def test_verified_mapping_units_and_independent_coverage(self):
        value = g.snapshot(encode(source_rows()), AS_OF)
        self.assertEqual(value["capacity"]["rows"][-1], {
            "year": 2025, "solar_gw": 104.856, "wind_onshore_gw": 68.112,
            "wind_offshore_gw": 9.733, "battery_gw": 2.9, "pumped_storage_gw": 9.902})
        self.assertEqual(len(value["capacity"]["rows"]), 15)
        self.assertEqual(len(value["congestion"]["annual"]), 11)
        self.assertEqual(value["congestion"]["annual"][-1],
                         {"year": 2025, "energy_gwh": 30327, "cost_million_eur": 3058})
        self.assertEqual(len(value["congestion"]["monthly"]), 47)
        self.assertEqual(value["congestion"]["monthly"][-1], {
            "month": "2026-05", "energy_gwh": 1119.86, "cost_million_eur": 187.91,
            "redispatch_energy_gwh": 868.87, "redispatch_cost_million_eur": 75.5})
        # A column-by-column sentinel makes an accidental mapping/order change visible.
        rows = source_rows()
        for row in rows:
            if row[0] == g.CAPACITY_GROUP:
                row[2:] = [str(i * 1000) for i in range(18)]
        last = g.snapshot(encode(rows), AS_OF)["capacity"]["rows"][-1]
        self.assertEqual([last[k] for k in ("solar_gw", "wind_onshore_gw", "wind_offshore_gw",
                                          "battery_gw", "pumped_storage_gw")], [12, 13, 14, 5, 7])

    def test_completed_calendar_cutoffs_rollover_and_capacity_pin(self):
        rows = source_rows("2026-09")
        rows.append([g.ANNUAL_GROUP, "2026", "1", "2"])
        value = g.snapshot(encode(rows), AS_OF)
        self.assertEqual(value["congestion"]["monthly_through"], "2026-08")
        self.assertEqual(value["congestion"]["annual_through"], "2025-12-31")
        rows = source_rows("2027-01")
        rows.append([g.ANNUAL_GROUP, "2026", "30000", "3000"])
        value = g.snapshot(encode(rows), date(2027, 1, 1))
        self.assertEqual(value["congestion"]["monthly_through"], "2026-12")
        self.assertEqual(value["congestion"]["annual_through"], "2026-12-31")
        self.assertEqual(value["capacity"]["data_through"], "2025-12-31")

    def test_missing_groups_group_count_and_truncated_baseline(self):
        for group in g.GROUPS:
            rows = [r for r in source_rows() if r[0] != group]
            with self.subTest(group=group), self.assertRaises(g.ValidationError):
                g.snapshot(encode(rows), AS_OF)
        for rows in (source_rows()[1:], source_rows() + [["new-group", "x"]],
                     [r for r in source_rows() if r[:2] != [g.CAPACITY_GROUP, "2025"]],
                     [r for r in source_rows() if r[:2] != [g.ANNUAL_GROUP, "2025"]],
                     source_rows("2026-04")):
            with self.assertRaises(g.ValidationError):
                g.snapshot(encode(rows), AS_OF)

    def test_all_selected_columns_strict_even_excluded_current_year(self):
        for token in ("", "null", "NaN", "Infinity", "-1", "1,2", "1e3", "1x", " 12", "1000001"):
            rows = source_rows()
            row = next(r for r in rows if r[:2] == [g.CAPACITY_GROUP, "2026"])
            row[2] = token  # Unexported category in an unexported year still fails.
            with self.subTest(token=token), self.assertRaises(g.ValidationError):
                g.snapshot(encode(rows), AS_OF)
        for extra in ([], ["0", "0"]):
            rows = source_rows()
            row = next(r for r in rows if r[0] == g.CAPACITY_GROUP)
            row[2:3] = extra
            with self.assertRaisesRegex(g.ValidationError, "column count"):
                g.snapshot(encode(rows), AS_OF)

    def test_period_duplicates_gaps_order_dates_and_monthly_alignment(self):
        for token in ("2022-07-02", "2022-7-01", "2022-13-01", "2022-06-01", "2027-01-01"):
            rows = source_rows()
            next(r for r in rows if r[0] == g.MONTHLY_GROUP)[1] = token
            with self.subTest(token=token), self.assertRaises(g.ValidationError):
                g.snapshot(encode(rows), AS_OF)
        for group in g.GROUPS:
            original = source_rows()
            indices = [i for i, r in enumerate(original) if r[0] == group]
            for mode in ("duplicate", "gap", "order"):
                rows = copy.deepcopy(original)
                if mode == "duplicate":
                    rows.insert(indices[1], rows[indices[0]])
                elif mode == "gap":
                    rows.pop(indices[1])
                else:
                    rows[indices[0]], rows[indices[1]] = rows[indices[1]], rows[indices[0]]
                with self.subTest(group=group, mode=mode), self.assertRaises(g.ValidationError):
                    g.snapshot(encode(rows), AS_OF)
        rows = [r for r in source_rows() if r[:2] != [g.REDISPATCH_GROUP, "2026-05-01"]]
        with self.assertRaisesRegex(g.ValidationError, "periods differ"):
            g.snapshot(encode(rows), AS_OF)

    def test_csv_quoting_bom_unrelated_rows_zero_and_malformed_payload(self):
        rows = source_rows()
        next(r for r in rows if r[0] == g.CAPACITY_GROUP)[7] = "0"
        value = g.snapshot(b"\xef\xbb\xbf" + encode(rows), AS_OF)
        self.assertEqual(value["capacity"]["rows"][0]["battery_gw"], 0)
        for raw in (b"", b"\xff", b'<html>error</html>', b'"unterminated', b"x" * (g.CSV_LIMIT + 1)):
            with self.subTest(raw=raw[:20]), self.assertRaises(g.ValidationError):
                g.snapshot(raw, AS_OF)


class TransportTests(unittest.TestCase):
    def test_one_get_raw_csv_and_no_discovery(self):
        raw = encode(source_rows())
        with patch.object(p, "urlopen", return_value=response(raw)) as network:
            c = g.ProgressClient()
            self.assertEqual(c.get(g.CSV_URL), raw)
        self.assertEqual(network.call_count, 1)
        self.assertEqual(network.call_args.args[0].full_url, g.CSV_URL)
        self.assertEqual(c.bytes_downloaded, len(raw))

    def test_retry_attempt_timeout_and_permanent_error_bounds(self):
        with patch.object(p, "urlopen", side_effect=URLError("offline")) as network, patch.object(p.time, "sleep"):
            c = g.ProgressClient()
            with self.assertRaises(g.ValidationError):
                c.get(g.CSV_URL)
        self.assertEqual(network.call_count, 3)
        self.assertTrue(all(0 < call.kwargs["timeout"] <= 15 for call in network.call_args_list))
        with patch.object(p, "urlopen") as network, self.assertRaisesRegex(g.ValidationError, "budget"):
            c.get(g.CSV_URL)
        network.assert_not_called()
        for code, attempts in ((404, 1), (403, 1), (429, 3), (503, 3)):
            errors = [HTTPError("url", code, "error", {}, io.BytesIO()) for _ in range(attempts)]
            with patch.object(p, "urlopen", side_effect=errors) as network, patch.object(p.time, "sleep"):
                with self.assertRaises(g.ValidationError):
                    g.ProgressClient().get(g.CSV_URL)
            self.assertEqual(network.call_count, attempts)

    def test_deadline_streaming_and_byte_budgets(self):
        c = g.ProgressClient()
        c.started -= 16
        with patch.object(p, "urlopen") as network, self.assertRaisesRegex(g.ValidationError, "budget"):
            c.get(g.CSV_URL)
        network.assert_not_called()
        c = g.ProgressClient()
        c.started = 0
        with patch.object(p.time, "monotonic", side_effect=[1, 16]), patch.object(p, "urlopen", return_value=response(b"x")):
            with self.assertRaisesRegex(g.ValidationError, "time budget"):
                c.get(g.CSV_URL)
        for body, total in ((b"x" * (g.CSV_LIMIT + 1), 0), (b"x", g.CSV_LIMIT)):
            c = g.ProgressClient()
            c.bytes_downloaded = total
            with patch.object(p, "urlopen", return_value=response(body)), self.assertRaisesRegex(g.ValidationError, "byte budget"):
                c.get(g.CSV_URL)


class SnapshotTests(unittest.TestCase):
    def test_statutory_baseline_exact_separate_and_no_inferred_targets(self):
        value = g.snapshot(encode(source_rows()), AS_OF)
        self.assertEqual([r["capacity_gw"] for r in value["targets"]["solar"]["rows"]], [88, 128, 172, 215, 309, 400])
        self.assertEqual([r["capacity_gw"] for r in value["targets"]["wind_onshore"]["rows"]], [69, 84, 99, 115, 157, 160])
        self.assertEqual(value["targets"]["wind_offshore"]["comparison"], "at_least")
        self.assertEqual(value["targets"]["wind_offshore"]["rows"], [
            {"year": 2030, "capacity_gw": 30}, {"year": 2035, "capacity_gw": 40}, {"year": 2045, "capacity_gw": 70}])
        self.assertFalse(g.canonical_bytes(value).endswith(b"\n"))
        self.assertEqual(g.digest(value), g.digest({**value, "content_hash": "ignored"}))

    def test_strict_contract_even_with_recomputed_hash(self):
        original = g.snapshot(encode(source_rows()), AS_OF)
        mutations = [lambda v: v.update(schema_version=True), lambda v: v.update(source={}),
                     lambda v: v.update(retrieved_at="2026-09-10"),
                     lambda v: v["capacity"].update(provisional=1),
                     lambda v: v["capacity"].update(data_through="2026-06-26"),
                     lambda v: v["capacity"]["rows"].reverse(),
                     lambda v: v["capacity"]["rows"][0].update(year=2011.0),
                     lambda v: v["capacity"]["rows"][0].update(battery_gw=None),
                     lambda v: v["capacity"]["rows"][0].update(battery_gw=True),
                     lambda v: v["capacity"]["rows"][0].update(battery_gw=-1),
                     lambda v: v["targets"]["solar"]["rows"][0].update(capacity_gw=89),
                     lambda v: v["targets"]["solar"]["rows"][0].update(capacity_gw=True),
                     lambda v: v["congestion"].update(monthly_through="2026-06"),
                     lambda v: v["congestion"].update(units={}),
                     lambda v: v["congestion"]["monthly"][0].update(energy_gwh="1")]
        for mutate in mutations:
            value = copy.deepcopy(original)
            mutate(value)
            value["content_hash"] = g.digest(value)
            with self.assertRaises(g.ValidationError):
                g.validate_snapshot(value, AS_OF)
        for bad in (float("inf"), float("nan")):
            value = copy.deepcopy(original)
            value["capacity"]["rows"][0]["solar_gw"] = bad
            with self.assertRaises(g.ValidationError):
                g.validate_snapshot(value, AS_OF)

    def test_refresh_nochange_revision_failure_and_existing_corruption(self):
        with tempfile.TemporaryDirectory() as directory, patch("sys.stdout", new_callable=io.StringIO):
            output = Path(directory) / "progress.json"
            c = client()
            self.assertEqual(g.run(output=output, client=c, as_of=AS_OF)["status"], "changed")
            c.get.assert_called_once_with(g.CSV_URL)
            raw, mtime = output.read_bytes(), output.stat().st_mtime_ns
            self.assertEqual(g.run(output=output, client=client(), as_of=AS_OF)["status"], "unchanged")
            self.assertEqual((output.read_bytes(), output.stat().st_mtime_ns), (raw, mtime))
            for c in (client(b"bad"), Mock(get=Mock(side_effect=g.ValidationError("offline")), requests=3, bytes_downloaded=0)):
                with self.assertRaises(g.ValidationError):
                    g.run(output=output, client=c, as_of=AS_OF)
                self.assertEqual(output.read_bytes(), raw)
            rows = source_rows()
            next(r for r in rows if r[:2] == [g.ANNUAL_GROUP, "2025"])[2] = "30328"
            self.assertEqual(g.run(output=output, client=client(encode(rows)), as_of=AS_OF)["status"], "changed")
            self.assertNotEqual(output.read_bytes(), raw)
            for corrupt in (raw + b"\n", raw.replace(b'"schema_version":1', b'"schema_version":1,"schema_version":1'),
                            raw.replace(b'104.856', b'105.856'), b"x" * (g.EXPORT_LIMIT + 1)):
                output.write_bytes(corrupt)
                c = client()
                with self.assertRaises(g.ValidationError):
                    g.run(output=output, client=c, as_of=AS_OF)
                c.get.assert_not_called()
                self.assertEqual(output.read_bytes(), corrupt)

    def test_atomic_replace_stale_writer_regression_locks_and_parent(self):
        with tempfile.TemporaryDirectory() as directory, patch("sys.stdout", new_callable=io.StringIO):
            output = Path(directory) / "progress.json"
            g.run(output=output, client=client(), as_of=AS_OF)
            raw = output.read_bytes()
            value = g.snapshot(encode(source_rows("2026-06")), AS_OF)
            with patch.object(h.os, "replace", side_effect=OSError("replace failed")), self.assertRaises(OSError):
                g.publish(value, output, raw, AS_OF)
            self.assertEqual(output.read_bytes(), raw)
            self.assertEqual(list(Path(directory).iterdir()), [output])
            with self.assertRaisesRegex(g.ValidationError, "Stale"):
                g.publish(value, output, None, AS_OF)
            g.publish(value, output, raw, AS_OF)
            with self.assertRaisesRegex(g.ValidationError, "regression"):
                g.publish(g.strict_json(raw), output, output.read_bytes(), AS_OF)
            with g.writer_lock(output.parent), self.assertRaises(g.ValidationError):
                g.run(output=output, client=client(), as_of=AS_OF)
            with self.assertRaisesRegex(g.ValidationError, "parent"):
                g.run(output=output / "missing.json", client=client(), as_of=AS_OF)
            link = Path(directory) / "link.json"
            link.symlink_to(output)
            with self.assertRaisesRegex(g.ValidationError, "symlink"):
                g.run(output=link, client=client(), as_of=AS_OF)


if __name__ == "__main__":
    unittest.main()
