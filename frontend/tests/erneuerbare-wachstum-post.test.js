/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { validateErneuerbareWachstum, DIRECTORY, CONTRACTS, SOURCE_PATHS, hash, REVISION } = require('../src/data_ingestion/utils/erneuerbareWachstumValidation');
const { extract } = require('../src/data_ingestion/extract-erneuerbare-wachstum');
const FRONTEND = path.resolve(__dirname, '..');
// Shallow deployment checkouts need only the frozen package, not historical Git objects.
let hasRevision = false;
try { execFileSync('git', ['cat-file', '-e', `${REVISION}^{commit}`], { cwd: FRONTEND, stdio: 'ignore' }); hasRevision = true; }
catch { /* Reproduction requires the documented source revision. All contract tests still run. */ }
let temp;
beforeEach(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(), 'erneuerbare-test-')); });
afterEach(() => { fs.rmSync(temp, { recursive: true, force: true }); });
function copy() {
  const dir = path.join(temp, 'package');
  fs.cpSync(DIRECTORY, dir, { recursive: true });
  return dir;
}
function rewrite(dir, filename, transform) {
  const file = path.join(dir, filename);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
  const metadataPath = path.join(dir, 'metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath));
  const bytes = fs.readFileSync(file);
  metadata.files[filename].sha256 = hash(bytes);
  metadata.files[filename].bytes = bytes.length;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
}
(hasRevision ? test : test.skip)('offline extraction reproduces every frozen byte and source hash at the pinned revision', () => {
  const dir = path.join(temp, 'extracted');
  // Reconstruct the historical inputs, so later daily refreshes cannot break a frozen post test.
  const sourceRoot = path.join(temp, 'sources');
  for (const filename of SOURCE_PATHS) {
    const file = path.join(sourceRoot, filename);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, execFileSync('git', ['show', `${REVISION}:${filename}`], { cwd: FRONTEND, maxBuffer: 2000000 }));
  }
  const metadata = extract(dir, sourceRoot);
  for (const name of ['metadata.json', ...Object.keys(CONTRACTS)]) {
    expect(fs.readFileSync(path.join(dir, name))).toEqual(fs.readFileSync(path.join(DIRECTORY, name)));
  }
  for (const source of metadata.inputs) {
    const bytes = execFileSync('git', ['show', `${REVISION}:${source.path}`], { cwd: FRONTEND, maxBuffer: 2000000 });
    expect(hash(bytes)).toBe(source.sha256);
    expect(bytes.length).toBe(source.bytes);
  }
  expect(() => extract(dir)).toThrow(/never overwritten/);
});
test.each(Object.keys(CONTRACTS))('missing or corrupt payload is rejected: %s', (name) => {
  const dir = copy();
  const file = path.join(dir, name);
  fs.appendFileSync(file, 'corrupt');
  expect(() => validateErneuerbareWachstum(dir)).toThrow();
  fs.unlinkSync(file);
  expect(() => validateErneuerbareWachstum(dir)).toThrow();
});
test('extra files, manifest path injection and symlinks are rejected', () => {
  const dir = copy();
  fs.writeFileSync(path.join(dir, 'raw.csv'), 'raw');
  expect(() => validateErneuerbareWachstum(dir)).toThrow(/allowlist/);
  fs.unlinkSync(path.join(dir, 'raw.csv'));
  fs.unlinkSync(path.join(dir, 'capacity.csv'));
  fs.symlinkSync(path.join(DIRECTORY, 'capacity.csv'), path.join(dir, 'capacity.csv'));
  expect(() => validateErneuerbareWachstum(dir)).toThrow(/unsafe/);
  const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json')));
  metadata.files['../raw.csv'] = metadata.files['capacity.csv'];
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata));
  expect(() => validateErneuerbareWachstum(dir)).toThrow(/allowlist/);
});
test.each([
  ['capacity.csv', (s) => s.replace('2011,', '2012,')],
  ['generation.csv', (s) => s.replace('source_annual_aggregate', 'daily_sum')],
  ['generation.csv', (s) => s.replace(',366,365', ',366,366')],
  ['generation.csv', (s) => s.replace('34.73468081', '')],
  ['summary.csv', (s) => s.replace('14.828', '15.828')],
  ['quality.json', (s) => s.replace('"complete_days": 361', '"complete_days": 365')],
  ['capacity.csv', (s) => s.replace('solar_gw,', 'wrong,')],
  ['capacity.csv', (s) => s.split('\n').slice(0, -2).join('\n') + '\n'],
])('semantic corruption fails even with updated hash: %s', (name, transform) => {
  const dir = copy();
  rewrite(dir, name, transform);
  expect(() => validateErneuerbareWachstum(dir)).toThrow();
});
test('changed source dates or scope and a mixed manifest fail', () => {
  const dir = copy();
  const file = path.join(dir, 'metadata.json');
  const original = fs.readFileSync(file, 'utf8');
  for (const changed of [original.replace('2026-06-26', '2026-09-14'), original.replace('Keine DC-Modulleistung.', 'DC-Modulleistung.'), original.replace('"rows": 15', '"rows": 16')]) {
    fs.writeFileSync(file, changed);
    expect(() => validateErneuerbareWachstum(dir)).toThrow();
  }
});
test('article table reconciles with frozen evidence; charts stay separate and use nested frozen inputs', () => {
  const { tables } = validateErneuerbareWachstum();
  const post = fs.readFileSync(path.join(FRONTEND, 'src/posts/2026/solar-boomt-wind-waechst.md'), 'utf8');
  const summaries = tables['summary.csv'];
  const format = (n) => n.toFixed(1).replace('.', ',');
  for (const [label, key, plus] of [
    ['Nettonennleistung Ende 2020, GW', 'capacity_2020_gw'],
    ['Nettonennleistung Ende 2025, GW', 'capacity_2025_gw'],
    ['Bestandsänderung 2025, GW', 'change_2025_gw', true],
    ['Einspeisung 2024, TWh', 'generation_2024_twh'],
    ['Einspeisung 2025, TWh', 'generation_2025_twh'],
  ]) expect(post).toContain(`| ${label} | ${summaries.map((r) => `${plus ? '+' : ''}${format(r[key])}`).join(' | ')} |`);
  expect(post).toContain('um 5,1 Prozent');
  expect(summaries[1].generation_change_pct).toBeCloseTo(-5.14614704, 8);
  expect(post.match(/^# /gm)).toBeNull();
  expect(post).toContain('date: 2026-09-14');
  expect(post).toContain('lastUpdated: 2026-09-14');
  expect(post.trim().endsWith('Die laufende Entwicklung findet ihr im [Strom-Dashboard](/dashboards/strom/).')).toBe(true);
  const configs = require('../src/data_ingestion/charts/erneuerbare_wachstum');
  expect(configs.map((c) => c.yAxisLabel)).toEqual(['GW', 'TWh']);
  for (const config of configs) {
    expect(config.smooth).toBe(false);
    expect(config.dataFile).toMatch(/^2026\/erneuerbare_wachstum\//);
    expect(config.seriesNames).toEqual(['Solar', 'Wind Land', 'Wind See']);
    expect(post).toContain(`id="${config.containerId}"`);
    expect(post).toContain(`/js/charts/erneuerbare_wachstum/${config.outputFile}`);
  }
});
