const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');
const { parseSnapshot } = require('../../js/dashboards/electricity-trade');

const DIRECTORY = path.resolve(__dirname, '../data/2026/stromhandel');
const CSV = 'stromhandel_jahre_2019_2025.csv';
const SOURCE = 'stromhandel_source.json';
const MANIFEST = 'stromhandel_manifest.json';
const COLUMNS = ['jahr', 'importe_twh', 'exporte_twh', 'nettoexport_twh'];
const SOURCE_COLUMNS = ['exports_gwh', 'imports_gwh', 'missing_series', 'month', 'net_exports_gwh', 'structural_zero_series'];
const PROVENANCE = {
  schema_version: 1,
  methodology_version: 'stromhandel-jahre-v1',
  frozen_on: '2026-09-14',
  source_commit: 'dd0c7f8deef858a844be777a5fd1e78949386413',
  source_path: 'frontend/src/_data/germanElectricityTrade.json',
  source_raw_sha256: '27b037e57cb4f75d9642cb66209b514d0f8df49e76d57aa3e1d56236a922fdee',
  source_content_hash: '134552fef7dbc71fd1b0e763bc4b81fd31fcac77217aab35ea566a8f9ffe679a',
  source_acquired_at: null,
  acquisition_note: 'Original retrieval timestamp not recorded; frozen from Git, no live refresh.',
  source_url: 'https://www.smard.de/home/marktdaten',
  attribution: 'Bundesnetzagentur | SMARD.de',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  explanation_url: 'https://www.smard.de/page/home/wiki-article/518/548/grenzueberschreitender-stromhandel',
  explanation_reviewed_on: '2026-09-14',
  source_model: 'pipeline/src/data_pipelines/dashboards/german_electricity/trade.py',
  exporter: 'frontend/scripts/freeze-stromhandel.js',
  region: 'DE-LU',
  measure: 'scheduled commercial exchanges; not physical flows',
  timezone: 'Europe/Berlin',
  source_window: { first_month: '2019-01', last_month: '2026-08', rows: 92, unit: 'GWh', key: 'month' },
  article_window: { first_month: '2019-01', last_month: '2025-12', months: 84, rows: 7, unit: 'TWh', key: 'jahr' },
  transformation: 'Sum 12 complete months per calendar year; divide GWh by 1000; net = exports minus imports before rounding; fixed 3 decimals; UTF-8 LF.',
  missing_values: 'Reject missing article months/totals; preserve source missing/structural-zero flags. Never replace unknowns with zero.',
  source_adjustments: 'Bilateral MWh sums converted to GWh, import signs reversed; BE/NO2 pre-trading structural zeros and bounded 2020 startup daily fallback retained.',
  net_crosscheck: 'Gross-derived net retained; documented source net discrepancies in 2021-12, 2022-01, 2022-10, 2022-12. Monthly completeness does not certify hourly completeness.',
  quality: { complete_article_years: 7, complete_article_months: 84, missing_article_months: 0, excluded_months: 8 },
};

function assert(condition, message) {
  if (!condition) throw new Error(`Frozen Stromhandel: ${message}`);
}
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function sameJSON(left, right) {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return left === right;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left).sort();
  return keys.join('\0') === Object.keys(right).sort().join('\0') && keys.every((key) => sameJSON(left[key], right[key]));
}
function payload(bytes, rows, columns) {
  return { sha256: sha256(bytes), bytes: bytes.length, rows, columns };
}
function annualCSV(snapshot) {
  const lines = [COLUMNS.join(',')];
  for (let year = 2019; year <= 2025; year++) {
    const rows = snapshot.rows.filter((row) => row.month.startsWith(`${year}-`));
    assert(rows.length === 12 && rows.every((row) => row.missing_series.length === 0 &&
      ['imports_gwh', 'exports_gwh', 'net_exports_gwh'].every((key) => Number.isFinite(row[key]))), 'Incomplete article year');
    const imports = rows.reduce((sum, row) => sum + row.imports_gwh, 0) / 1000;
    const exports = rows.reduce((sum, row) => sum + row.exports_gwh, 0) / 1000;
    lines.push([year, imports.toFixed(3), exports.toFixed(3), (exports - imports).toFixed(3)].join(','));
  }
  return `${lines.join('\n')}\n`;
}
function checkSource(bytes) {
  assert(sha256(bytes) === PROVENANCE.source_raw_sha256, 'Source raw hash differs from frozen commit');
  const { snapshot, semantic } = parseSnapshot(bytes, Date.parse('2026-09-14T12:00:00Z'));
  assert(sha256(semantic) === snapshot.content_hash && snapshot.content_hash === PROVENANCE.source_content_hash, 'Source content hash mismatch');
  assert(snapshot.first_month === '2019-01' && snapshot.last_month === '2026-08' && snapshot.rows.length === 92, 'Source window mismatch');
  return snapshot;
}
function makeManifest(sourceBytes, csvBytes) {
  return {
    ...PROVENANCE,
    payloads: {
      [CSV]: payload(csvBytes, 7, COLUMNS),
      [SOURCE]: payload(sourceBytes, 92, SOURCE_COLUMNS),
    },
  };
}
function validateStromhandel(directory = DIRECTORY) {
  assert(fs.lstatSync(directory).isDirectory(), 'Unsafe package directory');
  const names = [CSV, SOURCE, MANIFEST];
  assert(sameJSON(fs.readdirSync(directory).sort(), [...names].sort()), 'Unexpected or missing package payload');
  for (const name of names) {
    const stat = fs.lstatSync(path.join(directory, name));
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 250000, `Unsafe payload: ${name}`);
  }
  const sourceBytes = fs.readFileSync(path.join(directory, SOURCE));
  const csvBytes = fs.readFileSync(path.join(directory, CSV));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, MANIFEST), 'utf8'));
  assert(sameJSON(manifest, makeManifest(sourceBytes, csvBytes)), 'Manifest contract, hash or size mismatch');
  const snapshot = checkSource(sourceBytes);
  const records = parse(csvBytes, { columns: false, skip_empty_lines: false });
  assert(records.length === 8 && sameJSON(records[0], COLUMNS), 'CSV header or row count mismatch');
  assert(csvBytes.toString('utf8') === annualCSV(snapshot), 'Annual CSV does not reconcile with frozen monthly source');
  return { manifest, snapshot, rows: parse(csvBytes, { columns: true, cast: true }) };
}

module.exports = { DIRECTORY, CSV, SOURCE, MANIFEST, PROVENANCE, sha256, annualCSV, checkSource, makeManifest, validateStromhandel };
