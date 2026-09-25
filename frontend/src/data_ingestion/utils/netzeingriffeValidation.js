const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { parse } = require('csv-parse/sync');

const DATA_DIR = path.join(__dirname, '../data/2026/netzeingriffe');
const MANIFEST = 'netzeingriffe_manifest.json';
const ANNUAL = 'netzeingriffe_jahre_2015_2025.csv';
const MONTHLY = 'netzeingriffe_monate_2022_2026.csv';
const SUMMARY = 'netzeingriffe_summary.json';
const PAYLOADS = [ANNUAL, MONTHLY, SUMMARY];
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const round = (value) => Number(value.toFixed(6));

function summarizeNetzeingriffe(annual, monthly) {
  const year = (y) => annual.find((row) => row.jahr === String(y));
  const energy = (y) => Number(year(y).massnahmenenergie_gwh);
  const cost = (y) => Number(year(y).kosten_mio_eur);
  const month = (m) => Number(monthly.find((row) => row.monat === m).gesamt_gwh);
  return {
    energy_change_2022_2025_gwh: energy(2025) - energy(2022),
    energy_change_2022_2025_pct: round((energy(2025) / energy(2022) - 1) * 100),
    energy_change_2024_2025_gwh: energy(2025) - energy(2024),
    cost_change_2024_2025_million_eur: cost(2025) - cost(2024),
    cost_change_2024_2025_pct: round((cost(2025) / cost(2024) - 1) * 100),
    december_2024_gwh: month('2024-12'),
    may_2026_gwh: month('2026-05'),
  };
}

function validateNetzeingriffe(directory = DATA_DIR) {
  // Refuse symlinks throughout the entity/topic/year data subtree and its payloads.
  // Do not reject macOS's system-level /var -> /private/var alias.
  let current = path.resolve(directory);
  for (let level = 0; level < 3; level++, current = path.dirname(current)) {
    assert(fs.lstatSync(current).isDirectory(), 'Unsafe entity directory');
  }
  assert.deepStrictEqual(Array.from(fs.readdirSync(directory)).sort(), [...PAYLOADS, MANIFEST].sort(), 'Entity allowlist');
  function read(name) {
    assert([...PAYLOADS, MANIFEST].includes(name), 'Unsafe payload path');
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    assert(stat.isFile() && stat.size > 0 && stat.size < 20000, 'Unsafe or oversized payload');
    return fs.readFileSync(file);
  }
  const manifest = JSON.parse(read(MANIFEST));
  assert.deepStrictEqual(Object.keys(manifest).sort(), ['contract', 'files']);
  assert.deepStrictEqual(manifest.contract, {
    schema_version: 1,
    entity: '2026/netzeingriffe',
    methodology: 'netzeingriffe-frozen-v1',
    source_commit: 'dd0c7f8deef858a844be777a5fd1e78949386413',
    source_path: 'frontend/src/_data/germanElectricityProgress.json',
    source_sha256: 'cb434822ce5f16e9f6603875cbeff5d50a26b04415a9c9e0ad3e54cebfd801fd',
    source_url: 'https://www.smard.de/resource/blob/217306/-/data-csv-data.csv',
    attribution: 'Bundesnetzagentur | SMARD.de',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    license_evidence: 'https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf',
    reviewed_on: '2026-09-14',
    upstream_retrieved_at: null,
    timezone: 'Europe/Berlin',
    annual_window: ['2015', '2025'],
    monthly_window: ['2022-07', '2026-05'],
    partial_years_monthly: [2022, 2026],
    units: { energy: 'GWh', cost: 'million EUR nominal', change: 'percent' },
    missing_values: 'Forbidden; never replaced by zero',
    transformation: 'Select and rename annual/monthly fields from pinned JSON; annual integer and monthly two-decimal CSV; summary changes rounded to six decimals. Annual aggregates are independent of monthly sums.',
  }, 'Frozen provenance/window contract');
  assert.deepStrictEqual(Object.keys(manifest.files).sort(), PAYLOADS.slice().sort());
  const contents = {};
  for (const name of PAYLOADS) {
    const bytes = read(name);
    const entry = manifest.files[name];
    assert.deepStrictEqual(Object.keys(entry).sort(), ['bytes', 'columns', 'rows', 'sha256']);
    assert.strictEqual(entry.bytes, bytes.length, `${name}: size`);
    assert.strictEqual(entry.sha256, sha256(bytes), `${name}: hash`);
    contents[name] = bytes.toString('utf8');
  }
  function csv(name, columns, periods) {
    const entry = manifest.files[name];
    assert.deepStrictEqual(entry.columns, columns);
    assert.strictEqual(entry.rows, periods.length);
    const records = parse(contents[name], { columns: true, skip_empty_lines: false });
    assert.strictEqual(records.length, periods.length, `${name}: row count`);
    records.forEach((row, index) => {
      assert.deepStrictEqual(Object.keys(row), columns, `${name}: header`);
      assert.strictEqual(row[columns[0]], periods[index], `${name}: period sequence`);
      for (const key of columns.slice(1)) {
        assert(/^\d+(\.\d+)?$/.test(row[key]) && Number.isFinite(Number(row[key])) && Number(row[key]) <= 1000000, `${name}: numeric value`);
      }
    });
    return records;
  }
  const years = Array.from({ length: 11 }, (_, i) => String(2015 + i));
  const months = Array.from({ length: 47 }, (_, i) => new Date(Date.UTC(2022, 6 + i, 1)).toISOString().slice(0, 7));
  const annual = csv(ANNUAL, ['jahr', 'massnahmenenergie_gwh', 'kosten_mio_eur'], years);
  const monthly = csv(MONTHLY, ['monat', 'gesamt_gwh', 'redispatch_marktkraftwerke_gwh'], months);
  monthly.forEach((row) => assert(Number(row.redispatch_marktkraftwerke_gwh) <= Number(row.gesamt_gwh), 'Subset exceeds total'));
  const summary = summarizeNetzeingriffe(annual, monthly);
  assert.deepStrictEqual(manifest.files[SUMMARY].columns, Object.keys(summary));
  assert.strictEqual(manifest.files[SUMMARY].rows, 1);
  assert.deepStrictEqual(JSON.parse(contents[SUMMARY]), summary, 'Supporting summary reconciliation');
  return { annual, monthly, summary };
}

module.exports = { validateNetzeingriffe, summarizeNetzeingriffe, DATA_DIR };
