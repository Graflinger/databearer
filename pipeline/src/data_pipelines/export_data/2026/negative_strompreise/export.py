"""Bounded, frozen Energinet article export; never invokes dashboard refresh/dbt.

Run from pipeline/: python3 src/data_pipelines/export_data/2026/negative_strompreise/export.py
Raw HTTP responses stay in ignored .data/negative_strompreise/. Offline replay is default;
--fetch permits the two historical requests (no polling or automatic refresh).
"""
import argparse
import csv
import hashlib
import io
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[6]
CACHE = ROOT / 'pipeline/.data/negative_strompreise'
OUTPUT = ROOT / 'pipeline/.data/output/negative_strompreise'
FRONTEND = ROOT / 'frontend/src/data_ingestion/data/2026/negative_strompreise'
BERLIN = ZoneInfo('Europe/Berlin')
UTC = timezone.utc
START = datetime(2019, 1, 1, tzinfo=BERLIN).astimezone(UTC)
SWITCH = datetime(2025, 10, 1, tzinfo=BERLIN).astimezone(UTC)
END = datetime(2026, 11, 1, tzinfo=BERLIN).astimezone(UTC)
SOURCES = (
    ('Elspotprices', 'HourUTC', 'SpotPriceEUR', 60, START, SWITCH),
    ('DayAheadPrices', 'TimeUTC', 'DayAheadPriceEUR', 15, SWITCH, END),
)


def require(condition, message):
    # Validation must also run under python -O.
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_url(dataset, timekey, pricekey, minutes, lo, hi):
    params = {'start': lo.astimezone(BERLIN).date().isoformat(),
              'end': hi.astimezone(BERLIN).date().isoformat(),
              'filter': json.dumps({'PriceArea': ['DE']}),
              'columns': f'{timekey},PriceArea,{pricekey}',
              'sort': f'{timekey} asc', 'limit': 100000}
    return f'https://api.energidataservice.dk/dataset/{dataset}?{urlencode(params)}'


def licence_gate():
    manifest = json.loads((FRONTEND / 'manifest.json').read_text())
    sources = [s for s in manifest['sources'] if s['id'] == 'energinet-de-day-ahead']
    require(len(sources) == 1 and sources[0]['decision'] == 'usable_with_conditions'
            and sources[0]['declared_licence'] == 'CC BY 4.0', 'Energinet licence gate failed')
    return manifest


def fetch_inputs():
    licence_gate()
    CACHE.mkdir(parents=True, exist_ok=True)
    # Preflight both pairs before any request, including orphaned provenance.
    for dataset, *_ in SOURCES:
        for suffix in ('.json', '.provenance.json'):
            target = CACHE / f'{dataset}{suffix}'
            require(not target.exists(), f'Refusing to replace frozen cache: {target}')
    responses = []
    for spec in SOURCES:
        dataset = spec[0]
        target = CACHE / f'{dataset}.json'
        url = source_url(*spec)
        with urlopen(Request(url, headers={'User-Agent': 'Databearer research (one-off frozen article)'}), timeout=45) as response:
            raw = response.read(16_000_001)
        require(len(raw) <= 16_000_000, 'Source response too large')
        obj = json.loads(raw)
        validate_response(obj, *spec)
        provenance = {'filename': target.name, 'url': url, 'retrieved_at': datetime.now(UTC).isoformat(),
                      'bytes': len(raw), 'sha256': sha(raw), 'records': len(obj['records'])}
        responses.append((target, raw, provenance))
    for target, raw, provenance in responses:
        with target.open('xb') as handle:
            handle.write(raw)
        with target.with_suffix('.provenance.json').open('x') as handle:
            handle.write(json.dumps(provenance, indent=2) + '\n')
        print(target.stem, provenance)


