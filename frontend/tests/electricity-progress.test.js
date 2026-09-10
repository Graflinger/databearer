/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { verifyProgress, readProgress, safeRawJSON } = require('../src/data_ingestion/builders/electricityProgress');
const { parseCanonical } = require('../src/js/dashboards/electricity-history');
const { options } = require('../src/js/dashboards/electricity-progress');
const { sourceBytes, fixture, rollover, encode } = require('./fixtures/electricity-progress');
const NOW = Date.parse('2026-09-10T12:00:00Z');
const colors = { ink: '#111', muted: '#555', line: '#ddd', accent: '#c4ad61', font: 'system-ui' };

test('actual raw producer snapshot validates without importing or normalizing JSON', () => {
  const raw = sourceBytes();
  const current = JSON.parse(raw);
  const nextYear = Math.max(2027, current.congestion.annual.at(-1).year + 1, Number(current.congestion.monthly_through.slice(0, 4)) + 1);
  expect(verifyProgress(raw, Date.parse(`${nextYear}-01-15T12:00:00Z`))).toEqual(current);
  expect(raw.length).toBeLessThanOrEqual(150000);
});

test.each([
  ['schema', (s) => { s.schema_version = 2; }],
  ['extra root field', (s) => { s.checked_at = '2026-09-10'; }],
  ['source', (s) => { s.source.name = 'Other'; }],
  ['source CSV', (s) => { s.source_csv += '?other'; }],
  ['license evidence', (s) => { s.license_evidence = 'https://example.com'; }],
  ['scope', (s) => { s.capacity.scope = 'Alle deutschen Speicher'; }],
  ['provisional', (s) => { s.capacity.provisional = false; }],
  ['capacity source', (s) => { s.capacity.source_url = 'https://example.com'; }],
  ['capacity date', (s) => { s.capacity.data_through = '2025-12-30'; }],
  ['capacity unit', (s) => { s.capacity.unit = 'GWh'; }],
  ['missing capacity year', (s) => { s.capacity.rows.splice(2, 1); }],
  ['running capacity year', (s) => { s.capacity.rows.push({ ...s.capacity.rows.at(-1), year: 2026 }); }],
  ['string year', (s) => { s.capacity.rows[0].year = '2011'; }],
  ['null', (s) => { s.capacity.rows[0].battery_gw = null; }],
  ['boolean', (s) => { s.capacity.rows[0].battery_gw = false; }],
  ['numeric string', (s) => { s.capacity.rows[0].battery_gw = '1'; }],
  ['negative', (s) => { s.capacity.rows[0].battery_gw = -1; }],
  ['bound', (s) => { s.capacity.rows[0].solar_gw = 1001; }],
  ['target value', (s) => { s.targets.solar.rows[3].capacity_gw++; }],
  ['target date', (s) => { s.targets.verified_on = '2026-09-11'; }],
  ['target source', (s) => { s.targets.solar.source_url += '?other'; }],
  ['target minimum', (s) => { s.targets.wind_offshore.comparison = 'target'; }],
  ['target maintenance', (s) => { s.targets.solar.maintain_after_year = null; }],
  ['congestion unit', (s) => { s.congestion.units.cost = 'EUR'; }],
  ['annual gap', (s) => { s.congestion.annual.splice(2, 1); }],
  ['annual future', (s) => { s.congestion.annual.push({ ...s.congestion.annual.at(-1), year: 2026 }); }],
  ['annual watermark', (s) => { s.congestion.annual_through = '2025-02-30'; }],
  ['month invalid', (s) => { s.congestion.monthly[0].month = '2022-13'; }],
  ['month format', (s) => { s.congestion.monthly[0].month = '2022-07-01'; }],
  ['month duplicate', (s) => { s.congestion.monthly[1].month = s.congestion.monthly[0].month; }],
  ['month truncated', (s) => { s.congestion.monthly.pop(); s.congestion.monthly_through = '2026-04'; }],
  ['month watermark', (s) => { s.congestion.monthly_through = '2026-09'; }],
  ['missing redispatch', (s) => { delete s.congestion.monthly[0].redispatch_energy_gwh; }],
  ['congestion ceiling', (s) => { s.congestion.monthly[0].cost_million_eur = 1000001; }],
])('rejects %s even with a newly valid hash', (_, mutate) => {
  const snapshot = fixture(); mutate(snapshot);
  expect(() => verifyProgress(encode(snapshot), NOW)).toThrow();
});

