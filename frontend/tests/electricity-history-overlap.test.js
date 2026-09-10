/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const electricity = require('../src/js/dashboards/electricity-data');
const history = require('../src/js/dashboards/electricity-history');
const { readHistory, verifyPartition } = require('../src/data_ingestion/builders/electricityHistory');
const { verifySnapshot } = require('../src/data_ingestion/builders/electricitySnapshot');
const { midnight, nextDate } = require('./fixtures/electricity-history');

const HOUR = electricity.HOUR;
const iso = (time) => new Date(time).toISOString().replace('.000Z', 'Z');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
function recentBytes(recent) {
  const semantic = { ...recent };
  delete semantic.content_hash;
  delete semantic.snapshot_created_at;
  return `${canonical({ ...recent, content_hash: sha256(canonical(semantic)) })}\n`;
}
function fixture(lastDate = '2025-01-02', firstYear) {
  const endDate = nextDate(lastDate);
  const startDate = new Date(Date.parse(`${endDate}T00:00:00Z`) - 30 * 24 * HOUR).toISOString().slice(0, 10);
  const start = midnight(startDate);
  const end = midnight(endDate);
  const recent = { schema_version: 1, source: electricity.SOURCE, timezone: electricity.TIMEZONE,
    window_start: iso(start), window_end: iso(end), data_through: iso(end),
    snapshot_created_at: iso(end + HOUR), columns: electricity.COLUMNS, rows: [],
    units: { power: 'GW', price: 'EUR/MWh' }, expected_update: 'daily', stale_after_hours: 96 };
  for (let time = start; time < end; time += HOUR) {
    recent.rows.push([time, ...electricity.SOURCES.map((source) => source.index), 15, 0]);
  }
  const partitions = [];
  for (let year = firstYear || Number(startDate.slice(0, 4)); year <= Number(lastDate.slice(0, 4)); year++) {
    const rows = [];
    for (let date = `${year}-01-01`; date <= lastDate && date.startsWith(`${year}-`); date = nextDate(date)) {
      const hours = (midnight(nextDate(date)) - midnight(date)) / HOUR;
      rows.push({ date, hours,
        energy_gwh: { ...Object.fromEntries(electricity.SOURCES.map((source) => [source.key, source.index * hours])), nuclear: 0, load: 15 * hours },
        price_eur_mwh: 0, price_zone: 'DE-LU', nuclear_derived_zero: true });
    }
    partitions.push({ schema_version: 1, source: electricity.SOURCE, timezone: electricity.TIMEZONE, year, rows });
  }
  return { recent, partitions };
}
function writeHistory(directory, partitions) {
  const years = partitions.map((partition, index) => {
    const raw = Buffer.from(canonical(partition));
    const hash = sha256(raw);
    const entry = { year: partition.year, url: `${history.PREFIX}${partition.year}.${hash}.json`, sha256: hash,
      first_date: partition.rows[0].date, last_date: partition.rows.at(-1).date,
      days: partition.rows.length, frozen: index < partitions.length - 1 };
    // Each generated test artifact must be valid independently before integration.
    verifyPartition(raw, entry);
    fs.writeFileSync(path.join(directory, path.basename(entry.url)), raw);
    return entry;
  });
  const manifest = { schema_version: 1, kind: 'german-electricity-history', timezone: electricity.TIMEZONE,
    source: electricity.SOURCE, first_date: years[0].first_date, last_date: years.at(-1).last_date,
    years, revision_policy: history.POLICY };
  history.validateManifest(manifest);
  fs.writeFileSync(path.join(directory, 'manifest.json'), canonical(manifest));
}
let directory;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse('2026-01-10T00:00:00Z'));
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'electricity-overlap-'));
});
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); jest.useRealTimers(); });
function build(input) {
  writeHistory(directory, input.partitions);
  const raw = recentBytes(input.recent);
  verifySnapshot(raw);
  return readHistory(directory, raw);
}

test.each(['2024-03-31', '2024-10-27', '2024-12-31', '2025-01-02'])('aligned raw artifacts pass through %s, including DST and January', (date) => {
  const result = build(fixture(date));
  expect(result.overlap).toEqual({ days: 30, last_date: date });
});

test('a partial prior-year history at a January run is accepted when its cutoff matches recent', () => {
  const result = build(fixture('2024-12-30'));
  expect(result.overlap).toEqual({ days: 30, last_date: '2024-12-30' });
});

test('a valid subset starting January compares only shared dates', () => {
  expect(build(fixture('2025-01-02', 2025)).overlap.days).toBe(2);
});

