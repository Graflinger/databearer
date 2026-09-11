"""Monthly trade contracts, bounded mocked acquisition, and atomic refresh policy."""

import copy
from datetime import date, timedelta
import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from src.data_pipelines.dashboards.german_electricity import trade as t
from src.data_pipelines.dashboards.german_electricity import history as h
from src.data_pipelines.dashboards.german_electricity import pipeline as p


AS_OF = date(2026, 9, 10)
CUTOFF = date(2026, 8, 1)


def source(years):
    observations = {year: {i: {} for i in t.IDS} for year in years}
    for year in years:
        for month in t.months(date(year, 1, 1), date(year, 12, 1)):
            for i in t.IDS:
                value = 1000.0 if i in t.EXPORTS else -500.0
                if month < t.STARTS.get(i, t.FIRST) or (month, i) in t.KNOWN_GAPS or i == t.NET:
                    value = None
                observations[year][i][month] = value
    return observations


def snapshot(end=CUTOFF):
    return t.snapshot(t.make_rows(source(range(2019, end.year + 1)), t.FIRST, end, {}))


class SourceTests(unittest.TestCase):
    def test_months_dst_leap_and_year_boundaries(self):
        self.assertEqual(t.shift(date(2020, 1, 1), -1), date(2019, 12, 1))
        hours = lambda month: (t.midnight_ms(t.shift(month, 1)) - t.midnight_ms(month)) // t.HOUR_MS
        self.assertEqual(hours(date(2020, 2, 1)), 696)
        self.assertEqual(hours(date(2026, 3, 1)), 743)
        self.assertEqual(hours(date(2026, 10, 1)), 745)
        values = [[t.midnight_ms(m), 1] for m in t.months(date(2026, 1, 1), date(2026, 12, 1))]
        self.assertEqual(len(t.parse_chunk({'series': values}, 2026, 4486)), 12)

    def test_signs_duplicates_nonfinite_and_partial_month_corruption(self):
        stamp = t.midnight_ms(date(2026, 1, 1))
        for points in ([], [[stamp, 1], [stamp, 1]], [[stamp + 1, 1]], [[stamp, True]],
                       [[stamp, float('nan')]], [[stamp, float('inf')]], [[stamp, -1]],
                       [[stamp, '1']], [[stamp]], [[t.midnight_ms(date(2027, 1, 1)), 1]],
                       [[stamp, 1], [t.midnight_ms(date(2026, 9, 1)), -2]]):
            with self.subTest(points=points), self.assertRaises(t.ValidationError):
                t.parse_chunk({'series': points}, 2026, 4486)
        with self.assertRaisesRegex(t.ValidationError, 'sign'):
            t.parse_chunk({'series': [[stamp, 1]]}, 2026, 4504)
        with self.assertRaises(t.ValidationError):
            t.TradeClient.JSON_DECODER(b'{"series":[],"series":[]}')

    def test_magnitude_identity_zeros_and_exact_holes(self):
        obs = source([2019, 2020, 2026])
        first = t.make_rows(obs, t.FIRST, t.FIRST, {})[0]
        self.assertEqual(first['structural_zero_series'], [4706, 4708, 4718, 4720])
        obs[2019][4706][t.FIRST] = 0
        first = t.make_rows(obs, t.FIRST, t.FIRST, {})[0]
        self.assertNotIn(4706, first['structural_zero_series'])
        for month, i in t.KNOWN_GAPS:
            row = t.make_rows(obs, month, month, {})[0]
            self.assertIn(i, row['missing_series'])
            self.assertIsNone(row['imports_gwh'])
            self.assertIsNone(row['exports_gwh'])
            self.assertIsNone(row['net_exports_gwh'])
        row = t.make_rows(obs, CUTOFF, CUTOFF, {})[0]
        self.assertEqual((row['imports_gwh'], row['exports_gwh'], row['net_exports_gwh']), (5.5, 11, 5.5))
        obs[2026][4486][CUTOFF] = None
        with self.assertRaisesRegex(t.ValidationError, '2026-08/4486'):
            t.make_rows(obs, CUTOFF, CUTOFF, {})
        obs[2019][4706][t.FIRST] = 1
        with self.assertRaisesRegex(t.ValidationError, 'before commercial'):
            t.make_rows(obs, t.FIRST, t.FIRST, {})

    def test_net_rounding_known_disparities_and_new_failures(self):
        obs = source([2021, 2026])
        obs[2026][t.NET][CUTOFF] = 5500.11
        t.make_rows(obs, CUTOFF, CUTOFF, {})
        obs[2026][t.NET][CUTOFF] = 5500.13
        with self.assertRaisesRegex(t.ValidationError, 'official net mismatch'):
            t.make_rows(obs, CUTOFF, CUTOFF, {})
        month = date(2021, 12, 1)
        obs[2021][t.NET][month] = 6565
        metrics = {}
        t.make_rows(obs, month, month, metrics)
        self.assertEqual(metrics['known_net_discrepancies_mwh'], {'2021-12': -1065})
        obs[2021][t.NET][month] += 1
        with self.assertRaises(t.ValidationError):
            t.make_rows(obs, month, month, {})

    def test_indices_selection_request_count_concurrency(self):
        urls, active, maximum = [], 0, 0
        lock = threading.Lock()
        def get(url):
            nonlocal active, maximum
            with lock:
                urls.append(url)
                active += 1
                maximum = max(maximum, active)
            time.sleep(0.001)
            with lock:
                active -= 1
            i = int(url.split('/')[5])
            if url.endswith('index_month.json'):
                return {'timestamps': [t.midnight_ms(date(y, 1, 1)) for y in range(2019, 2027)]}
            year = t.datetime.fromtimestamp(int(url.split('_')[-1][:-5]) / 1000, t.BERLIN).year
            return {'series': [[t.midnight_ms(date(year, 1, 1)), None]]}
        client = Mock(get=Mock(side_effect=get))
        t.fetch_monthly(client, [2026])
        self.assertEqual(len(urls), 46)
        self.assertLessEqual(maximum, 3)
        self.assertTrue(all('/DE-LU/' in url for url in urls))
        self.assertEqual(sum('index_month' in url for url in urls), 23)
        urls.clear()
        t.fetch_monthly(client, list(range(2019, 2027)))
        self.assertEqual(len(urls), 207)
        # Optional net index may lack a year; gross indices may not.
        def optional_net(url):
            if '/4629/' in url and url.endswith('index_month.json'):
                return {'timestamps': [t.midnight_ms(date(2025, 1, 1))]}
            return get(url)
        client.get.side_effect = optional_net
        obs = t.fetch_monthly(client, [2026])
        self.assertEqual(obs[2026][t.NET], {})
        self.assertEqual(t.TradeClient(refresh=True).MAX_ATTEMPTS, 50)
        self.assertEqual(t.TradeClient().MAX_ATTEMPTS, 260)

    def test_malformed_indices_missing_required_year(self):
        for payload in ({}, {'timestamps': []}, {'timestamps': [True]}, {'timestamps': [1, 1]},
                        {'timestamps': [t.midnight_ms(date(2026, 1, 2))]}, {'timestamps': [10**99]}):
            with self.subTest(payload=payload), self.assertRaises(t.ValidationError):
                t.parse_index(payload, 4486)
        client = Mock()
        client.get.return_value = {'timestamps': [t.midnight_ms(date(2025, 1, 1))]}
        with self.assertRaisesRegex(t.ValidationError, 'absent from index'):
            t.fetch_monthly(client, [2026])

    def test_strict_http_decoder_and_attempt_budget(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read1.side_effect = [b'{"series":[],"series":[]}', b'']
        with patch.object(p, 'urlopen', return_value=response), self.assertRaises(t.ValidationError):
            t.TradeClient().get('https://www.smard.de/test')
        client = t.TradeClient(refresh=True)
        client.requests = 50
        with patch.object(p, 'urlopen') as network, self.assertRaisesRegex(t.ValidationError, 'budget'):
            client.get('https://www.smard.de/test')
        network.assert_not_called()

    def test_fallback_complete_active_days_and_no_generic_zero(self):
        obs = source([2020])
        def get(url):
            i = int(url.split('/')[5])
            start = t.TRADING_STARTS[i]
            return {'series': [[t.midnight_ms(day), None if day < start else (10 if i in t.EXPORTS else -5)]
                               for day in h.days(date(2020, 1, 1), date(2020, 12, 31))]}
        client = Mock(get=Mock(side_effect=get))
        metrics = {}
        t.recover_startup_months(client, obs, metrics)
        self.assertEqual(client.get.call_count, 4)
        self.assertEqual(obs[2020][4706][date(2020, 11, 1)], 130)
        self.assertEqual(obs[2020][4720][date(2020, 12, 1)], -115)
        self.assertEqual(len(metrics['daily_fallback_mwh']), 4)
        broken = get('https://www.smard.de/app/chart_data/4706/DE-LU/x')
        broken['series'][325][1] = None
        client.get.side_effect = None
        client.get.return_value = broken
        obs = source([2020])
        # Restrict to one fallback; a post-start null must leave it unknown.
        for month, i in t.KNOWN_GAPS:
            if i != 4706:
                obs[2020][i][month] = 0
        t.recover_startup_months(client, obs, {})
        self.assertIsNone(obs[2020][4706][date(2020, 11, 1)])
        broken['series'].append(broken['series'][0])
        with self.assertRaises(t.ValidationError):
            t.recover_startup_months(client, obs, {})


class StorageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.output = self.directory / 'trade.json'
        self.manifest = self.directory / 'manifest.json'
        self.manifest.write_bytes(b'validated fixture')
        self.addCleanup(patch.stopall)
        patch.object(t, 'history_cutoff', return_value=(CUTOFF, b'validated fixture')).start()
        self.fetch = patch.object(t, 'fetch_monthly', side_effect=lambda client, years: source(years)).start()
        patch.object(t, 'recover_startup_months').start()
        patch('sys.stdout', new_callable=io.StringIO).start()

    def run_trade(self, **kwargs):
        return t.run(kwargs.pop('mode', 'refresh'), kwargs.pop('as_of', AS_OF), self.output,
                     history_manifest=self.manifest, **kwargs)

    def save(self, end=CUTOFF):
        self.output.write_bytes(t.canonical_bytes(snapshot(end)))

    def test_backfill_nochange_and_frozen_row_bytes(self):
        self.run_trade(mode='backfill')
        before = self.output.read_bytes()
        mtime = self.output.stat().st_mtime_ns
        result = self.run_trade()
        self.assertEqual(result['status'], 'unchanged')
        self.assertEqual(result['years_fetched'], [2026])
        self.assertEqual(before, self.output.read_bytes())
        self.assertEqual(mtime, self.output.stat().st_mtime_ns)
        self.run_trade(mode='backfill')
        self.assertEqual(self.fetch.call_args.args[1], [])
        self.assertEqual(before, self.output.read_bytes())

    def test_latest_three_only_revisions_and_append(self):
        self.save(date(2026, 7, 1))
        prior = json.loads(self.output.read_bytes())
        revised = source([2026])
        for month in t.months(date(2026, 1, 1), CUTOFF):
            revised[2026][4486][month] = 2000
        self.fetch.side_effect = lambda client, years: revised
        self.run_trade()
        after = json.loads(self.output.read_bytes())
        frozen = [r for r in prior['rows'] if r['month'] < '2026-06']
        self.assertEqual(t.canonical_bytes(frozen), t.canonical_bytes(after['rows'][:len(frozen)]))
        self.assertEqual(after['rows'][-3]['exports_gwh'], 12)
        self.assertEqual(after['last_month'], '2026-08')

    def test_missed_window_requires_reconcile_and_never_truncates(self):
        self.save(date(2026, 4, 1))
        before = self.output.read_bytes()
        with self.assertRaisesRegex(t.ValidationError, 'gap/unfinished'):
            self.run_trade()
        self.fetch.assert_not_called()
        self.assertEqual(before, self.output.read_bytes())
        self.run_trade(mode='backfill', start_year=2026, end_year=2026, reconcile=True)
        self.assertEqual(t.load_snapshot(self.output)[0]['last_month'], '2026-08')
        before = self.output.read_bytes()
        self.run_trade(mode='backfill', start_year=2020, end_year=2020, reconcile=True)
        self.assertEqual(before, self.output.read_bytes())
        with patch.object(t, 'history_cutoff', return_value=(date(2026, 7, 1), b'validated fixture')):
            with self.assertRaisesRegex(t.ValidationError, 'backwards'):
                self.run_trade()

    def test_january_requires_december_explicit_reconcile(self):
        self.save(date(2025, 11, 1))
        with patch.object(t, 'history_cutoff', return_value=(date(2025, 12, 1), b'validated fixture')):
            with self.assertRaisesRegex(t.ValidationError, 'closed year'):
                self.run_trade(as_of=date(2026, 1, 10))
            self.run_trade(mode='backfill', as_of=date(2026, 1, 10), start_year=2025, end_year=2025, reconcile=True)
            before = self.output.read_bytes()
            result = self.run_trade(as_of=date(2026, 1, 10))
            self.assertEqual(result['years_fetched'], [])
            self.assertEqual(before, self.output.read_bytes())

    def test_initial_range_gap_and_corruption_rejected_before_network(self):
        with self.assertRaisesRegex(t.ValidationError, 'start in 2019'):
            self.run_trade(mode='backfill', start_year=2025)
        self.fetch.assert_not_called()
        self.save(date(2019, 12, 1))
        before = self.output.read_bytes()
        with self.assertRaisesRegex(t.ValidationError, 'coverage gap'):
            self.run_trade(mode='backfill', start_year=2021, end_year=2021)
        self.assertEqual(before, self.output.read_bytes())
        self.output.write_bytes(b'{}')
        self.fetch.reset_mock()
        with self.assertRaises(t.ValidationError):
            self.run_trade(mode='backfill', reconcile=True)
        self.fetch.assert_not_called()
        self.assertEqual(self.output.read_bytes(), b'{}')

    def test_lock_stale_writer_and_atomic_failure(self):
        self.save()
        old = self.output.read_bytes()
        value = snapshot()
        with t.writer_lock(self.directory):
            with self.assertRaisesRegex(t.ValidationError, 'writer already running'):
                self.run_trade()
        with self.assertRaisesRegex(t.ValidationError, 'Stale trade'):
            t.publish(value, self.output, None)
        value['rows'][-1]['exports_gwh'] += 1
        value['rows'][-1]['net_exports_gwh'] += 1
        value['content_hash'] = t.digest(value)
        with patch.object(h.os, 'replace', side_effect=OSError('injected')):
            with self.assertRaises(OSError):
                t.publish(value, self.output, old)
        self.assertEqual(self.output.read_bytes(), old)
        self.assertEqual(sorted(p.name for p in self.directory.iterdir()), ['manifest.json', 'trade.json'])

    def test_stale_output_and_history_during_fetch(self):
        self.save()
        before = self.output.read_bytes()
        def fetch(client, years):
            changed = snapshot()
            changed['rows'][-1]['imports_gwh'] += 1
            changed['rows'][-1]['net_exports_gwh'] -= 1
            changed['content_hash'] = t.digest(changed)
            self.output.write_bytes(t.canonical_bytes(changed))
            return source(years)
        self.fetch.side_effect = fetch
        with self.assertRaisesRegex(t.ValidationError, 'Stale trade'):
            self.run_trade()
        self.assertNotEqual(before, self.output.read_bytes())
        def fetch_history(client, years):
            self.manifest.write_bytes(b'changed history')
            return source(years)
        self.fetch.side_effect = fetch_history
        before = self.output.read_bytes()
        with self.assertRaisesRegex(t.ValidationError, 'History manifest changed'):
            self.run_trade()
        self.assertEqual(before, self.output.read_bytes())

    def test_contract_tampering_even_with_recomputed_hash(self):
        original = snapshot()
        mutations = [lambda v: v.update(schema_version=True),
                     lambda v: v.update(region='DE'),
                     lambda v: v['rows'][-1].update(missing_series=[4486]),
                     lambda v: v['rows'][-1].update(structural_zero_series=[4706]),
                     lambda v: v['rows'][-1].update(net_exports_gwh=0),
                     lambda v: v['rows'][-1].update(imports_gwh=True),
                     lambda v: v['rows'][-1].update(month='2026-07'),
                     lambda v: v['rows'][-1].update(missing_series=[True]),
                     lambda v: v['rows'][22].update(imports_gwh=0)]
        for mutate in mutations:
            value = copy.deepcopy(original)
            mutate(value)
            value['content_hash'] = t.digest(value)
            with self.subTest(mutate=mutate), self.assertRaises(t.ValidationError):
                t.validate_snapshot(value)
        self.save()
        self.output.write_bytes(self.output.read_bytes() + b'\n')
        with self.assertRaisesRegex(t.ValidationError, 'Noncanonical'):
            t.load_snapshot(self.output)


class HistoryCutoffTests(unittest.TestCase):
    def test_validated_history_cutoff_partial_month_and_hash_corruption(self):
        # Real history loader with compact valid synthetic daily partitions.
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for last, expected in [(date(2026, 9, 9), CUTOFF), (date(2026, 8, 31), CUTOFF),
                                   (date(2026, 8, 30), date(2026, 7, 1))]:
                rows = [{'date': day.isoformat(), 'hours': h.hours(day),
                         'energy_gwh': {key: 0 for key in h.ENERGY}, 'price_eur_mwh': 0,
                         'price_zone': 'DE-LU', 'nuclear_derived_zero': True}
                        for day in h.days(date(2026, 1, 1), last)]
                part = h.partition(2026, rows)
                raw = h.canonical_bytes(part)
                manifest = h.make_manifest({2026: part}, AS_OF)
                path = directory / 'manifest.json'
                path.write_bytes(h.canonical_bytes(manifest))
                blob = directory / Path(manifest['years'][0]['url']).name
                blob.write_bytes(raw)
                self.assertEqual(t.history_cutoff(path, AS_OF)[0], expected)
                alternate = directory / 'alternate.json'
                alternate.write_bytes(path.read_bytes())
                self.assertEqual(t.history_cutoff(alternate, AS_OF)[0], expected)
                with self.assertRaisesRegex(t.ValidationError, 'ahead'):
                    t.history_cutoff(path, last)
                blob.write_bytes(raw + b' ')
                with self.assertRaisesRegex(t.ValidationError, 'hash/URL'):
                    t.history_cutoff(path, AS_OF)


if __name__ == '__main__':
    unittest.main()
