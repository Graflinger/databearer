const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

// Frozen evidence for /posts/2026/strompreis-gaspreis-erneuerbare/.
// Produced by pipeline/src/data_pipelines/export_data/2026/strompreis_korrelation/export.py.
const DIRECTORY = '2026/strompreis-korrelation';
const MANIFEST = 'strompreis_korrelation_metadata.json';
const PERIODS = ['2019–2020', '2021–2022', '2023–2025'];
const CONTRACTS = {
  'strompreis_korrelation_monthly.csv': ['Monat', 'Zeitraum', 'Strompreis_EUR_MWh', 'Erneuerbarenanteil_Prozent', 'Gaspreis_EUR_MWh',
    'Gaspreis_USD_MMBtu', 'USD_je_EUR', 'Last_GW', 'Stunden'],
  'strompreis_korrelation_correlations.csv': ['Zeitraum', 'Monate', 'Pearson_Erneuerbare', 'Spearman_Erneuerbare', 'Pearson_Gas', 'Spearman_Gas',
    'Partiell_Erneuerbare', 'Partiell_Gas', 'Pearson_Erneuerbare_Gas', 'Veraenderungen', 'Pearson_Veraenderung_Erneuerbare', 'Pearson_Veraenderung_Gas'],
  'strompreis_korrelation_regression.csv': ['Modell', 'Zeitraum', 'Monate', 'Gas_Koeffizient', 'Gas_KI95_unten', 'Gas_KI95_oben',
    'Erneuerbare_Koeffizient', 'Erneuerbare_KI95_unten', 'Erneuerbare_KI95_oben', 'R2'],
};
const TEXT = new Set(['Monat', 'Zeitraum', 'Modell']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function requireValid(condition, message) {
  if (!condition) throw new Error(`Strompreis-Korrelation: ${message}`);
}

function expectedMonths() {
  const months = [];
  for (let year = 2019; year <= 2025; year += 1) {
    for (let month = 1; month <= 12; month += 1) months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

function periodOf(month) {
  if (month <= '2020-12') return PERIODS[0];
  if (month <= '2022-12') return PERIODS[1];
  return PERIODS[2];
}

/** Verify hashes, CSV contracts and value ranges; returns parsed rows per file. */
function validateStrompreisKorrelation(dataDir = path.join(__dirname, '../data', DIRECTORY)) {
  const read = (name) => {
    const filename = path.join(dataDir, name);
    requireValid(fs.lstatSync(filename).isFile(), `${name} must be a regular file`);
    return fs.readFileSync(filename);
  };
  const metadata = JSON.parse(read(MANIFEST).toString('utf8'));
  requireValid(metadata.schema_version === 1 && metadata.kind === 'frozen_strompreis_korrelation_article', 'manifest schema/kind mismatch');
  requireValid(metadata.period?.first_month === '2019-01' && metadata.period?.last_month === '2025-12' && metadata.period?.months === 84, 'period mismatch');
  requireValid(same(Object.keys(metadata.files).sort(), Object.keys(CONTRACTS).sort()), 'manifest file allowlist mismatch');
  requireValid(metadata.sources?.electricity?.license === 'CC BY 4.0' && metadata.sources?.gas?.license === 'CC BY 4.0', 'source licenses missing');

  const tables = {};
  for (const [name, columns] of Object.entries(CONTRACTS)) {
    const entry = metadata.files[name];
    const bytes = read(name);
    requireValid(bytes.length === entry.bytes && createHash('sha256').update(bytes).digest('hex') === entry.sha256, `${name} size/hash mismatch`);
    requireValid(same(entry.columns, columns), `${name} column contract mismatch`);
    const records = parse(bytes, { skip_empty_lines: false });
    requireValid(same(records[0], columns) && records.length === entry.rows + 1, `${name} header/row count mismatch`);
    tables[name] = records.slice(1).map((values) => {
      requireValid(values.length === columns.length, `${name} ragged record`);
      return Object.fromEntries(columns.map((column, index) => {
        if (TEXT.has(column)) return [column, values[index]];
        const number = Number(values[index]);
        requireValid(values[index] !== '' && Number.isFinite(number), `${name} ${column} is not numeric`);
        return [column, number];
      }));
    });
  }

  const monthly = tables['strompreis_korrelation_monthly.csv'];
  requireValid(same(monthly.map((row) => row.Monat), expectedMonths()), 'monthly rows must be 2019-01..2025-12');
  for (const row of monthly) {
    requireValid(row.Zeitraum === periodOf(row.Monat), `${row.Monat} period label mismatch`);
    requireValid(row.Erneuerbarenanteil_Prozent > 0 && row.Erneuerbarenanteil_Prozent < 100, `${row.Monat} renewable share out of range`);
    requireValid(row.Gaspreis_EUR_MWh > 0 && row.Strompreis_EUR_MWh > -500 && row.Strompreis_EUR_MWh < 3000, `${row.Monat} price out of range`);
  }
  const correlations = tables['strompreis_korrelation_correlations.csv'];
  requireValid(same(correlations.map((row) => row.Zeitraum), ['2019–2025', ...PERIODS]), 'correlation periods mismatch');
  for (const row of correlations) {
    for (const [key, value] of Object.entries(row)) {
      if (/^(Pearson|Spearman|Partiell)/.test(key)) requireValid(value >= -1 && value <= 1, `${row.Zeitraum} ${key} outside [-1, 1]`);
    }
  }
  return { metadata, monthly, correlations, regression: tables['strompreis_korrelation_regression.csv'] };
}

module.exports = { validateStrompreisKorrelation, DIRECTORY, PERIODS };
