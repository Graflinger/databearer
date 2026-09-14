/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');
const { validateStromYtd, STROM_YTD_DIRECTORY } = require('../src/data_ingestion/utils/stromYtdValidation');
const { buildLineChart } = require('../src/data_ingestion/builders/lineChart');
const { buildBarChart } = require('../src/data_ingestion/builders/barChart');
const { renderComparisonChart } = require('../src/data_ingestion/builders/comparisonChart');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
const commit = 'dd0c7f8deef858a844be777a5fd1e78949386413';
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const git = (filename) => execFileSync('git', ['show', `${commit}:${filename}`], { cwd: root });
// Shallow CI checkouts may not contain the frozen source commit. Only the
// independent historical reproduction depends on it; package checks always run.
const sourceCommit = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root });
if (sourceCommit.error) throw sourceCommit.error;
if (![0, 1, 128].includes(sourceCommit.status)) throw new Error('Could not check frozen source commit availability');
const testWithSourceHistory = sourceCommit.status === 0 ? test : test.skip;
const { manifest, tables } = validateStromYtd();
let scratch;

beforeEach(() => {
  // Keep temporary test writes inside this worktree.
  scratch = fs.mkdtempSync(path.resolve(__dirname, '../node_modules/.strom-ytd-test-'));
  fs.cpSync(STROM_YTD_DIRECTORY, scratch, { recursive: true });
});
afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

function mutateCsv(name, change, rehash = true) {
  const filename = path.join(scratch, name);
  fs.writeFileSync(filename, change(fs.readFileSync(filename, 'utf8')));
  if (rehash) {
    const metadata = JSON.parse(fs.readFileSync(path.join(scratch, 'manifest.json')));
    const raw = fs.readFileSync(filename);
    metadata.payloads[name].sha256 = hash(raw);
    metadata.payloads[name].bytes = raw.length;
    fs.writeFileSync(path.join(scratch, 'manifest.json'), JSON.stringify(metadata));
  }
}

test('frozen package validates and preserves the original CSV bytes without Git history', () => {
  expect(validateStromYtd().manifest.source_commit).toBe(commit);
  const originalCsv = fs.readFileSync(path.join(STROM_YTD_DIRECTORY, 'strom_ytd_2026_mix.csv'));
  // Pin the original bytes independently of both Git availability and the manifest.
  expect(hash(originalCsv)).toBe('0071b2ed6d13193139bd267329777cc523df7a25ca5ff594c2d762df22c14fa3');
});

