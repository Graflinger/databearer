"""Standard-library-only, synthetic offline QA; no ignored raw cache required.

Run from pipeline/: python3 -m unittest discover -s tests -p test_negative_strompreise.py -v
"""
import contextlib
import copy
import csv
import importlib.util
import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch


PIPELINE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'negative_strompreise_export',
    PIPELINE / 'src/data_pipelines/export_data/2026/negative_strompreise/export.py')
exporter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(exporter)
UTC, BERLIN = exporter.UTC, exporter.BERLIN


def response(lo, prices, minutes=60):
    return {'total': len(prices), 'records': [
        {'HourUTC': (lo + timedelta(minutes=i * minutes)).isoformat(),
         'PriceArea': 'DE', 'SpotPriceEUR': price}
        for i, price in enumerate(prices)]}


def parse(source, lo, hi, minutes=60):
    return exporter.validate_response(source, 'fixture', 'HourUTC', 'SpotPriceEUR', minutes, lo, hi)


class IntervalTests(unittest.TestCase):
    def setUp(self):
        self.lo = datetime(2026, 1, 1, tzinfo=UTC)

    def test_quarterhour_sign_not_hourly_average_and_weighted_mean(self):
        # Hourly mean is positive; two negative quarters still count as 0.5 h.
        prices = [-20, 100, -40, 100]
        rows = parse(response(self.lo, prices, 15), self.lo, self.lo + timedelta(hours=1), 15)
        result = exporter.stats(rows)
        self.assertGreater(sum(prices) / 4, 0)
        self.assertEqual(result['Negative_Stunden'], 0.5)
        self.assertEqual(result['Anteil_Prozent'], 50)
        self.assertEqual(result['Negativmittel_EUR_MWh'], -30)
        self.assertEqual(result['Laengste_Phase_Stunden'], 0.25)
        mixed = [(self.lo, 1, -10), (self.lo + timedelta(hours=1), 0.25, -50)]
        self.assertEqual(exporter.stats(mixed)['Negativmittel_EUR_MWh'], -18)
        self.assertEqual(exporter.stats(mixed)['Laengste_Phase_Stunden'], 1.25)

    def test_null_is_unknown_zero_is_known_nonnegative(self):
        for prices in ([None, None], []):
            rows = [(self.lo + timedelta(hours=i), 1, p) for i, p in enumerate(prices)]
            result = exporter.stats(rows)
            self.assertEqual(result['Bekannte_Stunden'], 0)
            for field in ('Negative_Stunden', 'Anteil_Prozent', 'Minimum_EUR_MWh',
                          'Negativmittel_EUR_MWh', 'Laengste_Phase_Stunden'):
                self.assertEqual(result[field], '')
        rows = parse(response(self.lo, [-5, None, 0]), self.lo, self.lo + timedelta(hours=3))
        result = exporter.stats(rows)
        self.assertEqual(result['Erwartete_Stunden'], 3)
        self.assertEqual(result['Bekannte_Stunden'], 2)
        self.assertEqual(result['Anteil_Prozent'], 50)
        self.assertEqual(exporter.stats([(self.lo, 1, 0)])['Negative_Stunden'], 0)

    def test_negative_episode_breaks_on_null_zero_positive_or_utc_gap(self):
        for middle in (None, 0, 1):
            rows = [(self.lo + timedelta(hours=i), 1, p)
                    for i, p in enumerate([-5, -5, middle, -5])]
            self.assertEqual(exporter.stats(rows)['Laengste_Phase_Stunden'], 2)
        rows = [(self.lo, 1, -5), (self.lo + timedelta(hours=2), 1, -5)]
        self.assertEqual(exporter.stats(rows)['Laengste_Phase_Stunden'], 1)

    def test_dst_days_preserve_utc_continuity_and_repeated_local_hour(self):
        for month, day, hours in ((3, 29, 23), (10, 25, 25)):
            with self.subTest(month=month):
                local = datetime(2026, month, day, tzinfo=BERLIN)
                lo = local.astimezone(UTC)
                hi = (local + timedelta(days=1)).astimezone(UTC)
                rows = parse(response(lo, [-1] * (hours * 4), 15), lo, hi, 15)
                self.assertEqual(exporter.stats(rows)['Erwartete_Stunden'], hours)
                self.assertEqual(exporter.stats(rows)['Laengste_Phase_Stunden'], hours)
                repeated = [r for r in rows if r[0].astimezone(BERLIN).hour == 2]
                self.assertEqual(len(repeated), 0 if month == 3 else 8)

    def test_reject_missing_duplicate_offgrid_zone_and_invalid_prices(self):
        base = response(self.lo, [-5, 0, None])
        hi = self.lo + timedelta(hours=3)
        mutations = []
        missing = copy.deepcopy(base)
        missing['records'].pop(1)
        missing['total'] -= 1
        mutations.append(missing)
        duplicate = copy.deepcopy(base)
        duplicate['records'][1] = duplicate['records'][0]
        mutations.append(duplicate)
        for field, value in [('HourUTC', (self.lo + timedelta(minutes=1)).isoformat()),
                             ('HourUTC', '2026-01-01T00:00:00+01:00'),
                             ('PriceArea', 'DK1'), ('SpotPriceEUR', True),
                             ('SpotPriceEUR', float('nan')), ('SpotPriceEUR', float('inf')),
                             ('SpotPriceEUR', '1'), ('SpotPriceEUR', -1001)]:
            bad = copy.deepcopy(base)
            bad['records'][0][field] = value
            mutations.append(bad)
        for bad in mutations:
            with self.subTest(source=bad), self.assertRaises(ValueError):
                parse(bad, self.lo, hi)

    def test_unsorted_utc_naive_input_is_sorted(self):
        source = response(self.lo, [-1, None])
        source['records'][0]['HourUTC'] = '2026-01-01T00:00:00'
        source['records'].reverse()
        rows = parse(source, self.lo, self.lo + timedelta(hours=2))
        self.assertEqual([r[2] for r in rows], [-1, None])


class ReplayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.cache = self.directory / 'cache'
        self.cache.mkdir()
        self.frontend = self.directory / 'article'
        self.frontend.mkdir()
        self.audit = {'sources': [
            {'id': 'energinet-de-day-ahead', 'decision': 'usable_with_conditions',
             'declared_licence': 'CC BY 4.0', 'used': False},
            {'id': 'mastr-battery-aggregates', 'used': False}]}
        (self.frontend / 'manifest.json').write_text(json.dumps(self.audit))
        self.enterContext(patch.object(exporter, 'CACHE', self.cache))
        self.enterContext(patch.object(exporter, 'FRONTEND', self.frontend))
        self.network = self.enterContext(patch.object(exporter, 'urlopen', side_effect=AssertionError('No network')))

    def cache_fixture(self):
        lo = datetime(2026, 1, 1, tzinfo=UTC)
        specs = (('first', 'HourUTC', 'SpotPriceEUR', 60, lo, lo + timedelta(hours=2)),
                 ('second', 'HourUTC', 'SpotPriceEUR', 15, lo + timedelta(hours=2), lo + timedelta(hours=3)))
        self.enterContext(patch.object(exporter, 'SOURCES', specs))
        for spec in specs:
            raw = json.dumps(response(spec[4], [-1] * (2 if spec[0] == 'first' else 4), spec[3])).encode()
            (self.cache / f'{spec[0]}.json').write_bytes(raw)
            provenance = {'filename': f'{spec[0]}.json', 'url': exporter.source_url(*spec),
                          'sha256': exporter.sha(raw), 'bytes': len(raw),
                          'records': 2 if spec[0] == 'first' else 4,
                          'retrieved_at': '2026-11-05T00:00:00+00:00'}
            (self.cache / f'{spec[0]}.provenance.json').write_text(json.dumps(provenance))

    def test_cache_integrity_identity_and_cross_grain_continuity(self):
        self.cache_fixture()
        rows, inputs = exporter.load_intervals()
        self.assertEqual(len(rows), 6)
        self.assertEqual(exporter.stats(rows)['Laengste_Phase_Stunden'], 3)
        provenance = self.cache / 'second.provenance.json'
        original = provenance.read_bytes()
        for field, value in [('sha256', 'bad'), ('bytes', 1), ('records', 1),
                             ('filename', 'wrong.json'), ('url', 'https://wrong.example/'),
                             ('retrieved_at', '2026-11-05T00:00:00')]:
            bad = json.loads(original)
            bad[field] = value
            provenance.write_text(json.dumps(bad))
            with self.subTest(field=field), self.assertRaises(ValueError):
                exporter.load_intervals()
        self.network.assert_not_called()

    def test_missing_cache_and_existing_second_cache_preflight_without_network(self):
        with self.assertRaisesRegex(ValueError, 'Missing offline cache'):
            exporter.load_intervals()
        # Even an orphan for source two must abort before requesting source one.
        (self.cache / 'DayAheadPrices.provenance.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'Refusing to replace'):
            exporter.fetch_inputs()
        self.network.assert_not_called()

    def test_licence_gate_before_cache_load_or_fetch(self):
        self.audit['sources'][0]['decision'] = 'blocked'
        (self.frontend / 'manifest.json').write_text(json.dumps(self.audit))
        with patch.object(exporter, 'load_intervals') as load:
            for operation in (exporter.export, exporter.fetch_inputs):
                with self.assertRaisesRegex(ValueError, 'licence gate'):
                    operation()
            load.assert_not_called()
        self.network.assert_not_called()

    def test_export_period_selection_clipping_blank_cells_and_reproducibility(self):
        # Synthetic intervals span a local year boundary and the grain switch.
        boundary = datetime(2025, 1, 1, tzinfo=BERLIN).astimezone(UTC)
        rows = [(boundary - timedelta(hours=1), 1, -5), (boundary, 1, -5),
                (exporter.SWITCH - timedelta(hours=1), 1, -10),
                (exporter.SWITCH, 0.25, -50),
                (datetime(2026, 4, 1, tzinfo=BERLIN).astimezone(UTC), 0.25, None)]
        inputs = [{'retrieved_at': '2026-11-05T00:00:00+00:00'}]
        battery = [{'Jahr': str(y), 'Leistung_GW': '1', 'Energie_GWh': '2', 'Anlagen': '3'}
                   for y in range(2019, 2026)]
        output = self.directory / 'output'
        with patch.object(exporter, 'load_intervals', return_value=(rows, inputs)), \
                patch.object(exporter, 'load_battery', return_value=(battery, {})), \
                patch.object(exporter, 'OUTPUT', output), contextlib.redirect_stdout(io.StringIO()):
            exporter.export()
            first = {p.name: p.read_bytes() for p in output.iterdir()}
            exporter.export()
            self.assertEqual(first, {p.name: p.read_bytes() for p in output.iterdir()})
            # Failed preflight preserves the complete existing staged set.
            with patch.object(exporter, 'load_battery', side_effect=ValueError('bad battery')):
                with self.assertRaises(ValueError):
                    exporter.export()
            self.assertEqual(first, {p.name: p.read_bytes() for p in output.iterdir()})
        def records(name):
            return list(csv.DictReader(io.StringIO(first[name].decode())))
        annual = records('annual.csv')
        self.assertEqual([r['Zeitraum'] for r in annual], list(map(str, range(2019, 2026))))
        self.assertEqual(annual[5]['Laengste_Phase_Stunden'], '1')
        self.assertEqual(annual[6]['Laengste_Phase_Stunden'], '1.25')
        ytd = records('year_to_date.csv')
        self.assertEqual([r['Zeitraum'] for r in ytd], [f'{y} Jan–Okt' for y in (2024, 2025, 2026)])
        self.assertEqual(ytd[0]['Negative_Stunden'], '')  # December is excluded.
        self.assertEqual(ytd[1]['Negative_Stunden'], '2.25')
        self.assertEqual(ytd[2]['Negative_Stunden'], '')
        self.assertEqual(len(records('monthly.csv')), 94)
        quarters = records('quarterly.csv')
        self.assertEqual(len(quarters), 9)
        self.assertEqual(quarters[5]['Laengste_Phase_Stunden'], '1')  # Q3 clipped at switch.
        profile = records('midday.csv')
        self.assertEqual(len(profile), 24)
        self.assertEqual(profile[0]['Negativ_2026_Stunden'], '')
        manifest = json.loads(first['manifest.json'])
        for name, info in manifest['files'].items():
            self.assertEqual(info['sha256'], exporter.sha(first[name]))
            self.assertEqual(info['bytes'], len(first[name]))
            self.assertEqual(info['rows'], len(records(name)))


class BatteryTests(unittest.TestCase):
    def test_reject_wrong_source_and_semantically_corrupt_cohort_even_with_updated_hash(self):
        directory = exporter.FRONTEND.parent / 'battery_storage'
        metadata = json.loads((directory / 'battery_storage_metadata.json').read_bytes())
        raw = (directory / 'battery_storage_yearly.csv').read_bytes()
        for mutation in ('source', 'negative_capacity', 'count_reconciliation', 'snapshot'):
            with self.subTest(mutation=mutation):
                modified = copy.deepcopy(metadata)
                records = list(csv.DictReader(io.StringIO(raw.decode())))
                row = next(r for r in records if r['commissioning_year'] == '2024'
                           and r['size_segment'] == 'overall')
                if mutation == 'source':
                    modified['mastr']['source_url'] = 'https://www.smard.de/home/marktdaten'
                elif mutation == 'negative_capacity':
                    row['power_gw'] = '-1'
                elif mutation == 'count_reconciliation':
                    row['plant_count'] = str(int(row['plant_count']) - 1)
                else:
                    row['snapshot_date'] = '2026-09-25'
                stream = io.StringIO(newline='')
                writer = csv.DictWriter(stream, fieldnames=list(records[0]), lineterminator='\n')
                writer.writeheader()
                writer.writerows(records)
                changed = stream.getvalue().encode()
                modified['files']['battery_storage_yearly.csv'].update(
                    sha256=exporter.sha(changed), bytes=len(changed))
                def read_bytes(path):
                    return json.dumps(modified).encode() if path.suffix == '.json' else changed
                with patch.object(Path, 'read_bytes', read_bytes), self.assertRaises(ValueError):
                    exporter.load_battery()

    def test_tracked_mastr_cohorts_reconcile_and_only_cohort_payload_is_opened(self):
        # Git-tracked cohort metadata, not ignored raw files or price-profile data.
        original = Path.read_bytes
        opened = []
        def read_bytes(path):
            opened.append(path.name)
            return original(path)
        with patch.object(Path, 'read_bytes', read_bytes):
            rows, metadata = exporter.load_battery()
        self.assertEqual(opened, ['battery_storage_metadata.json', 'battery_storage_yearly.csv'])
        self.assertEqual([r['Jahr'] for r in rows], list(map(str, range(2019, 2026))))
        self.assertEqual(metadata['snapshot_date'], '2026-09-26')
        self.assertIn('marktstammdatenregister.de', metadata['source']['source_url'])


if __name__ == '__main__':
    unittest.main()
