/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { DIRECTORY, CSV, SOURCE, MANIFEST, sha256, validateStromhandel } = require('../src/data_ingestion/utils/stromhandelValidation');
const { loadData } = require('../src/data_ingestion/builders/utils');
const { buildLineChart } = require('../src/data_ingestion/builders/lineChart');

let temporary;
beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(__dirname, '.stromhandel-'));
  for (const file of fs.readdirSync(DIRECTORY)) fs.copyFileSync(path.join(DIRECTORY, file), path.join(temporary, file));
});
afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

function rewriteManifest(change) {
  const file = path.join(temporary, MANIFEST);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(manifest);
  fs.writeFileSync(file, JSON.stringify(manifest));
}
function rehash(file) {
  const bytes = fs.readFileSync(path.join(temporary, file));
  rewriteManifest((manifest) => Object.assign(manifest.payloads[file], { sha256: sha256(bytes), bytes: bytes.length }));
}

test('nested frozen CSV preserves the original reviewed bytes and reconciles every full year', () => {
  const { rows, manifest } = validateStromhandel();
  expect(sha256(fs.readFileSync(path.join(DIRECTORY, CSV)))).toBe('5b2eca8f9106081299f2179dc51d274389bc77f7b59220d6cd6a4d070fc97636');
  expect(rows.map((row) => row.jahr)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  expect(loadData(path.join(DIRECTORY, CSV))).toEqual(rows);
  expect(manifest.quality.complete_article_months).toBe(84);
  expect(manifest.source_acquired_at).toBeNull();
});

test.each([CSV, SOURCE, MANIFEST])('missing %s rejects the entire package', (file) => {
  fs.unlinkSync(path.join(temporary, file));
  expect(() => validateStromhandel(temporary)).toThrow('Unexpected or missing');
});
test('unexpected payloads are rejected', () => {
  fs.writeFileSync(path.join(temporary, 'raw.csv'), 'raw');
  expect(() => validateStromhandel(temporary)).toThrow('Unexpected or missing');
});
test.each([CSV, SOURCE, MANIFEST])('symlink %s is rejected', (file) => {
  fs.unlinkSync(path.join(temporary, file));
  fs.symlinkSync(path.join(DIRECTORY, file), path.join(temporary, file));
  expect(() => validateStromhandel(temporary)).toThrow('Unsafe payload');
});
test('manifest traversal paths cannot replace the payload allowlist', () => {
  rewriteManifest((manifest) => { manifest.payloads['../outside.csv'] = manifest.payloads[CSV]; delete manifest.payloads[CSV]; });
  expect(() => validateStromhandel(temporary)).toThrow('Manifest contract');
});
test('corrupt source bytes are rejected', () => {
  fs.appendFileSync(path.join(temporary, SOURCE), '\n');
  expect(() => validateStromhandel(temporary)).toThrow('Manifest contract');
});
test('mixed source vintage is rejected even with updated payload hash', () => {
  const file = path.join(temporary, SOURCE);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('2026-08', '2026-09'));
  rehash(SOURCE);
  expect(() => validateStromhandel(temporary)).toThrow('Source raw hash');
});
test.each(['units', 'window', 'columns', 'rows', 'size'])('changed %s contract is rejected', (kind) => {
  rewriteManifest((manifest) => {
    if (kind === 'units') manifest.article_window.unit = 'GWh';
    if (kind === 'window') manifest.article_window.last_month = '2025-13';
    if (kind === 'columns') manifest.payloads[CSV].columns.reverse();
    if (kind === 'rows') manifest.payloads[CSV].rows = 8;
    if (kind === 'size') manifest.payloads[SOURCE].bytes++;
  });
  expect(() => validateStromhandel(temporary)).toThrow('Manifest contract');
});
test.each([
  ['header', (text) => text.replace('jahr', 'year')],
  ['missing year', (text) => text.replace(/^2020,.*\n/m, '')],
  ['duplicate year', (text) => text.replace('2020,', '2019,')],
  ['nonfinite value', (text) => text.replace('31.923', 'NaN')],
  ['wrong annual value', (text) => text.replace('31.923', '31.924')],
])('CSV %s is rejected even with updated payload hash', (_name, mutate) => {
  const file = path.join(temporary, CSV);
  fs.writeFileSync(file, mutate(fs.readFileSync(file, 'utf8')));
  rehash(CSV);
  expect(() => validateStromhandel(temporary)).toThrow(/CSV|reconcile/);
});

test('config loading fails before exporting charts if evidence fails validation', () => {
  jest.isolateModules(() => {
    jest.doMock('../src/data_ingestion/utils/stromhandelValidation', () => ({ validateStromhandel: () => { throw new Error('invalid package'); } }));
    expect(() => require('../src/data_ingestion/charts/stromhandel_jahre')).toThrow('invalid package');
  });
  jest.dontMock('../src/data_ingestion/utils/stromhandelValidation');
});

test('standard generated line renders exact annual values, straight segments and the requested color', () => {
  const configs = require('../src/data_ingestion/charts/stromhandel_jahre');
  expect(configs.map((config) => config.outputFile)).toEqual(['importe_exporte.js', 'nettoexport.js']);
  const config = configs[1];
  expect(config.dataFile).toBe(`2026/stromhandel/${CSV}`);
  let option;
  const context = {
    document: { getElementById: (id) => { expect(id).toBe('stromhandel-jahre-nettoexport'); return {}; } },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    echarts: { init: () => ({ setOption: (value) => { option = value; } }) },
  };
  vm.runInNewContext(buildLineChart(loadData(path.join(DIRECTORY, CSV)), config), context);
  expect(option.series[0].smooth).toBe(false);
  expect(option.series[0].name).toBe('Nettoexport');
  expect(option.series[0].lineStyle.color).toBe('#469c8a');
  expect(option.series[0].data).toEqual([30.833, 14.714, 13.864, 22.958, -15.251, -31.868, -25.413]);
});

test('article table matches all CSV values and ends with the dashboard link', () => {
  const article = fs.readFileSync(path.resolve(__dirname, '../src/posts/2026/stromimporte-exporte-deutschland.md'), 'utf8');
  for (const row of validateStromhandel().rows) {
    const values = [row.jahr, ...[row.importe_twh, row.exporte_twh, row.nettoexport_twh].map((value) => value.toFixed(3).replace('.', ',').replace('-', '−'))];
    expect(article).toContain(`| ${values.join(' | ')} |`);
  }
  expect(article).toContain('date: 2026-09-11');
  expect(article).toContain('lastUpdated: 2026-09-14');
  expect(article.trim()).toMatch(/\[Strom-Dashboard\]\(\/dashboards\/strom\/\)$/);
});

test('ignore exceptions include only the frozen evidence files', () => {
  const prefix = 'src/data_ingestion/data/2026/stromhandel/';
  const ignored = (file) => spawnSync('git', ['check-ignore', '--no-index', '-q', file], { cwd: path.resolve(__dirname, '..') }).status;
  for (const name of [CSV, SOURCE, MANIFEST]) expect(ignored(prefix + name)).toBe(1);
  for (const name of ['raw.csv', 'extra.json', 'nested/raw.csv']) expect(ignored(prefix + name)).toBe(0);
  expect(ignored('src/data_ingestion/data/2026/other/raw.csv')).toBe(0);
});
