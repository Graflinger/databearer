const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const DIRECTORY = '2026/energieintensive_industrie';
const CONTRACTS = {
  'production.csv': ['Monat', 'Industrie', 'Energieintensiv'],
  'electricity_prices.csv': ['Halbjahr', 'Deutschland_ct_kWh', 'EU27_ct_kWh', 'Deutschland_Status', 'EU27_Status'],
  'production_annual.csv': ['Zeitraum', 'Monate', 'Industrie', 'Energieintensiv'],
};
const FILES = [...Object.keys(CONTRACTS), 'quality.json'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (condition, message) => {
  if (!condition) throw new Error(`Energieintensive Industrie: ${message}`);
};
const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const close = (a, b, tolerance = 0.0006) => Number.isFinite(a) && Math.abs(a - b) < tolerance;

function validateEnergieintensiveIndustrie(directory = path.join(__dirname, '../data', DIRECTORY)) {
  check(fs.lstatSync(directory).isDirectory(), 'data directory must not be a symlink');
  const read = (name) => {
    const file = path.join(directory, name);
    check(fs.lstatSync(file).isFile(), `${name} must be a regular file`);
    return fs.readFileSync(file);
  };
  check(same(fs.readdirSync(directory).sort(), [...FILES, 'manifest.json'].sort()), 'file allowlist mismatch');
  const metadata = JSON.parse(read('manifest.json'));
  check(metadata.schema_version === 1 && metadata.kind === 'frozen_energieintensive_industrie'
    && metadata.methodology_version === 1, 'manifest schema mismatch');
  check(metadata.reviewed_at === '2026-11-05', 'licence review date mismatch');
  check(same(metadata.period, { production_first: '2018-01', production_last: '2026-08', prices_first: '2018-S1', prices_last: '2026-S1' }), 'period mismatch');
  check(same(Object.keys(metadata.files).sort(), [...FILES].sort()), 'manifest file allowlist mismatch');
  const sources = metadata.sources;
  check(same(Object.keys(sources).sort(), ['press', 'prices', 'production']), 'source allowlist mismatch');
  for (const [key, source] of Object.entries(sources)) {
    const acquisition = source.acquisition;
    check(acquisition?.url === source.url && /^https:\/\//.test(source.url), `${key} acquisition URL mismatch`);
    check(/^2026-11-05T/.test(acquisition.retrieved_at) && Number.isFinite(Date.parse(acquisition.retrieved_at)), `${key} acquisition date mismatch`);
    check(/^[a-f0-9]{64}$/.test(acquisition.sha256) && acquisition.bytes > 0, `${key} source checksum missing`);
    const licence = source.licence || sources[source.licence_ref]?.licence;
    for (const field of ['name', 'version', 'url', 'copyright', 'publisher_wording', 'attribution', 'changes',
      'public_git_redistribution', 'commercial_use', 'database_rights', 'third_party_rights', 'dataset_exceptions']) {
      check(typeof licence?.[field] === 'string' && licence[field].length > 0, `${key} licence ${field} missing`);
    }
  }
  check(sources.production.unit === '2021=100' && sources.production.adjustment.includes('seasonally and calendar'), 'production units/adjustment mismatch');
  check(sources.prices.tax.startsWith('X_VAT:') && sources.prices.band.includes('MWH2000-19999'), 'price tax/band mismatch');
  check(sources.prices.updated === '2026-10-19T11:00:00+0200', 'price revision mismatch');

  const tables = {};
  let quality;
  for (const name of FILES) {
    const bytes = read(name);
    const entry = metadata.files[name];
    check(bytes.length === entry.bytes && createHash('sha256').update(bytes).digest('hex') === entry.sha256, `${name} size/hash mismatch`);
    if (name === 'quality.json') {
      quality = JSON.parse(bytes);
      continue;
    }
    const columns = CONTRACTS[name];
    const records = parse(bytes, { skip_empty_lines: false });
    check(same(entry.columns, columns) && same(records[0], columns), `${name} header mismatch`);
    check(records.length === entry.rows + 1, `${name} row count mismatch`);
    tables[name] = records.slice(1).map((record) => Object.fromEntries(columns.map((column, i) => {
      if (['Monat', 'Halbjahr', 'Zeitraum'].includes(column) || column.endsWith('_Status')) return [column, record[i]];
      const value = Number(record[i]);
      check(record[i] !== '' && Number.isFinite(value) && value > 0 && value < 200, `${name} invalid numeric value`);
      return [column, value];
    })));
  }
  const production = tables['production.csv'];
  const expectedMonths = [];
  for (let year = 2018; year <= 2026; year += 1) {
    for (let month = 1; month <= (year === 2026 ? 8 : 12); month += 1) expectedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  check(same(production.map((r) => r.Monat), expectedMonths), 'production months missing/duplicated/out of order');
  const prices = tables['electricity_prices.csv'];
  const expectedSemesters = expectedMonths.filter((m) => /-(01|07)$/.test(m) && m !== '2026-07').map((m) => `${m.slice(0, 4)}-S${m.endsWith('01') ? 1 : 2}`);
  check(same(prices.map((r) => r.Halbjahr), expectedSemesters), 'price semesters mismatch');
  for (const row of prices) {
    check(row.Deutschland_Status === (row.Halbjahr === '2026-S1' ? 'p' : '') && row.EU27_Status === '', 'price status mismatch');
  }
  const annual = tables['production_annual.csv'];
  check(same(annual.map((r) => r.Zeitraum), ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026 Jan–Aug']), 'annual scope mismatch');
  for (const row of annual) {
    const selected = production.filter((r) => r.Monat.startsWith(row.Zeitraum.slice(0, 4)));
    check(row.Monate === selected.length && ['Industrie', 'Energieintensiv'].every((k) => close(row[k], mean(selected, k))), 'annual mean mismatch');
  }
  check(quality.schema_version === 1 && quality.production_months === 104 && quality.price_semesters === 17
    && quality.missing_values === 0 && quality.duplicate_keys === 0 && Array.isArray(quality.notes), 'quality structure mismatch');
  const press = { energy_intensive_mom_sa_ca_pct: -0.5, energy_intensive_yoy_ca_pct: -2.1,
    energy_intensive_three_month_sa_ca_pct: -2.9, energy_use_share_2021_pct_as_reported: 77, gross_value_added_share_2021_pct_as_reported: 17 };
  check(same(Object.keys(quality.press_release).sort(), Object.keys(press).sort())
    && Object.entries(press).every(([key, value]) => quality.press_release[key] === value), 'press evidence mismatch');
  for (const [key, column] of [['industry', 'Industrie'], ['energy_intensive', 'Energieintensiv']]) {
    const latest = production.at(-1)[column];
    const month = (m) => production.find((r) => r.Monat === m)[column];
    const group = (start, end) => mean(production.filter((r) => r.Monat >= start && r.Monat <= end), column);
    const expected = { latest,
      vs_february_2022_pct: (latest / month('2022-02') - 1) * 100,
      vs_2018_mean_pct: (latest / group('2018-01', '2018-12') - 1) * 100,
      vs_2021_mean_pct: (latest / group('2021-01', '2021-12') - 1) * 100,
      month_on_month_pct: (latest / month('2026-07') - 1) * 100,
      three_month_pct: (group('2026-06', '2026-08') / group('2026-03', '2026-05') - 1) * 100 };
    for (const [metric, value] of Object.entries(expected)) check(close(quality.calculated[key][metric], value), `${key} ${metric} mismatch`);
  }
  const latest = prices.at(-1);
  const expectedPrices = { de_latest_ct_kwh: latest.Deutschland_ct_kWh, eu_latest_ct_kwh: latest.EU27_ct_kWh,
    de_premium_pct: (latest.Deutschland_ct_kWh / latest.EU27_ct_kWh - 1) * 100,
    de_vs_2025_s1_pct: (latest.Deutschland_ct_kWh / prices.at(-3).Deutschland_ct_kWh - 1) * 100,
    de_vs_2018_s1_pct: (latest.Deutschland_ct_kWh / prices[0].Deutschland_ct_kWh - 1) * 100 };
  for (const [metric, value] of Object.entries(expectedPrices)) check(close(quality.calculated.prices[metric], value), `${metric} mismatch`);
  return { metadata, production, prices, annual, quality };
}

module.exports = { validateEnergieintensiveIndustrie, DIRECTORY };
