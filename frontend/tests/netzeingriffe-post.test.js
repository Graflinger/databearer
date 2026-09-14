/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const echarts = require('echarts');
const { validateNetzeingriffe, DATA_DIR } = require('../src/data_ingestion/utils/netzeingriffeValidation');
const { buildLineChart } = require('../src/data_ingestion/builders/lineChart');
const { buildBarChart } = require('../src/data_ingestion/builders/barChart');
const { loadData } = require('../src/data_ingestion/builders/utils');
const configs = require('../src/data_ingestion/charts/netzeingriffe_stabilitaet');
const ANNUAL = 'netzeingriffe_jahre_2015_2025.csv';
const MONTHLY = 'netzeingriffe_monate_2022_2026.csv';
const SUMMARY = 'netzeingriffe_summary.json';
const MANIFEST = 'netzeingriffe_manifest.json';
const post = fs.readFileSync(path.join(__dirname, '../src/posts/2026/netzeingriffe-netzstabilitaet.md'), 'utf8');
let temporary;
let directory;

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'netzeingriffe-test-'));
  directory = path.join(temporary, 'entity');
  fs.cpSync(DATA_DIR, directory, { recursive: true });
});
afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

function replace(name, transform, rehash = false) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
  if (rehash) {
    const manifestFile = path.join(directory, MANIFEST);
    const manifest = JSON.parse(fs.readFileSync(manifestFile));
    const bytes = fs.readFileSync(file);
    manifest.files[name].bytes = bytes.length;
    manifest.files[name].sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  }
}

test('frozen CSV bytes match the independently audited source export', () => {
  const result = validateNetzeingriffe();
  // Every observation was compared with dd0c7f8 during the 2026-09-14 audit.
  // Pin the resulting bytes here without requiring history in shallow CI clones.
  for (const [name, hash] of [
    [ANNUAL, 'f204d1b9f8ba9d45b225ca682f6dfbdb74dc6f66614939755f6fb61905a0519e'],
    [MONTHLY, '9846b809705ba21a03830e2ba9eed65bd8a282b13f3abf0f0f3d704fb1012eb1'],
  ]) {
    expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(DATA_DIR, name))).digest('hex')).toBe(hash);
  }
  expect(result.annual).toHaveLength(11);
  expect(result.monthly).toHaveLength(47);
});

test.each([ANNUAL, MONTHLY, SUMMARY, MANIFEST])('missing %s fails the entire package', (name) => {
  fs.unlinkSync(path.join(directory, name));
  expect(() => validateNetzeingriffe(directory)).toThrow();
});

test.each([ANNUAL, MONTHLY, SUMMARY])('modified %s fails its hash', (name) => {
  replace(name, (text) => text.replace(/\d/, '9'));
  expect(() => validateNetzeingriffe(directory)).toThrow();
});

test.each([
  [ANNUAL, (text) => text.replace('2016,', '2015,')],
  [ANNUAL, (text) => text.replace('20709', '')],
  [ANNUAL, (text) => text.replace('20709', 'Infinity')],
  [ANNUAL, (text) => text.replace('20709', '-1')],
  [ANNUAL, (text) => text.replace('kosten_mio_eur', 'kosten_eur')],
  [MONTHLY, (text) => text.replace('2022-07', '2022-13')],
  [MONTHLY, (text) => text.replace('2026-05', '2026-06')],
  [MONTHLY, (text) => text.replace('1464.80', '9999.00')],
  [MONTHLY, (text) => text.split('\n').slice(0, -2).join('\n') + '\n'],
  [SUMMARY, (text) => text.replace('-6128', '-6000')],
])('semantic corruption in %s fails even with an updated hash', (name, transform) => {
  replace(name, transform, true);
  expect(() => validateNetzeingriffe(directory)).toThrow();
});