def validate_response(source, dataset, timekey, pricekey, minutes, lo, hi):
    records = source['records']
    require(source['total'] == len(records) and bool(records), f'{dataset}: truncated/empty response')
    rows, seen = [], set()
    for item in records:
        require(set(item) == {timekey, pricekey, 'PriceArea'} and item['PriceArea'] == 'DE',
                f'{dataset}: unexpected schema/price area')
        dt = datetime.fromisoformat(item[timekey])
        require(dt.tzinfo is None or dt.utcoffset() == timedelta(0), f'{dataset}: timestamp is not UTC')
        dt = dt.replace(tzinfo=UTC)
        require(dt not in seen and lo <= dt < hi, f'{dataset}: duplicate/out-of-window interval')
        require((dt - lo).total_seconds() % (minutes * 60) == 0, f'{dataset}: off-grid interval')
        seen.add(dt)
        price = item[pricekey]
        require(price is None or (type(price) in (int, float) and math.isfinite(price)
                                  and -1000 <= price <= 10000), f'{dataset}: invalid price')
        rows.append((dt, minutes / 60, price))
    # No omissions are filled. A missing interval fails the frozen package;
    # explicit null prices retain their duration and break negative episodes.
    require(len(seen) == int((hi - lo).total_seconds() / (minutes * 60)),
            f'{dataset}: omitted intervals')
    return sorted(rows)


def load_intervals():
    rows, inputs = [], []
    for dataset, *_ in SOURCES:
        for suffix in ('.json', '.provenance.json'):
            require((CACHE / f'{dataset}{suffix}').is_file(), f'Missing offline cache: {dataset}{suffix}')
    for spec in SOURCES:
        dataset = spec[0]
        raw = (CACHE / f'{dataset}.json').read_bytes()
        provenance = json.loads((CACHE / f'{dataset}.provenance.json').read_text())
        require(provenance['sha256'] == sha(raw) and provenance['bytes'] == len(raw),
                f'{dataset}: cache hash/size mismatch')
        require(provenance['filename'] == f'{dataset}.json' and provenance['url'] == source_url(*spec),
                f'{dataset}: cache source identity mismatch')
        retrieved = datetime.fromisoformat(provenance['retrieved_at'])
        require(retrieved.tzinfo is not None and retrieved >= END, f'{dataset}: invalid acquisition date')
        source = json.loads(raw)
        require(source['total'] == provenance['records'], f'{dataset}: provenance count mismatch')
        rows.extend(validate_response(source, *spec))
        inputs.append(provenance)
    rows.sort()
    require(all(a[0] + timedelta(hours=a[1]) == b[0] for a, b in zip(rows, rows[1:])),
            'UTC continuity failure across sources')
    return rows, inputs


def stats(rows):
    known = [r for r in rows if r[2] is not None]
    negative = [r for r in known if r[2] < 0]
    hours = sum(r[1] for r in known)
    nh = sum(r[1] for r in negative)
    run = longest = 0
    previous_end = None
    for dt, duration, price in rows:
        if price is not None and price < 0:
            run = run + duration if previous_end == dt else duration
            longest = max(longest, run)
            previous_end = dt + timedelta(hours=duration)
        else:
            run = 0
            previous_end = None
    return {
        'Erwartete_Stunden': sum(r[1] for r in rows), 'Bekannte_Stunden': hours,
        'Negative_Stunden': nh if hours else '', 'Anteil_Prozent': round(nh / hours * 100, 4) if hours else '',
        'Minimum_EUR_MWh': round(min(r[2] for r in known), 4) if known else '',
        'Negativmittel_EUR_MWh': round(sum(r[1] * r[2] for r in negative) / nh, 4) if nh else '',
        'Laengste_Phase_Stunden': longest if hours else '',
    }