testWithSourceHistory('all supporting aggregates reproduce independently from the exact original Git history', () => {
  for (const source of manifest.source_files) {
    const raw = git(source.path);
    expect(hash(raw)).toBe(source.sha256);
    expect(raw.length).toBe(source.bytes);
  }
  for (const period of tables['periods.csv']) {
    const source = manifest.source_files.find((s) => s.path.includes(`/${period.year}.`));
    const rows = JSON.parse(git(source.path)).rows.filter((r) => r.date >= period.start && r.date <= period.end);
    const expectedDays = (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
    expect(rows).toHaveLength(expectedDays);
    expect(new Set(rows.map((r) => r.date)).size).toBe(expectedDays);
    expect(rows.every((r) => r.price_zone === 'DE-LU')).toBe(true);
    const energy = Object.fromEntries(Object.keys(rows[0].energy_gwh).map((key) => [key, 0]));
    let hours = 0;
    let numerator = 0;
    for (const row of rows) {
      for (const [key, value] of Object.entries(row.energy_gwh)) {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
        energy[key] += value / 1000;
      }
      expect(typeof row.price_eur_mwh).toBe('number');
      hours += row.hours;
      numerator += row.price_eur_mwh * row.hours;
    }
    const renewable = ['biomass', 'hydro', 'wind_offshore', 'wind_onshore', 'solar', 'other_renewables'].reduce((sum, key) => sum + energy[key], 0);
    const generation = Object.entries(energy).filter(([key]) => key !== 'load').reduce((sum, [, value]) => sum + value, 0);
    expect(period.generation_twh).toBeCloseTo(generation, 5);
    expect(period.renewable_twh).toBeCloseTo(renewable, 5);
    expect(period.renewable_share_pct).toBeCloseTo(100 * renewable / generation, 5);
    expect(period.load_twh).toBeCloseTo(energy.load, 5);
    expect(period.hours).toBe(hours);
    expect(period.price_hour_sum).toBeCloseTo(numerator, 5);
    expect(period.price_eur_mwh).toBeCloseTo(numerator / hours, 5);
    expect(period.negative_mean_days).toBe(rows.filter((r) => r.price_eur_mwh < 0).length);
    for (const row of tables['mix_by_year.csv'].filter((r) => r.year === period.year)) expect(row.generation_twh).toBeCloseTo(energy[row.source], 5);
  }
});

test.each(Object.keys(manifest.payloads))('rejects missing and corrupt evidence: %s', (name) => {
  fs.appendFileSync(path.join(scratch, name), '\n');
  expect(() => validateStromYtd(scratch)).toThrow(/hash\/size/);
  fs.unlinkSync(path.join(scratch, name));
  expect(() => validateStromYtd(scratch)).toThrow(/allowlist/);
});

test('rejects extra files and symlinks', () => {
  fs.writeFileSync(path.join(scratch, 'raw.csv'), 'unexpected');
  expect(() => validateStromYtd(scratch)).toThrow(/allowlist/);
  fs.unlinkSync(path.join(scratch, 'raw.csv'));
  fs.unlinkSync(path.join(scratch, 'periods.csv'));
  fs.symlinkSync(path.join(STROM_YTD_DIRECTORY, 'periods.csv'), path.join(scratch, 'periods.csv'));
  expect(() => validateStromYtd(scratch)).toThrow(/unsafe/);
});

test.each([
  ['periods.csv', (s) => s.replace('2025-09-09', '2025-12-31')],
  ['periods.csv', (s) => s.replace('6047', '6048')],
  ['periods.csv', (s) => s.replace('38.218093', '')],
  ['periods.csv', (s) => s.replace('38.218093', 'NaN')],
  ['periods.csv', (s) => s.replace('59.442532', '60.442532')],
  ['mix_by_year.csv', (s) => s.replace('2019,biomass', '2019,gas')],
  ['mix_by_year.csv', (s) => s.replace('24.107794', '0.000000')],
  ['comparison.csv', (s) => s.replace('72.259377', '73.259377')],
])('rejects rehashed semantic corruption #%#', (name, change) => {
  mutateCsv(name, change);
  expect(() => validateStromYtd(scratch)).toThrow();
});

test.each([
  (m) => { m.source_commit = 'a'.repeat(40); },
  (m) => { m.source_files[1].path = '../2019.json'; },
  (m) => { m.units.price = 'ct/kWh'; },
  (m) => { m.coverage.missing_price_days = 1; },
  (m) => { m.payloads['../extra.csv'] = m.payloads['periods.csv']; },
  (m) => { m.payloads['periods.csv'].columns[1] = 'date'; },
])('rejects mixed provenance/contracts #%#', (change) => {
  const metadata = JSON.parse(fs.readFileSync(path.join(scratch, 'manifest.json')));
  change(metadata);
  fs.writeFileSync(path.join(scratch, 'manifest.json'), JSON.stringify(metadata));
  expect(() => validateStromYtd(scratch)).toThrow();
});

test('config validation failure propagates to the generator process', () => {
  // Use a mock only in the child; never alter the real frozen package.
  const script = `const v = require('./src/data_ingestion/utils/stromYtdValidation'); v.validateStromYtd = () => { throw Error('broken frozen entity'); }; process.argv[2] = 'strom_ytd_2026.js'; require('./src/data_ingestion/generate-charts');`;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('broken frozen entity');
});

test('standard charts retain nested inputs, stable routes, short grouped labels and explicit straight-line colors', () => {
  const configs = require('../src/data_ingestion/charts/strom_ytd_2026');
  expect(configs.map((c) => c.outputFile)).toEqual(['comparison.js', 'mix.js', 'renewable-share.js', 'price.js']);
  for (const config of configs.filter((c) => c.type !== 'comparison')) {
    expect(config.dataFile.startsWith('2026/strom_ytd/')).toBe(true);
    const data = parse(fs.readFileSync(path.join(STROM_YTD_DIRECTORY, path.basename(config.dataFile))), { columns: true, cast: true });
    const build = config.type === 'line' ? buildLineChart : buildBarChart;
    let option;
    const chart = { setOption: (value) => { option = value; }, resize: () => {} };
    vm.runInNewContext(build(data, config), {
      document: { getElementById: () => ({}) },
      window: { matchMedia: () => ({ matches: false, addEventListener: () => {} }), addEventListener: () => {} },
      echarts: { init: () => chart },
    });
    expect(option.series.map((s) => s.itemStyle.color)).toEqual(config.colors);
    if (config.type === 'line') expect(option.series.every((s) => s.smooth === false)).toBe(true);
    else {
      expect(option.xAxis.data).toEqual([2025, 2026]);
      expect(option.legend.data).toEqual(['Wind an Land', 'Solar']);
    }
  }
});

test('article dates, static tables, comparisons and closing link agree with the frozen entity', () => {
  const article = fs.readFileSync(path.resolve(__dirname, '../src/posts/2026/strom-2026-ytd-zahlen.md'), 'utf8');
  const de = (number, digits) => number.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  expect(article).toContain('title: "Strom 2026 bisher: Solar und Wind an Land');
  expect(article).toContain('date: 2026-09-11');
  expect(article).toContain('lastUpdated: 2026-09-14');
  expect(article.trim().endsWith('[Strom-Dashboard](/dashboards/strom/).')).toBe(true);
  for (const p of tables['periods.csv']) {
    expect(article).toContain(`| ${p.year} | ${de(p.generation_twh, 1)} | ${de(p.renewable_share_pct, 1)} | ${de(p.price_eur_mwh, 2)} |`);
  }
  const [a, b] = tables['periods.csv'].slice(-2);
  const config = require('../src/data_ingestion/charts/strom_ytd_2026')[0];
  const document = new JSDOM(renderComparisonChart(tables['periods.csv'], config)).window.document;
  const metrics = [...document.querySelectorAll('.comparison-chart__metric')];
  expect(metrics).toHaveLength(5);
  for (const [i, { key, unit, digits = 1, delta }] of config.metrics.entries()) {
    expect(metrics[i].textContent).toContain(`2025 ${de(a[key], digits)} ${unit}`);
    expect(metrics[i].textContent).toContain(`2026 ${de(b[key], digits)} ${unit}`);
    const change = delta === 'percentagePoints' ? b[key] - a[key] : 100 * (b[key] / a[key] - 1);
    expect(metrics[i].querySelector('.comparison-chart__delta').textContent).toBe(`+${de(change, 1)} ${delta === 'percentagePoints' ? 'Prozentpunkte' : '%'} gegenüber 2025`);
  }
  expect(article).toContain(`+${de(b.renewable_share_pct - a.renewable_share_pct, 1)} Prozentpunkte`);
  const labels = { biomass: 'Biomasse', hydro: 'Wasserkraft', wind_offshore: 'Wind auf See', wind_onshore: 'Wind an Land', solar: 'Solar', other_renewables: 'Sonstige Erneuerbare', lignite: 'Braunkohle', hard_coal: 'Steinkohle', gas: 'Erdgas', other_conventional: 'Sonstige Konventionelle', pumped_storage: 'Pumpspeicher', nuclear: 'Kernenergie' };
  for (const [source, label] of Object.entries(labels)) {
    const values = [2025, 2026].map((year) => tables['mix_by_year.csv'].find((r) => r.year === year && r.source === source).generation_twh);
    expect(article).toContain(`| ${label} | ${de(values[0], 1)} | ${de(values[1], 1)} |`);
  }
  expect(b.negative_mean_days).toBe(2);
  expect(article).toContain('Zwei Tage hatten 2026');
});