test('hash is token-preserving, canonical input strict, only root content_hash excluded', () => {
  const value = fixture(); value.capacity.rows[0].battery_gw = 0;
  const original = encode(value).toString();
  const raw = original.replace('"battery_gw":0,', '"battery_gw":0.0,');
  expect(() => verifyProgress(Buffer.from(raw), NOW)).toThrow(/content_hash/);
  const { semantic } = parseCanonical(Buffer.from(raw), 150000, ['content_hash']);
  const signed = raw.replace(JSON.parse(raw).content_hash, createHash('sha256').update(semantic).digest('hex'));
  expect(verifyProgress(Buffer.from(signed), NOW).capacity.rows[0].battery_gw).toBe(0);
  for (const [before, after] of [['"year":2011', '"year":2011.0'], ['"schema_version":1', '"schema_version":1.0'], ['"capacity_gw":215', '"capacity_gw":215.0']]) {
    const changed = signed.replace(before, after);
    const preimage = parseCanonical(Buffer.from(changed), 150000, ['content_hash']).semantic;
    const resigned = changed.replace(JSON.parse(changed).content_hash, createHash('sha256').update(preimage).digest('hex'));
    expect(() => verifyProgress(Buffer.from(resigned), NOW)).toThrow(/Token/);
  }
  for (const bad of [signed + '\n', ' ' + signed, signed.replace('"schema_version":1', '"schema_version":1,"schema_version":1'), signed.replace('"battery_gw":0.0', '"battery_gw":1e999'), signed.replace('"year":2011', '"year":2011.5')]) {
    expect(() => verifyProgress(Buffer.from(bad), NOW)).toThrow();
  }
  expect(() => verifyProgress(Buffer.alloc(150001), NOW)).toThrow();
  expect(() => verifyProgress(Buffer.from([0xff]), NOW)).toThrow();
  const escaped = safeRawJSON('{"note":"</script>&\u2028\u2029","value":0.0}');
  expect(escaped).not.toMatch(/[<>&\u2028\u2029]/);
  expect(escaped).toContain('0.0');
  expect(JSON.parse(escaped).note).toContain('</script>');
});

test('Berlin completed-period guards and rollover leave capacity pinned', () => {
  const bytes = encode(rollover());
  expect(() => verifyProgress(bytes, Date.parse('2026-12-31T22:59:59Z'))).toThrow();
  const snapshot = verifyProgress(bytes, Date.parse('2026-12-31T23:00:00Z'));
  expect(snapshot.congestion.annual.at(-1).year).toBe(2026);
  expect(snapshot.capacity.rows.at(-1).year).toBe(2025);
  expect(() => verifyProgress(encode(fixture()), Date.parse('2026-09-09T12:00:00Z'))).toThrow(/Zielprüfung/);
});

test('read validates actual bytes, rejects symlinks and oversize files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-test-'));
  try {
    const input = path.join(directory, 'source.json');
    const bytes = encode(fixture()); fs.writeFileSync(input, bytes);
    expect(readProgress(input, NOW).raw).toBe(bytes.toString());
    fs.symlinkSync(input, path.join(directory, 'link.json'));
    expect(() => readProgress(path.join(directory, 'link.json'), NOW)).toThrow();
    fs.writeFileSync(input, Buffer.alloc(150001));
    expect(() => readProgress(input, NOW)).toThrow();
    const bad = fixture(); bad.source.name = 'Changed'; fs.writeFileSync(input, encode(bad));
    expect(() => readProgress(input, NOW)).toThrow(/Quelle/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test.each([fixture(), rollover()])('five charts keep exact fields, separate units and independent annual aggregates', (snapshot) => {
  const result = options(snapshot, colors);
  expect(Object.keys(result)).toHaveLength(5);
  const expected = { capacity: ['GW', snapshot.capacity.rows, ['solar_gw', 'wind_onshore_gw', 'wind_offshore_gw']], storage: ['GW', snapshot.capacity.rows, ['battery_gw', 'pumped_storage_gw']], 'annual-energy': ['GWh', snapshot.congestion.annual, ['energy_gwh']], 'annual-cost': ['Mio. €', snapshot.congestion.annual, ['cost_million_eur']], monthly: ['GWh', snapshot.congestion.monthly, ['energy_gwh', 'redispatch_energy_gwh']] };
  Object.entries(expected).forEach(([key, [unit, rows, fields]]) => {
    const chart = result[key];
    expect(Array.isArray(chart.yAxis)).toBe(false);
    expect(chart.yAxis.name).toBe(unit);
    expect(chart.series.map((series) => series.data)).toEqual(fields.map((field) => rows.map((row) => row[field])));
    expect(chart.series.every((series) => !series.stack && !series.yAxisIndex)).toBe(true);
    expect(chart.tooltip.formatter([{ axisValue: '2025', seriesName: 'Test', value: 10 }])).toContain(unit);
  });
  const cost = options(snapshot, colors, 'cost').monthly;
  expect(cost.yAxis.name).toBe('Mio. €');
  expect(cost.series.map((series) => series.data)).toEqual(['cost_million_eur', 'redispatch_cost_million_eur'].map((field) => snapshot.congestion.monthly.map((row) => row[field])));
  expect(result.capacity.series.map((series) => series.lineStyle.type)).toEqual(['solid', 'dashed', 'dotted']);
});