def load_battery():
    # Reuse only the MaStR-derived cohort file; never the mixed package's price profile.
    battery_dir = FRONTEND.parent / 'battery_storage'
    metadata_raw = (battery_dir / 'battery_storage_metadata.json').read_bytes()
    bm = json.loads(metadata_raw)
    mastr = bm['mastr']
    require(bm['kind'] == 'frozen_battery_article' and mastr['snapshot_date'] == '2026-09-26'
            and mastr['source_url'] == 'https://download.marktstammdatenregister.de/Gesamtdatenexport_20260926_26.1.zip'
            and mastr['source_filename'] == 'Gesamtdatenexport_20260926_26.1_battery_subset.zip'
            and len(mastr['archive_sha256']) == 64, 'Unexpected MaStR source identity')
    name = 'battery_storage_yearly.csv'
    raw = (battery_dir / name).read_bytes()
    info = bm['files'][name]
    require(sha(raw) == info['sha256'] and len(raw) == info['bytes'], 'Battery hash/size mismatch')
    reader = csv.DictReader(io.StringIO(raw.decode()))
    require(reader.fieldnames == info['columns'], 'Battery columns mismatch')
    records = list(reader)
    require(len(records) == info['rows'], 'Battery row count mismatch')
    selected = [r for r in records if 2019 <= int(r['commissioning_year']) <= 2025]
    seen = set()
    for r in selected:
        key = (r['commissioning_year'], r['size_segment'])
        require(key not in seen and r['size_segment'] in ('overall', 'small', 'medium', 'large'),
                'Duplicate/invalid battery cohort')
        seen.add(key)
        require(r['snapshot_date'] == mastr['snapshot_date'] and r['period_complete'] == 'true',
                'Battery snapshot/period mismatch')
        power, energy = float(r['power_gw']), float(r['energy_gwh'])
        require(math.isfinite(power) and math.isfinite(energy) and power > 0 and energy > 0
                and 0.1 <= energy / power <= 12, 'Invalid battery capacity')
        require(0 <= int(r['network_verified_plant_count']) <= int(r['plant_count'])
                <= int(r['unit_count']) and int(r['plant_count']) > 0, 'Invalid battery counts')
    battery = []
    for year in range(2019, 2026):
        group = {r['size_segment']: r for r in selected if int(r['commissioning_year']) == year}
        require('overall' in group, f'Missing battery cohort {year}')
        r = group.pop('overall')
        for column in ('plant_count', 'unit_count', 'network_verified_plant_count', 'power_gw', 'energy_gwh'):
            require(abs(float(r[column]) - sum(float(s[column]) for s in group.values())) <= 1e-8,
                    f'Battery segment reconciliation failed: {year} {column}')
        battery.append({'Jahr': str(year), 'Leistung_GW': r['power_gw'],
                        'Energie_GWh': r['energy_gwh'], 'Anlagen': r['plant_count']})
    return battery, {'path': f'frontend/src/data_ingestion/data/2026/battery_storage/{name}',
                     **info, 'snapshot_date': mastr['snapshot_date'], 'source': mastr,
                     'metadata_sha256': sha(metadata_raw),
                     'interpretation': 'Operating plants observed at snapshot, grouped by commissioning year; not historical total stock or net annual additions.'}


