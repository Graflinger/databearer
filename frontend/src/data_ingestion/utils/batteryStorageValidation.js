const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const MANIFEST = 'battery_storage_metadata.json';
const SNAPSHOT = '2026-06-30';
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const QUALITY_SCOPE = 'Relations with selected_operating_unit_count > 0 (active German operating battery units)';
const MEASURES = ['plant_count', 'unit_count', 'power_gw', 'energy_gwh', 'median_duration_hours', 'network_verified_plant_count'];
const aggregate = (dimension, partial = false) => ['snapshot_date', dimension, 'size_segment', ...MEASURES, ...(partial ? ['period_complete'] : [])];
// Fixed names are the only paths ever read. Never resolve filenames from JSON.
const CONTRACTS = {
  'battery_storage_cohorts.csv': ['Jahr', 'Anzahl_Index', 'Energie_Index', 'Anzahl', 'Leistung_GW', 'Energie_GWh'],
  'battery_storage_segments.csv': ['Jahr', 'Klein_GWh', 'Mittel_GWh', 'Gross_GWh'],
  'battery_storage_duration.csv': ['Jahr', 'Median_Stunden'],
  'battery_storage_daily_profile.csv': ['Stunde', 'Preis_EUR_MWh', 'Solar_GW'],
  'battery_storage_yearly.csv': aggregate('commissioning_year', true),
  'battery_storage_monthly.csv': aggregate('commissioning_month', true),
  'battery_storage_by_state.csv': aggregate('state'),
  'battery_storage_summary.csv': aggregate('operating_status'),
  'battery_storage_duration_distribution.csv': ['Jahr', 'Segment', 'Anzahl', 'P10_Stunden', 'P25_Stunden', 'Median_Stunden', 'P75_Stunden', 'P90_Stunden'],
  'battery_storage_quality.json': null,
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function requireValid(condition, message) {
  if (!condition) throw new Error(`Battery storage validation: ${message}`);
}
function keys(value, expected, label) {
  requireValid(object(value) && same(Object.keys(value).sort(), [...expected].sort()), `${label} fields mismatch`);
}
function json(bytes, label) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    requireValid(object(value), `${label} must be an object`);
    return value;
  } catch (error) {
    throw new Error(`Battery storage validation: invalid ${label}: ${error.message}`);
  }
}

function validateBatteryStorage(dataDir = path.join(__dirname, '../data')) {
  const read = (name) => {
    const filename = path.join(dataDir, name);
    requireValid(fs.lstatSync(filename).isFile(), `${name} must be a regular file, not a symlink`);
    return fs.readFileSync(filename);
  };
  const metadata = json(read(MANIFEST), MANIFEST);
  requireValid(metadata.schema_version === 1 && metadata.kind === 'frozen_battery_article', 'manifest schema/kind mismatch');
  requireValid(metadata.mastr?.snapshot_date === SNAPSHOT && metadata.operating_stock?.snapshot_date === SNAPSHOT, 'MaStR snapshot date mismatch');
  requireValid(metadata.methodology?.index_base_year === 2024 && same(metadata.methodology?.chart_years, YEARS), 'cohort years/base mismatch');
  const profile = metadata.electricity_profile;
  requireValid(profile?.first_local_date === '2026-08-11' && profile?.last_local_date === '2026-09-09'
    && profile?.window_start_utc === '2026-08-10T22:00:00Z' && profile?.window_end_utc_exclusive === '2026-09-09T22:00:00Z'
    && profile?.timezone === 'Europe/Berlin' && profile?.local_days === 30 && profile?.observations_per_hour === 30
    && profile?.input_rows === 720 && profile?.input_grain_minutes === 60
    && profile?.units?.power === 'GW' && profile?.units?.price === 'EUR/MWh', 'electricity profile period/units mismatch');
  keys(metadata.files, Object.keys(CONTRACTS), 'manifest allowlist');

  // These hashes detect incomplete/mixed exports against the authoritative
  // manifest. They are not signatures or protection against coordinated edits.
  for (const [name, columns] of Object.entries(CONTRACTS)) {
    const entry = metadata.files[name];
    keys(entry, columns ? ['sha256', 'bytes', 'columns', 'rows'] : ['sha256', 'bytes'], name);
    requireValid(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && /^[a-f0-9]{64}$/.test(entry.sha256), `${name} invalid size/hash`);
    const bytes = read(name);
    requireValid(bytes.length === entry.bytes && createHash('sha256').update(bytes).digest('hex') === entry.sha256, `${name} size/hash mismatch`);
    if (!columns) {
      validateQuality(json(bytes, name));
      continue;
    }
    requireValid(same(entry.columns, columns) && Number.isSafeInteger(entry.rows) && entry.rows > 0, `${name} CSV contract mismatch`);
    // Parse arrays first: duplicate/extra headers and ragged records must fail.
    const records = parse(bytes, { skip_empty_lines: false });
    requireValid(same(records[0], columns) && records.length === entry.rows + 1, `${name} CSV headers/row count mismatch`);
    for (const values of records.slice(1)) {
      requireValid(values.length === columns.length && values.every((value) => value !== ''), `${name} invalid CSV record`);
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      if ('snapshot_date' in row) requireValid(row.snapshot_date === SNAPSHOT, `${name} snapshot date mismatch`);
      if ('Jahr' in row) requireValid(YEARS.includes(Number(row.Jahr)), `${name} chart year mismatch`);
    }
  }
  return metadata;
}

function validateQuality(quality) {
  keys(quality, ['snapshot_date', 'scope', 'before_quality_filters', 'included_after_quality_filters',
    'excluded_by_quality_filters', 'exclusion_reasons_overlap', 'exclusion_reasons', 'capacity_caveat'], 'quality');
  requireValid(quality.snapshot_date === SNAPSHOT && quality.scope === QUALITY_SCOPE
    && quality.exclusion_reasons_overlap === true && typeof quality.capacity_caveat === 'string'
    && quality.capacity_caveat.length > 0, 'quality scope/date mismatch');
  const measures = ['relation_count', 'identified_plant_count', 'selected_operating_unit_count', 'mixed_selection_relation_count',
    'known_power_gw', 'known_energy_gwh', 'unknown_or_nonfinite_power_count', 'unknown_or_nonfinite_energy_count'];
  for (const key of ['before_quality_filters', 'included_after_quality_filters', 'excluded_by_quality_filters']) {
    keys(quality[key], measures, `quality ${key}`);
    requireValid(measures.every((measure) => finite(quality[key][measure])
      && (!measure.endsWith('_count') || Number.isSafeInteger(quality[key][measure]))), `quality ${key} invalid measures`);
  }
  requireValid(Array.isArray(quality.exclusion_reasons) && quality.exclusion_reasons.length > 0, 'quality reasons missing');
  for (const reason of quality.exclusion_reasons) {
    keys(reason, ['reason', 'relation_count', 'selected_operating_unit_count'], 'quality reason');
    requireValid(typeof reason.reason === 'string' && reason.reason.length > 0
      && [reason.relation_count, reason.selected_operating_unit_count].every((value) => finite(value) && Number.isSafeInteger(value)), 'invalid quality reason');
  }
}

module.exports = { validateBatteryStorage };