test('rejects extra files, unsafe paths and symlinks', () => {
  fs.writeFileSync(path.join(directory, 'raw.csv'), 'raw');
  expect(() => validateNetzeingriffe(directory)).toThrow();
  fs.unlinkSync(path.join(directory, 'raw.csv'));
  fs.unlinkSync(path.join(directory, SUMMARY));
  fs.symlinkSync(path.join(DATA_DIR, SUMMARY), path.join(directory, SUMMARY));
  expect(() => validateNetzeingriffe(directory)).toThrow();
  const linked = path.join(temporary, 'linked');
  fs.symlinkSync(DATA_DIR, linked);
  expect(() => validateNetzeingriffe(linked)).toThrow();
  replace(MANIFEST, (text) => text.replace(ANNUAL, '../' + ANNUAL));
  expect(() => validateNetzeingriffe(directory)).toThrow();
});

test.each(['2026-09-14', '2015', 'GWh', 'dd0c7f8', 'CC BY 4.0'])('metadata change %s requires explicit contract review', (value) => {
  replace(MANIFEST, (text) => text.replace(value, 'changed'));
  expect(() => validateNetzeingriffe(directory)).toThrow();
});

test('post preserves dates, static evidence, accurate rounded claims and dashboard ending', () => {
  const { annual, summary } = validateNetzeingriffe();
  expect(post).toContain('date: 2026-09-11');
  expect(post).toContain('lastUpdated: 2026-09-14');
  expect(post).toContain(`**knapp ${Math.round(-summary.energy_change_2022_2025_pct)} Prozent**`);
  expect(post).toContain(`**${summary.cost_change_2024_2025_pct.toFixed(1).replace('.', ',')} Prozent mehr**`);
  for (const row of annual.filter((r) => Number(r.jahr) >= 2022)) {
    expect(post).toContain(`| ${row.jahr} | ${Number(row.massnahmenenergie_gwh).toLocaleString('de-DE')} GWh | ${Number(row.kosten_mio_eur).toLocaleString('de-DE')} Mio. € |`);
  }
  expect(post.indexOf('**Beide Richtungen zählen**')).toBeLessThan(post.indexOf('<div class="chart-section">'));
  expect(post.trim()).toMatch(/\[Strom-Dashboard\]\(\/dashboards\/strom\/\)\.$/);
  expect(post).not.toMatch(/^# /m);
});

function captureOption(config) {
  const data = loadData(path.join(__dirname, '../src/data_ingestion/data', config.dataFile));
  const build = config.type === 'bar' ? buildBarChart : buildLineChart;
  let option;
  const script = build(data, config);
  vm.runInNewContext(script, {
    document: { getElementById: () => ({}) },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    echarts: { init: () => ({ setOption: (value) => { option = value; } }) },
  });
  return { script, option };
}

test('nested CSVs generate stable URLs, explicit colors and straight lines', () => {
  for (const config of configs) {
    const { script, option } = captureOption(config);
    expect(post).toContain(`id="${config.containerId}"`);
    expect(post).toContain(`/js/charts/netzeingriffe_stabilitaet/${config.outputFile}`);
    expect(config.seriesKeys.length).toBeGreaterThan(0);
    option.series.forEach((series, index) => {
      expect(series.itemStyle.color).toBe(config.colors[index]);
      if (config.type === 'line') expect(series.smooth).toBe(false);
    });
    // Committed generated files must match the current config and frozen evidence.
    expect(fs.readFileSync(path.join(__dirname, '../src/js/charts/netzeingriffe_stabilitaet', config.outputFile), 'utf8').trim()).toBe(script.trim());
  }
});

test.each([240, 280, 320, 768])('monthly legend stays inside a %ipx chart and above the plot', (width) => {
  const { option } = captureOption(configs[2]);
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height: 430 });
  try {
    chart.setOption(JSON.parse(JSON.stringify(option)));
    const svg = chart.renderToSVGString();
    const legend = chart.getViewOfComponentModel(chart.getModel().getComponent('legend'));
    const bounds = legend.group.getBoundingRect().clone();
    bounds.applyTransform(legend.group.transform);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThan(430 * 0.18);
    expect(svg).toContain('Markt-Redispatch');
  } finally {
    chart.dispose();
  }
});
