const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const DIRECTORY = '2026/negative_strompreise';
const YEARS = [2024, 2025, 2026];
const ANNUAL_YEARS = Array.from({ length: 7 }, (_, index) => String(2019 + index));
const SUMMARY = ['Erwartete_Stunden', 'Bekannte_Stunden', 'Negative_Stunden', 'Anteil_Prozent',
  'Minimum_EUR_MWh', 'Negativmittel_EUR_MWh', 'Laengste_Phase_Stunden'];
const CONTRACTS = {
  'annual.csv': { rows: 7, columns: ['Zeitraum', ...SUMMARY] },
  'year_to_date.csv': { rows: 3, columns: ['Zeitraum', ...SUMMARY] },
  'monthly.csv': { rows: 94, columns: ['Monat', ...SUMMARY] },
  'quarterly.csv': { rows: 9, columns: ['Zeitraum', ...SUMMARY] },
  'midday.csv': { rows: 24, columns: ['Stunde', ...YEARS.flatMap((year) =>
    [`Anteil_${year}_Prozent`, `Negativ_${year}_Stunden`, `Bekannt_${year}_Stunden`])] },
  'battery.csv': { rows: 7, columns: ['Jahr', 'Leistung_GW', 'Energie_GWh', 'Anlagen'] },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const close = (a, b, tolerance = 0.000001) => Math.abs(a - b) <= tolerance;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const safeName = (name) => typeof name === 'string' && /^[a-zA-Z0-9_-]+\.(csv|json)$/.test(name);
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

function requireValid(condition, message) {
  if (!condition) throw new Error(`Negative Strompreise: ${message}`);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) return false;
  return validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

// In the frozen 2019–2026 Berlin calendar, month boundaries April–October
// are UTC+2, all others UTC+1. March loses an hour; October gains one.
function monthBoundary(year, month) {
  const offset = month >= 4 && month <= 10 ? 2 : 1;
  return Date.UTC(year, month - 1, 1) - offset * 3600000;
}

function monthHours(month) {
  const [year, number] = month.split('-').map(Number);
  const next = number === 12 ? monthBoundary(year + 1, 1) : monthBoundary(year, number + 1);
  return (next - monthBoundary(year, number)) / 3600000;
}

function expectedMonths() {
  return Array.from({ length: 94 }, (_, index) => `${2019 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`);
}

function validateProvenance(metadata) {
  requireValid(metadata.schema_version === 1 && metadata.methodology_version === 1
    && metadata.kind === 'frozen_negative_strompreise_article' && metadata.status === 'validated'
    && metadata.topic_id === 'negative-strompreise', 'manifest schema/kind/status mismatch');
  requireValid(metadata.period_start === '2019-01-01' && metadata.observation_cutoff === '2026-10-31'
    && metadata.interval_change === '2025-10-01' && metadata.timezone === 'Europe/Berlin'
    && metadata.price_area_source === 'DE' && metadata.price_area_interpreted === 'DE-LU', 'period/timezone/price area mismatch');
  requireValid(validDate(metadata.checked_on) && validTimestamp(metadata.data_acquired_at)
    && metadata.data_acquired_at.slice(0, 10) <= metadata.checked_on
    && metadata.data_acquired_at.slice(0, 10) > metadata.observation_cutoff, 'acquisition/check dates invalid');
  const sources = metadata.sources;
  requireValid(Array.isArray(sources) && same(sources.map((source) => source.id).sort(),
    ['energinet-de-day-ahead', 'energy-charts-de-lu-prices', 'mastr-battery-aggregates', 'smard-wholesale-prices']), 'source allowlist mismatch');
  for (const source of sources) {
    const used = ['energinet-de-day-ahead', 'mastr-battery-aggregates'].includes(source.id);
    requireValid(source.used === used, `${source.id} source use mismatch (SMARD prices must not be used)`);
    requireValid(validDate(source.checked_on) && source.checked_on <= metadata.checked_on, `${source.id} source check date invalid`);
    requireValid(typeof source.terms_url === 'string' && source.terms_url.startsWith('https://'), `${source.id} terms missing`);
    if (used) requireValid(typeof source.planned_attribution === 'string' && source.planned_attribution.length > 20
      && typeof source.modifications_notice === 'string' && source.modifications_notice.length > 20, `${source.id} attribution missing`);
  }
  const price = sources.find((source) => source.id === 'energinet-de-day-ahead');
  requireValid(price.declared_licence === 'CC BY 4.0' && price.licence_url === 'https://creativecommons.org/licenses/by/4.0/'
    && price.decision === 'usable_with_conditions'
    && price.terms_url === 'https://www.energidataservice.dk/terms-and-conditions', 'Energinet licence mismatch');
  const battery = sources.find((source) => source.id === 'mastr-battery-aggregates');
  requireValid(battery.declared_licence === 'Datenlizenz Deutschland – Namensnennung – Version 2.0'
    && battery.licence_url === 'https://www.govdata.de/dl-de/by-2-0', 'MaStR licence mismatch');

  const raw = metadata.raw_inputs;
  requireValid(Array.isArray(raw) && raw.length === 2, 'raw input allowlist mismatch');
  const rawContracts = [
    ['Elspotprices', '2019-01-01', '2025-10-01', 'HourUTC', 'SpotPriceEUR', 59159],
    ['DayAheadPrices', '2025-10-01', '2026-11-01', 'TimeUTC', 'DayAheadPriceEUR', 38020],
  ];
  raw.forEach((input, index) => {
    const [dataset, start, end, timeKey, priceKey, records] = rawContracts[index];
    requireValid(safeName(input.filename) && input.filename === `${dataset}.json`
      && validHash(input.sha256) && positiveInteger(input.bytes) && input.records === records, 'raw input identity/hash/count invalid');
    requireValid(validTimestamp(input.retrieved_at) && Date.parse(input.retrieved_at) >= Date.parse('2026-11-01T00:00:00Z')
      && Date.parse(input.retrieved_at) <= Date.parse(metadata.data_acquired_at), 'raw input retrieval date invalid');
    const url = new URL(input.url);
    requireValid(url.origin === 'https://api.energidataservice.dk' && url.pathname === `/dataset/${dataset}`
      && !url.username && !url.password && !url.hash
      && url.searchParams.get('start') === start && url.searchParams.get('end') === end
      && url.searchParams.get('columns') === `${timeKey},PriceArea,${priceKey}`
      && same(JSON.parse(url.searchParams.get('filter')), { PriceArea: ['DE'] }), 'raw input HTTP source/window mismatch');
  });
  requireValid(Date.parse(metadata.data_acquired_at) === Math.max(...raw.map((input) => Date.parse(input.retrieved_at))), 'acquisition date does not match raw inputs');
  requireValid(metadata.exporter?.path === 'pipeline/src/data_pipelines/export_data/2026/negative_strompreise/export.py'
    && validHash(metadata.exporter.sha256), 'exporter identity/hash missing');
  const input = metadata.battery_input;
  requireValid(input?.path === 'frontend/src/data_ingestion/data/2026/battery_storage/battery_storage_yearly.csv'
    && validHash(input.sha256) && positiveInteger(input.bytes) && positiveInteger(input.rows)
    && same(input.columns, ['snapshot_date', 'commissioning_year', 'size_segment', 'plant_count', 'unit_count',
      'power_gw', 'energy_gwh', 'median_duration_hours', 'network_verified_plant_count', 'period_complete']), 'battery input must be the MaStR cohort aggregate only');
  requireValid(validDate(input.snapshot_date) && input.snapshot_date === '2026-09-26'
    && input.snapshot_date <= metadata.data_acquired_at.slice(0, 10)
    && input.interpretation === 'Operating plants observed at snapshot, grouped by commissioning year; not historical total stock or net annual additions.', 'battery snapshot/scope mismatch');
  requireValid(metadata.quality?.intervals === raw.reduce((total, item) => total + item.records, 0)
    && ['null_intervals', 'duplicates', 'omitted_intervals', 'interpolated_intervals'].every((key) => metadata.quality[key] === 0), 'quality must describe complete, unmodified interval coverage');
}

function validateSummary(row, expected, step, label) {
  requireValid(row.Erwartete_Stunden === expected && row.Bekannte_Stunden === expected, `${label} expected/known hours mismatch (Berlin calendar)`);
  requireValid(row.Negative_Stunden >= 0 && row.Negative_Stunden <= expected
    && Number.isInteger(row.Negative_Stunden / step), `${label} negative duration invalid`);
  requireValid(close(row.Anteil_Prozent, row.Negative_Stunden / expected * 100, 0.000051), `${label} percentage mismatch`);
  requireValid(row.Minimum_EUR_MWh >= -1000 && row.Minimum_EUR_MWh <= 10000, `${label} minimum out of bounds`);
  if (row.Negative_Stunden === 0) {
    requireValid(row.Negativmittel_EUR_MWh === null && row.Minimum_EUR_MWh >= 0
      && row.Laengste_Phase_Stunden === 0, `${label} no-negative mean/phase mismatch`);
  } else {
    requireValid(row.Negativmittel_EUR_MWh !== null && row.Negativmittel_EUR_MWh < 0
      && row.Minimum_EUR_MWh <= row.Negativmittel_EUR_MWh, `${label} negative depth/mean invalid`);
    requireValid(row.Laengste_Phase_Stunden >= step && row.Laengste_Phase_Stunden <= row.Negative_Stunden
      && Number.isInteger(row.Laengste_Phase_Stunden / step), `${label} phase duration invalid`);
  }
}

function reconcile(row, months) {
  const label = row.Zeitraum;
  for (const key of ['Erwartete_Stunden', 'Bekannte_Stunden', 'Negative_Stunden']) {
    requireValid(close(row[key], sum(months, key)), `${label} monthly ${key} reconciliation mismatch`);
  }
  requireValid(close(row.Minimum_EUR_MWh, Math.min(...months.map((month) => month.Minimum_EUR_MWh))), `${label} monthly minimum mismatch`);
  if (row.Negative_Stunden > 0) {
    const weighted = months.reduce((total, month) => total + (month.Negativmittel_EUR_MWh ?? 0) * month.Negative_Stunden, 0) / row.Negative_Stunden;
    // Both the monthly inputs and aggregate are rounded to four decimals.
    requireValid(close(row.Negativmittel_EUR_MWh, weighted, 0.000101), `${label} weighted negative mean mismatch`);
  }
  // Runs can cross month boundaries; an aggregate run is not necessarily the
  // longest monthly run, but lies between the maximum and sum of clipped runs.
  requireValid(row.Laengste_Phase_Stunden >= Math.max(...months.map((month) => month.Laengste_Phase_Stunden))
    && row.Laengste_Phase_Stunden <= sum(months, 'Laengste_Phase_Stunden'), `${label} monthly phase bounds mismatch`);
}

/** Validate the complete frozen package before chart generation; never fetch data. */
function validateNegativeStrompreise(dataDir = path.join(__dirname, '../data', DIRECTORY)) {
  requireValid(fs.lstatSync(dataDir).isDirectory(), 'package must be a regular directory');
  requireValid(same(fs.readdirSync(dataDir).sort(), ['manifest.json', ...Object.keys(CONTRACTS)].sort()), 'package file allowlist mismatch');
  const read = (name) => {
    requireValid(safeName(name), 'unsafe payload basename');
    const filename = path.join(dataDir, name);
    requireValid(fs.lstatSync(filename).isFile(), `${name} must be a regular file (no symlinks)`);
    return fs.readFileSync(filename);
  };
  const metadata = JSON.parse(read('manifest.json').toString('utf8'));
  validateProvenance(metadata);
  requireValid(metadata.files && same(Object.keys(metadata.files).sort(), Object.keys(CONTRACTS).sort()), 'manifest file allowlist mismatch');
  const tables = {};
  for (const [name, contract] of Object.entries(CONTRACTS)) {
    const entry = metadata.files[name];
    const bytes = read(name);
    requireValid(positiveInteger(entry?.bytes) && validHash(entry.sha256)
      && bytes.length === entry.bytes && createHash('sha256').update(bytes).digest('hex') === entry.sha256, `${name} size/hash mismatch`);
    requireValid(entry.rows === contract.rows && same(entry.columns, contract.columns), `${name} column/row contract mismatch`);
    const records = parse(bytes, { skip_empty_lines: false });
    requireValid(same(records[0], contract.columns) && records.length === contract.rows + 1, `${name} header/row count mismatch`);
    tables[name] = records.slice(1).map((values) => Object.fromEntries(contract.columns.map((column, index) => {
      if (index === 0) return [column, values[index]];
      // An empty mean is defined only for periods without negative prices.
      if (column === 'Negativmittel_EUR_MWh' && values[index] === '') return [column, null];
      requireValid(/^-?\d+(?:\.\d+)?$/.test(values[index]) && Number.isFinite(Number(values[index])), `${name} ${column} must be finite and nonempty`);
      return [column, Number(values[index])];
    })));
  }
  const monthly = tables['monthly.csv'];
  requireValid(same(monthly.map((row) => row.Monat), expectedMonths()), 'monthly periods must be 2019-01..2026-10 in order');
  for (const row of monthly) validateSummary(row, monthHours(row.Monat), row.Monat < '2025-10' ? 1 : 0.25, row.Monat);
  const annual = tables['annual.csv'];
  const yearToDate = tables['year_to_date.csv'];
  const quarterly = tables['quarterly.csv'];
  requireValid(same(annual.map((row) => row.Zeitraum), ANNUAL_YEARS), 'annual periods must be complete 2019..2025');
  requireValid(same(yearToDate.map((row) => row.Zeitraum), YEARS.map((year) => `${year} Jan–Okt`)), 'year-to-date periods must be Jan–Okt 2024..2026');
  requireValid(same(quarterly.map((row) => row.Zeitraum), YEARS.flatMap((year) => [1, 2, 3].map((quarter) => `${year} Q${quarter}`))), 'quarterly periods must be Q1–Q3 2024..2026');
  for (const row of [...annual, ...yearToDate, ...quarterly]) {
    const year = row.Zeitraum.slice(0, 4);
    const quarter = row.Zeitraum.match(/Q([1-3])$/);
    const months = monthly.filter((month) => month.Monat.startsWith(year)
      && (!row.Zeitraum.includes('Jan–Okt') || Number(month.Monat.slice(5)) <= 10)
      && (!quarter || Math.ceil(Number(month.Monat.slice(5)) / 3) === Number(quarter[1])));
    validateSummary(row, sum(months, 'Erwartete_Stunden'), months.at(-1).Monat < '2025-10' ? 1 : 0.25, row.Zeitraum);
    reconcile(row, months);
  }
  const midday = tables['midday.csv'];
  requireValid(same(midday.map((row) => row.Stunde), Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)), 'midday hours must be 00:00..23:00 in order');
  for (const year of YEARS) {
    const negativeKey = `Negativ_${year}_Stunden`;
    const knownKey = `Bekannt_${year}_Stunden`;
    for (const row of midday) {
      requireValid(row[knownKey] === 91 && row[negativeKey] >= 0 && row[negativeKey] <= 91
        && Number.isInteger(row[negativeKey] / (year < 2026 ? 1 : 0.25)), `${year} midday coverage/duration invalid`);
      requireValid(close(row[`Anteil_${year}_Prozent`], row[negativeKey] / row[knownKey] * 100, 0.000051), `${year} midday percentage mismatch`);
    }
    const quarter = quarterly.find((row) => row.Zeitraum === `${year} Q2`);
    requireValid(sum(midday, negativeKey) === quarter.Negative_Stunden && sum(midday, knownKey) === quarter.Bekannte_Stunden, `${year} midday/Q2 reconciliation mismatch`);
  }
  const battery = tables['battery.csv'];
  requireValid(same(battery.map((row) => row.Jahr), ANNUAL_YEARS), 'battery commissioning years must be 2019..2025');
  for (const row of battery) requireValid(row.Leistung_GW > 0 && row.Energie_GWh > 0
    && positiveInteger(row.Anlagen), `${row.Jahr} battery capacity/count invalid`);
  return { metadata, annual, yearToDate, monthly, quarterly, midday, battery };
}

module.exports = { validateNegativeStrompreise, DIRECTORY };