test.each(['biomass', 'hydro', 'wind_offshore', 'wind_onshore', 'solar', 'other_renewables',
  'lignite', 'hard_coal', 'gas', 'other_conventional', 'pumped_storage', 'load', 'price'])(
  'valid rehashed history with revised %s fails integration', (column) => {
  const input = fixture();
  const row = input.partitions.at(-1).rows.at(-1);
  if (column === 'price') row.price_eur_mwh += 0.02;
  else row.energy_gwh[column] += 0.00533;
  expect(() => build(input)).toThrow(`History/recent mismatch ${row.date}/${column}`);
  });

test('valid rehashed recent source revision fails against otherwise valid history', () => {
  const input = fixture();
  input.recent.rows.at(-1)[electricity.COLUMNS.indexOf('wind_onshore')] += 0.00533;
  expect(() => build(input)).toThrow('2025-01-02/wind_onshore');
});

test('January overlap also detects a revised December value in the prior-year partition', () => {
  const input = fixture();
  input.partitions[0].rows.at(-1).energy_gwh.solar += 0.01;
  expect(() => build(input)).toThrow('2024-12-31/solar');
});

test('values outside recent coverage do not become an unsupported historical hourly check', () => {
  const input = fixture();
  input.partitions[0].rows[0].energy_gwh.solar += 1;
  expect(build(input).overlap.days).toBe(30);
});

test.each(['2024-03-31', '2024-10-27', '2025-01-02'])('energy rounding allowance uses actual day hours on %s', (date) => {
  const input = fixture(date);
  const row = input.partitions.at(-1).rows.at(-1);
  const base = row.energy_gwh.solar;
  const tolerance = (row.hours + 1) * 0.005 / 1000 + 1e-8;
  row.energy_gwh.solar = base + tolerance - 1e-9;
  expect(build(input).overlap.days).toBe(30);
  row.energy_gwh.solar = base + tolerance + 1e-9;
  expect(() => build(input)).toThrow(`${date}/solar`);
});

test.each([-1, 1])('price tolerance is inclusive and absolute (sign %i)', (sign) => {
  const input = fixture();
  const row = input.partitions.at(-1).rows.at(-1);
  row.price_eur_mwh = sign * 0.011;
  expect(build(input).overlap.days).toBe(30);
  row.price_eur_mwh = sign * (0.011 + 1e-9);
  expect(() => build(input)).toThrow('/price');
});

test.each(['2025-01-01', '2025-01-03'])('individually valid but differently dated history %s is rejected', (date) => {
  const input = fixture();
  input.partitions = fixture(date).partitions;
  expect(() => build(input)).toThrow('History/recent cutoff mismatch');
});

test('missing overlap dates, null observations and incorrect day hours fail schema validation first', () => {
  const original = fixture();
  const raw = recentBytes(original.recent);
  for (const mutate of [
    (p) => { p.rows[0].date = p.rows[1].date; },
    (p) => { p.rows[0].energy_gwh.load = null; },
    (p) => { p.rows[0].price_eur_mwh = null; },
    (p) => { p.rows[0].hours = 23; },
  ]) {
    const input = fixture();
    const p = input.partitions.at(-1);
    mutate(p);
    // Deliberately publish an invalid but freshly hashed candidate in the temp set.
    writeHistory(directory, original.partitions);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
    const entry = manifest.years.at(-1);
    const bytes = canonical(p);
    entry.sha256 = sha256(bytes);
    entry.url = `${history.PREFIX}${p.year}.${entry.sha256}.json`;
    fs.writeFileSync(path.join(directory, path.basename(entry.url)), bytes);
    fs.writeFileSync(path.join(directory, 'manifest.json'), canonical(manifest));
    expect(() => readHistory(directory, raw)).toThrow('Stromhistorie:');
  }
});

test('alternate recent input must pass exact producer-byte and hash verification', () => {
  const input = fixture();
  writeHistory(directory, input.partitions);
  const raw = recentBytes(input.recent);
  expect(() => readHistory(directory, raw)).not.toThrow();
  expect(() => readHistory(directory, raw.replace('"price":"EUR/MWh"', '"price":"invalid"'))).toThrow();
  expect(() => readHistory(directory, raw.replace('"content_hash":"', '"content_hash":"0'))).toThrow();
  const changed = JSON.parse(raw);
  changed.rows[0][1] += 0.001;
  expect(() => readHistory(directory, `${canonical(changed)}\n`)).toThrow('content_hash');
  expect(() => readHistory(directory, raw.trimEnd())).toThrow();
  expect(() => readHistory(directory, JSON.parse(raw))).toThrow();
});
