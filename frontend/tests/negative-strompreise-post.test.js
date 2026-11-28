const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');
const { validateNegativeStrompreise, DIRECTORY } = require('../src/data_ingestion/utils/negativeStrompreiseValidation');

const DATA = path.resolve(__dirname, '../src/data_ingestion/data', DIRECTORY);
const PAYLOADS = ['annual.csv', 'year_to_date.csv', 'monthly.csv', 'quarterly.csv', 'midday.csv', 'battery.csv'];

describe('negative-price frozen evidence package', () => {
  let copy;
  beforeEach(() => {
    copy = fs.mkdtempSync(path.join(os.tmpdir(), 'negative-strompreise-'));
    for (const name of fs.readdirSync(DATA)) fs.copyFileSync(path.join(DATA, name), path.join(copy, name));
  });
  afterEach(() => fs.rmSync(copy, { recursive: true, force: true }));

  function editManifest(edit) {
    const file = path.join(copy, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    edit(manifest);
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  // Semantic mutations repair the hash/size so a hash check cannot mask a
  // missing semantic guard. The fixtures always start from the real package.
  function editCsv(name, edit) {
    const file = path.join(copy, name);
    const records = parse(fs.readFileSync(file), { columns: true });
    const columns = Object.keys(records[0]);
    edit(records);
    const bytes = Buffer.from(`${columns.join(',')}\n${records.map((row) => columns.map((key) => row[key]).join(',')).join('\n')}\n`);
    fs.writeFileSync(file, bytes);
    editManifest((manifest) => {
      manifest.files[name].sha256 = createHash('sha256').update(bytes).digest('hex');
      manifest.files[name].bytes = bytes.length;
      manifest.files[name].rows = records.length;
    });
  }

  test('validates all seven files and preserves complete-year and equal-window comparisons', () => {
    const data = validateNegativeStrompreise(copy);
    expect(data.annual.map((row) => row.Zeitraum)).toEqual(['2019', '2020', '2021', '2022', '2023', '2024', '2025']);
    expect(data.yearToDate.map((row) => row.Zeitraum)).toEqual(['2024 Jan–Okt', '2025 Jan–Okt', '2026 Jan–Okt']);
    expect(data.monthly).toHaveLength(94);
    expect(data.quarterly).toHaveLength(9);
    expect(data.midday).toHaveLength(24);
    expect(data.battery).toHaveLength(7);
    expect(data.annual.slice(-2).map((row) => row.Negative_Stunden)).toEqual([459, 574.75]);
    expect(data.quarterly.filter((row) => ['2025 Q2', '2026 Q2'].includes(row.Zeitraum))
      .map((row) => [row.Negative_Stunden, row.Minimum_EUR_MWh, row.Laengste_Phase_Stunden]))
      .toEqual([[345, -250.32, 10], [251.5, -499.99, 17]]);
    expect(data.monthly.find((row) => row.Monat === '2019-07').Negativmittel_EUR_MWh).toBeNull();
    expect(data.monthly.find((row) => row.Monat === '2024-03').Erwartete_Stunden).toBe(743);
    expect(data.monthly.find((row) => row.Monat === '2024-10').Erwartete_Stunden).toBe(745);
    expect(data.annual.find((row) => row.Zeitraum === '2024').Erwartete_Stunden).toBe(8784);
  });

  test.each(['manifest.json', ...PAYLOADS])('rejects missing %s including uncharted evidence', (name) => {
    fs.unlinkSync(path.join(copy, name));
    expect(() => validateNegativeStrompreise(copy)).toThrow('package file allowlist mismatch');
  });

  test.each(PAYLOADS)('rejects corruption of %s', (name) => {
    fs.appendFileSync(path.join(copy, name), '\n');
    expect(() => validateNegativeStrompreise(copy)).toThrow('size/hash mismatch');
  });

  test.each(['raw.json', 'smard.csv', 'battery_storage_daily_profile.csv', '.DS_Store'])('rejects extra/support/source payload %s', (name) => {
    fs.writeFileSync(path.join(copy, name), 'not part of the frozen package');
    expect(() => validateNegativeStrompreise(copy)).toThrow('package file allowlist mismatch');
  });

  test.each(['manifest.json', ...PAYLOADS])('rejects symlinked %s even when target bytes are valid', (name) => {
    fs.unlinkSync(path.join(copy, name));
    fs.symlinkSync(path.join(DATA, name), path.join(copy, name));
    expect(() => validateNegativeStrompreise(copy)).toThrow('regular file');
  });

  test('rejects a symlinked package directory', () => {
    const link = path.join(copy, 'package-link');
    fs.symlinkSync(DATA, link, 'dir');
    expect(() => validateNegativeStrompreise(link)).toThrow('regular directory');
  });

  test('rejects a directory in place of a payload', () => {
    fs.unlinkSync(path.join(copy, 'battery.csv'));
    fs.mkdirSync(path.join(copy, 'battery.csv'));
    expect(() => validateNegativeStrompreise(copy)).toThrow('regular file');
  });

  test('rejects a mixed manifest and payload set', () => {
    editManifest((manifest) => { manifest.files['annual.csv'] = manifest.files['quarterly.csv']; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('size/hash mismatch');
  });

  test.each(['../annual.csv', '/annual.csv', 'support.csv'])('rejects unsafe or extra manifest entry %s', (name) => {
    editManifest((manifest) => { manifest.files[name] = manifest.files['annual.csv']; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('manifest file allowlist mismatch');
  });

  test.each([
    ['schema_version', 2], ['methodology_version', 2], ['status', 'audit'], ['kind', 'live_dashboard'],
    ['period_start', '2020-01-01'], ['observation_cutoff', '2026-11-30'], ['interval_change', '2025-09-30'],
    ['timezone', 'UTC'], ['price_area_interpreted', 'DE-AT-LU'], ['checked_on', '2026-02-30'],
    ['data_acquired_at', '2026-02-30T12:00:00Z'], ['data_acquired_at', '2026-11-04T23:00:00Z'],
  ])('rejects invalid manifest %s', (key, value) => {
    editManifest((manifest) => { manifest[key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow();
  });

  test.each(['smard-wholesale-prices', 'energy-charts-de-lu-prices'])('rejects %s used for price evidence', (id) => {
    editManifest((manifest) => { manifest.sources.find((source) => source.id === id).used = true; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('source use mismatch');
  });

  test.each(['energinet-de-day-ahead', 'mastr-battery-aggregates'])('requires source licence and attribution for %s', (id) => {
    editManifest((manifest) => { manifest.sources.find((source) => source.id === id).declared_licence = 'unknown'; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('licence mismatch');
  });

  test('rejects invalid source check dates', () => {
    editManifest((manifest) => { manifest.sources[0].checked_on = '2026-02-29'; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('source check date invalid');
  });

  test.each([
    ['retrieved_at', '2026-04-31T00:00:00Z'], ['retrieved_at', '2026-10-31T00:00:00Z'],
    ['retrieved_at', '2027-01-01T00:00:00Z'], ['sha256', 'invalid'], ['records', 1],
    ['filename', '../Elspotprices.json'], ['url', 'https://www.smard.de/dataset/Elspotprices'],
  ])('rejects invalid raw input %s = %s', (key, value) => {
    editManifest((manifest) => { manifest.raw_inputs[0][key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow();
  });

  test('rejects a valid HTTP URL with the wrong source date window', () => {
    editManifest((manifest) => {
      const url = new URL(manifest.raw_inputs[1].url);
      url.searchParams.set('start', '2025-10-02');
      manifest.raw_inputs[1].url = url.href;
    });
    expect(() => validateNegativeStrompreise(copy)).toThrow('source/window mismatch');
  });

  test.each(['null_intervals', 'duplicates', 'omitted_intervals', 'interpolated_intervals'])('rejects incomplete quality: %s', (key) => {
    editManifest((manifest) => { manifest.quality[key] = 1; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('quality');
  });

  test.each([
    ['path', 'frontend/src/data_ingestion/data/2026/battery_storage/battery_storage_daily_profile.csv'],
    ['snapshot_date', '2026-09-31'], ['interpretation', 'Net additions and historical battery stock'],
  ])('rejects mixed or misinterpreted battery provenance: %s', (key, value) => {
    editManifest((manifest) => { manifest.battery_input[key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow(/battery/);
  });

  test('rejects changed headers even with consistent manifest and hash', () => {
    const file = path.join(copy, 'annual.csv');
    const bytes = Buffer.from(fs.readFileSync(file, 'utf8').replace('Negative_Stunden', 'Negative_Viertelstunden'));
    fs.writeFileSync(file, bytes);
    editManifest((manifest) => {
      manifest.files['annual.csv'].columns[3] = 'Negative_Viertelstunden';
      manifest.files['annual.csv'].bytes = bytes.length;
      manifest.files['annual.csv'].sha256 = createHash('sha256').update(bytes).digest('hex');
    });
    expect(() => validateNegativeStrompreise(copy)).toThrow('column/row contract');
  });

  test('rejects missing months with a repaired row count/hash', () => {
    editCsv('monthly.csv', (rows) => rows.pop());
    expect(() => validateNegativeStrompreise(copy)).toThrow('column/row contract');
  });

  test.each(['annual.csv', 'year_to_date.csv', 'monthly.csv', 'quarterly.csv', 'midday.csv', 'battery.csv'])('rejects duplicate/reordered keys in %s', (name) => {
    editCsv(name, (rows) => { rows[1] = { ...rows[0] }; });
    expect(() => validateNegativeStrompreise(copy)).toThrow(/periods|hours must|years must/);
  });

  test.each(['', ' ', 'NaN', 'Infinity', '-Infinity', '0x10'])('rejects nonnumeric/empty numeric value %j with repaired hash', (value) => {
    editCsv('monthly.csv', (rows) => { rows[0].Negative_Stunden = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('finite and nonempty');
  });

  test('requires a negative mean when negative hours exist', () => {
    editCsv('monthly.csv', (rows) => { rows[0].Negativmittel_EUR_MWh = ''; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('negative depth/mean');
  });

  test('requires null rather than an invented zero negative mean without negative hours', () => {
    editCsv('monthly.csv', (rows) => { rows.find((row) => row.Monat === '2019-07').Negativmittel_EUR_MWh = 0; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('no-negative mean/phase');
  });

  test.each(['2024-02', '2024-03', '2024-10'])('enforces leap-year/DST calendar duration for %s', (month) => {
    editCsv('monthly.csv', (rows) => {
      const row = rows.find((item) => item.Monat === month);
      row.Erwartete_Stunden = Number(row.Erwartete_Stunden) + 1;
      row.Bekannte_Stunden = row.Erwartete_Stunden;
      row.Anteil_Prozent = (Number(row.Negative_Stunden) / row.Bekannte_Stunden * 100).toFixed(4);
    });
    expect(() => validateNegativeStrompreise(copy)).toThrow('Berlin calendar');
  });

  test.each([
    ['Anteil_Prozent', 99, 'percentage mismatch'],
    ['Negative_Stunden', 1000, 'negative duration invalid'],
    ['Negative_Stunden', 34.25, 'negative duration invalid'],
    ['Minimum_EUR_MWh', -1001, 'minimum out of bounds'],
    ['Negativmittel_EUR_MWh', -100, 'negative depth/mean'],
    ['Laengste_Phase_Stunden', 100, 'phase duration invalid'],
  ])('enforces summary semantics for %s', (key, value, message) => {
    editCsv('monthly.csv', (rows) => { rows[0][key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow(message);
  });

  test('rejects sub-quarter-hour durations after the interval change', () => {
    editCsv('monthly.csv', (rows) => { rows.find((row) => row.Monat === '2026-01').Negative_Stunden = 2.125; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('negative duration invalid');
  });

  test.each(['annual.csv', 'year_to_date.csv', 'quarterly.csv'])('reconciles %s negative duration against months', (name) => {
    editCsv(name, (rows) => {
      rows[0].Negative_Stunden = Number(rows[0].Negative_Stunden) + 1;
      rows[0].Anteil_Prozent = (rows[0].Negative_Stunden / Number(rows[0].Bekannte_Stunden) * 100).toFixed(4);
    });
    expect(() => validateNegativeStrompreise(copy)).toThrow('monthly Negative_Stunden reconciliation mismatch');
  });

  test.each([
    ['Minimum_EUR_MWh', -84, 'monthly minimum mismatch'],
    ['Negativmittel_EUR_MWh', -18, 'weighted negative mean mismatch'],
    ['Laengste_Phase_Stunden', 18, 'monthly phase bounds mismatch'],
  ])('reconciles annual %s against monthly depth and clipped phases', (key, value, message) => {
    editCsv('annual.csv', (rows) => { rows[0][key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow(message);
  });

  test('reconciles the hourly profile with Q2, not all-year exposure', () => {
    editCsv('midday.csv', (rows) => {
      rows[0].Negativ_2026_Stunden = 0.5;
      rows[0].Anteil_2026_Prozent = (0.5 / 91 * 100).toFixed(4);
    });
    expect(() => validateNegativeStrompreise(copy)).toThrow('midday/Q2 reconciliation mismatch');
  });

  test.each([
    ['Bekannt_2024_Stunden', 90, 'midday coverage/duration'],
    ['Negativ_2024_Stunden', 0.25, 'midday coverage/duration'],
    ['Anteil_2024_Prozent', 50, 'midday percentage mismatch'],
  ])('enforces hourly profile %s', (key, value, message) => {
    editCsv('midday.csv', (rows) => { rows[0][key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow(message);
  });

  test.each([['Leistung_GW', 0], ['Energie_GWh', -1], ['Anlagen', 1.5]])('rejects invalid battery %s', (key, value) => {
    editCsv('battery.csv', (rows) => { rows[0][key] = value; });
    expect(() => validateNegativeStrompreise(copy)).toThrow('battery capacity/count invalid');
  });
});

test('four chart configs use only the validated frozen package and stable output paths', () => {
  const configs = require('../src/data_ingestion/charts/negative_strompreise');
  expect(configs.map((config) => [config.type, config.dataFile, config.outputFile, config.containerId])).toEqual([
    ['bar', `${DIRECTORY}/annual.csv`, 'annual.js', 'negative-preise-jahre'],
    ['bar', `${DIRECTORY}/quarterly.csv`, 'quarters.js', 'negative-preise-quartale'],
    ['line', `${DIRECTORY}/midday.csv`, 'midday.js', 'negative-preise-tageszeit'],
    ['bar', `${DIRECTORY}/battery.csv`, 'batteries.js', 'negative-preise-batterien'],
  ]);
  expect(configs.slice(0, 2).map((config) => [config.xKey, config.yKey]))
    .toEqual([['Zeitraum', 'Negative_Stunden'], ['Zeitraum', 'Negative_Stunden']]);
  expect(configs[2].xKey).toBe('Stunde');
  expect(configs[2].seriesKeys).toEqual(['Anteil_2024_Prozent', 'Anteil_2025_Prozent', 'Anteil_2026_Prozent']);
  expect(configs[2].smooth).toBe(false);
  expect([configs[3].xKey, configs[3].yKey]).toEqual(['Jahr', 'Energie_GWh']);
  expect(configs[3].xAxisLabel).toContain('Inbetriebnahmejahr');
  expect(configs[3].yAxisLabel).toContain('GWh');
});