def export():
    manifest = licence_gate()
    rows, inputs = load_intervals()
    battery, battery_input = load_battery()
    next(s for s in manifest['sources'] if s['id'] == 'energinet-de-day-ahead')['used'] = True
    files, payloads = {}, {}

    def write(name, records):
        require(bool(records), f'Empty export: {name}')
        stream = io.StringIO(newline='')
        writer = csv.DictWriter(stream, fieldnames=list(records[0]), lineterminator='\n')
        writer.writeheader()
        writer.writerows(records)
        raw = stream.getvalue().encode()
        payloads[name] = raw
        files[name] = {'sha256': sha(raw), 'bytes': len(raw), 'rows': len(records), 'columns': list(records[0])}

    local = [(dt.astimezone(BERLIN), duration, price) for dt, duration, price in rows]
    annual, ytd, monthly, quarter, profile = [], [], [], [], []
    for year in range(2019, 2027):
        selected = [r for r, loc in zip(rows, local) if loc[0].year == year]
        if year < 2026:
            annual.append({'Zeitraum': str(year), **stats(selected)})
        for month in range(1, 13 if year < 2026 else 11):
            selected = [r for r, loc in zip(rows, local) if (loc[0].year, loc[0].month) == (year, month)]
            monthly.append({'Monat': f'{year}-{month:02}', **stats(selected)})
    for year in (2024, 2025, 2026):
        selected = [r for r, loc in zip(rows, local) if loc[0].year == year and loc[0].month <= 10]
        ytd.append({'Zeitraum': f'{year} Jan–Okt', **stats(selected)})
        for q in (1, 2, 3):
            selected = [r for r, loc in zip(rows, local) if loc[0].year == year and (loc[0].month - 1) // 3 + 1 == q]
            quarter.append({'Zeitraum': f'{year} Q{q}', **stats(selected)})
    for hour in range(24):
        record = {'Stunde': f'{hour:02}:00'}
        for year in (2024, 2025, 2026):
            selected = [r for r, loc in zip(rows, local) if loc[0].year == year and 4 <= loc[0].month <= 6 and loc[0].hour == hour]
            values = stats(selected)
            record[f'Anteil_{year}_Prozent'] = values['Anteil_Prozent']
            record[f'Negativ_{year}_Stunden'] = values['Negative_Stunden']
            record[f'Bekannt_{year}_Stunden'] = values['Bekannte_Stunden']
        profile.append(record)
    write('annual.csv', annual)
    write('year_to_date.csv', ytd)
    write('monthly.csv', monthly)
    write('quarterly.csv', quarter)
    write('midday.csv', profile)

    write('battery.csv', battery)
    require({name: info['rows'] for name, info in files.items()} == {
        'annual.csv': 7, 'year_to_date.csv': 3, 'monthly.csv': 94,
        'quarterly.csv': 9, 'midday.csv': 24, 'battery.csv': 7}, 'Unexpected export row counts')
    next(s for s in manifest['sources'] if s['id'] == 'mastr-battery-aggregates')['used'] = True
    manifest.update({
        'kind': 'frozen_negative_strompreise_article', 'status': 'validated',
        'data_acquired_at': max(i['retrieved_at'] for i in inputs), 'observation_cutoff': '2026-10-31',
        'timezone': 'Europe/Berlin', 'period_start': '2019-01-01', 'interval_change': '2025-10-01',
        'price_area_source': 'DE', 'price_area_interpreted': 'DE-LU',
        'methodology_version': 1, 'raw_inputs': inputs, 'files': files,
        'exporter': {'path': str(Path(__file__).relative_to(ROOT)), 'sha256': sha(Path(__file__).read_bytes())},
        'battery_input': battery_input,
        'quality': {'intervals': len(rows), 'null_intervals': sum(r[2] is None for r in rows),
                    'negative_intervals': sum(r[2] is not None and r[2] < 0 for r in rows),
                    'by_source': {spec[0]: {
                        'interval_minutes': spec[3],
                        'intervals': sum(spec[4] <= r[0] < spec[5] for r in rows),
                        'negative_intervals': sum(spec[4] <= r[0] < spec[5] and r[2] is not None and r[2] < 0 for r in rows),
                        'null_intervals': sum(spec[4] <= r[0] < spec[5] and r[2] is None for r in rows),
                    } for spec in SOURCES},
                    'duplicates': 0, 'omitted_intervals': 0, 'interpolated_intervals': 0},
        'note': 'Frozen aggregates; no dashboard data consumed or changed. Negative duration is sum of negative source interval durations, not sign of hourly averages. 2026 is incomplete. Phase lengths are clipped at each reported period boundary; nulls break phases. Battery evidence has a separate snapshot and scope.',
    })
    manifest.pop('payloads', None)
    # Validate the complete bundle before replacing staged files; manifest last.
    # No runtime timestamp: identical caches/audit/exporter reproduce identical bytes.
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, raw in payloads.items():
        (OUTPUT / name).write_bytes(raw)
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'annual': annual, 'year_to_date': ytd, 'quarterly': quarter, 'quality': manifest['quality']}, ensure_ascii=False, indent=2))
    print(f'Staged package: {OUTPUT}; frontend not modified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    if args.fetch:
        fetch_inputs()
    export()
