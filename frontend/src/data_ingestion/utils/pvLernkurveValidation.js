const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

// Frozen evidence for /posts/2026/deutschland-solarstrom-lernkurve/.
// Produced by pipeline/src/data_pipelines/export_data/2026/pv_lernkurve/export.py.
const DIRECTORY = '2026/pv-lernkurve';
const MANIFEST = 'pv_lernkurve_metadata.json';
const CONTRACTS = {
  'pv_lernkurve_jahre.csv': ['Jahr', 'Welt_GW', 'Deutschland_GW', 'China_GW', 'Anteil_Bestand_Deutschland_Prozent',
    'CO2_Anteil_Deutschland_Prozent', 'Solar_Stromanteil_Welt_Prozent', 'Solar_Stromanteil_Deutschland_Prozent'],
  'pv_lernkurve_zubau.csv': ['Jahr', 'Zubau_Welt_GW', 'Zubau_Deutschland_GW', 'Zubau_China_GW', 'Zubau_Uebrige_Welt_GW',
    'Anteil_Zubau_Deutschland_Prozent', 'Anteil_Bestand_Deutschland_Prozent'],
  'pv_lernkurve_modulpreis.csv': ['Jahr', 'Modulpreis_USD_W'],
  'pv_lernkurve_lernkurve.csv': ['Jahr', 'Modulpreis_USD_W', 'Kumulierte_Leistung_Welt_MW'],
  'pv_lernkurve_kennzahlen.csv': ['Kennzahl', 'Zeitraum', 'Wert', 'Einheit'],
};
const TEXT = new Set(['Jahr', 'Kennzahl', 'Zeitraum', 'Einheit']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const years = (first, last) => Array.from({ length: last - first + 1 }, (_, index) => String(first + index));

function requireValid(condition, message) {
  if (!condition) throw new Error(`PV-Lernkurve: ${message}`);
}

/** Verify hashes, CSV contracts, year coverage and internal consistency; returns parsed rows per file. */
function validatePvLernkurve(dataDir = path.join(__dirname, '../data', DIRECTORY)) {
  const read = (name) => {
    const filename = path.join(dataDir, name);
    requireValid(fs.lstatSync(filename).isFile(), `${name} must be a regular file`);
    return fs.readFileSync(filename);
  };
  const metadata = JSON.parse(read(MANIFEST).toString('utf8'));
  requireValid(metadata.schema_version === 1 && metadata.kind === 'frozen_pv_lernkurve_article', 'manifest schema/kind mismatch');
  requireValid(same(metadata.period?.prices, [1975, 2025]) && same(metadata.period?.capacity, [2000, 2025]), 'period mismatch');
  requireValid(same(Object.keys(metadata.files).sort(), Object.keys(CONTRACTS).sort()), 'manifest file allowlist mismatch');
  for (const key of ['capacity', 'module_cost', 'co2_share', 'solar_share']) {
    const source = metadata.sources?.[key];
    requireValid(/^https:\/\/catalog\.ourworldindata\.org\/grapher\/.+\.parquet$/.test(source?.url || '')
      && /^[a-f0-9]{64}$/.test(source?.sha256 || '') && source?.license, `${key} provenance missing`);
  }

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

  const jahre = tables['pv_lernkurve_jahre.csv'];
  const zubau = tables['pv_lernkurve_zubau.csv'];
  const modulpreis = tables['pv_lernkurve_modulpreis.csv'];
  const lernkurve = tables['pv_lernkurve_lernkurve.csv'];
  requireValid(same(jahre.map((row) => row.Jahr), years(2000, 2025)), 'capacity rows must be 2000..2025');
  requireValid(same(zubau.map((row) => row.Jahr), years(2001, 2025)), 'addition rows must be 2001..2025');
  requireValid(same(lernkurve.map((row) => row.Jahr), years(1975, 2025)), 'learning-curve rows must be 1975..2025');
  requireValid(same(modulpreis, lernkurve.filter((row) => row.Jahr >= '2000').map(({ Jahr, Modulpreis_USD_W }) => ({ Jahr, Modulpreis_USD_W }))),
    'chart prices must equal the learning-curve prices from 2000');
  for (const row of jahre) {
    requireValid(row.Deutschland_GW + row.China_GW <= row.Welt_GW, `${row.Jahr} Germany + China exceed the world`);
    requireValid(Math.abs(100 * row.Deutschland_GW / row.Welt_GW - row.Anteil_Bestand_Deutschland_Prozent) < 0.0051, `${row.Jahr} stock share mismatch`);
    for (const key of ['CO2_Anteil_Deutschland_Prozent', 'Solar_Stromanteil_Welt_Prozent', 'Solar_Stromanteil_Deutschland_Prozent']) {
      requireValid(row[key] >= 0 && row[key] <= 100, `${row.Jahr} ${key} outside 0..100`);
    }
  }
  zubau.forEach((row, index) => {
    const [previous, current] = [jahre[index], jahre[index + 1]];
    requireValid(Math.abs(current.Welt_GW - previous.Welt_GW - row.Zubau_Welt_GW) < 0.0011
      && Math.abs(current.Deutschland_GW - previous.Deutschland_GW - row.Zubau_Deutschland_GW) < 0.0011
      && Math.abs(current.China_GW - previous.China_GW - row.Zubau_China_GW) < 0.0011, `${row.Jahr} additions do not follow year-end capacity`);
    requireValid(Math.abs(row.Zubau_Welt_GW - row.Zubau_Deutschland_GW - row.Zubau_China_GW - row.Zubau_Uebrige_Welt_GW) < 0.0011, `${row.Jahr} additions do not add up`);
    requireValid(row.Anteil_Bestand_Deutschland_Prozent === current.Anteil_Bestand_Deutschland_Prozent, `${row.Jahr} stock share differs between files`);
  });
  for (const row of lernkurve) requireValid(row.Modulpreis_USD_W > 0 && row.Kumulierte_Leistung_Welt_MW > 0, `${row.Jahr} price/capacity not positive`);
  return { metadata, jahre, zubau, modulpreis, lernkurve, kennzahlen: tables['pv_lernkurve_kennzahlen.csv'] };
}

module.exports = { validatePvLernkurve, DIRECTORY };
