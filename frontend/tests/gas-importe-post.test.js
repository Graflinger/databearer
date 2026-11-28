const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const matter = require('gray-matter');
const markdown = require('markdown-it')({ html: true });
const { validateGasImporte } = require('../src/data_ingestion/utils/gasImporteValidation');
const configs = require('../src/data_ingestion/charts/gas_importe');
const { buildBarChart } = require('../src/data_ingestion/builders/barChart');
const vm = require('vm');

const directory = path.resolve(__dirname, '../src/data_ingestion/data/2026/gas_importe');
const post = matter(fs.readFileSync(path.resolve(__dirname, '../src/posts/2026/gasimporte-abhaengigkeit.md'), 'utf8'));
const { tables } = validateGasImporte();
const format = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

test('draft retains static, source-linked evidence whose values match each chart CSV', () => {
  expect(post.data.draft).toBe(true);
  expect(post.data.topic).toEqual(['energie', 'politik-und-gesellschaft']);
  document.body.innerHTML = markdown.render(post.content);
  expect(document.querySelector('h1')).toBeNull();
  expect(document.querySelectorAll('.chart-section')).toHaveLength(4);
  for (const config of configs) {
    const table = document.getElementById(`${config.containerId}-table`);
    const data = tables[path.basename(config.dataFile)];
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(6);
    for (const tr of rows) {
      const cells = [...tr.children].map((cell) => cell.textContent);
      const observation = data.find((row) => row[config.xKey] === cells[0]);
      expect(observation).toBeDefined();
      expect(cells.slice(1)).toEqual(config.seriesKeys.map((key) => format(observation[key])));
    }
    const credit = table.closest('.chart-section').querySelector('.chart-sources');
    expect(credit.textContent).toContain('2011/833/EU');
    expect(credit.textContent).toContain('Eurostat ist für diese Bearbeitung nicht verantwortlich');
    expect(credit.textContent).toContain('05.11.2026');
    const generated = fs.readFileSync(path.resolve(__dirname, `../src/js/charts/gas_importe/${config.outputFile}`), 'utf8');
    expect(generated).toContain(config.containerId);
  }
});

test('headline, LNG and flow findings use the right units and denominators', () => {
  const last = tables['dependency.csv'].at(-1);
  expect(last.Gas_DE_PC).toBe(91.578);
  // Values above 100% must survive the entire evidence path.
  expect(tables['dependency.csv'].find((r) => r.Jahr === '2022').Gas_DE_PC).toBe(105.896);
  const [before, after] = tables['balance_de.csv'];
  const change = (key) => (after[key] / before[key] - 1) * 100;
  expect(format(change('Import_TWh'))).toBe('21,0');
  expect(format(change('Netto_TWh'))).toBe('0,7');
  expect(format(change('Verbrauch_TWh'))).toBe('3,4');
  const lng = tables['partners.csv'].at(-1);
  expect(format(lng.LNG_TJ / 3600)).toBe('59,9');
  expect(format(100 * lng.LNG_TJ / lng.TOTAL_TJ)).toBe('7,8');
  expect(format(100 * lng.US_LNG_TJ / lng.LNG_TJ)).toBe('84,0');
  const eu = tables['quality.json'].summaries.EU27_2020['2025'];
  expect(format(eu.NET_TJ / eu.IC_OBS * 100)).toBe('87,6');
  expect(format(eu.NET_TJ / eu.IC_CAL_MG * 100)).toBe('87,4');
  for (const number of ['91,6', '21,0', '0,7', '59,9', '7,8', '84,0', '87,6']) expect(post.content).toContain(number);
});

test('partner bars keep every country label visible with space below the plot', () => {
  const config = configs.find((c) => c.containerId === 'gas-partner');
  document.body.innerHTML = `<div id="${config.containerId}"></div>`;
  let option;
  vm.runInNewContext(buildBarChart(tables['partner_comparison.csv'], config), {
    document, window: { addEventListener() {} },
    echarts: { init: () => ({ setOption: (value) => { option = value; } }) },
  });
  expect(option.xAxis.data).toHaveLength(6);
  expect(option.xAxis.axisLabel.interval).toBe(0);
  expect(option.xAxis.axisLabel.rotate).toBe(45);
  expect(option.grid.bottom).toBe('30%');
});

describe('frozen package rejects incomplete, mixed and semantically broken evidence', () => {
  let temp;
  beforeEach(() => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-imports-test-'));
    fs.cpSync(directory, temp, { recursive: true });
  });
  afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = (root, name) => path.join(root, name);
  function changePayload(name, change) {
    const filename = file(temp, name);
    const bytes = Buffer.from(change(fs.readFileSync(filename, 'utf8')));
    fs.writeFileSync(filename, bytes);
    const manifestPath = file(temp, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    Object.assign(manifest.files[name], { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  }
  test('missing supporting data fails even when chart inputs remain', () => {
    fs.unlinkSync(file(temp, 'monthly.csv'));
    expect(() => validateGasImporte(temp)).toThrow(/allowlist/);
  });
  test('mixed payload bytes fail hash validation', () => {
    fs.appendFileSync(file(temp, 'partners.csv'), '\n');
    expect(() => validateGasImporte(temp)).toThrow(/hash\/size/);
  });
  test('symlink cannot stand in for a frozen payload', () => {
    fs.unlinkSync(file(temp, 'partners.csv'));
    fs.symlinkSync(file(directory, 'partners.csv'), file(temp, 'partners.csv'));
    expect(() => validateGasImporte(temp)).toThrow(/regular file/);
  });
  test('duplicate month fails after coordinated hash update', () => {
    changePayload('monthly.csv', (text) => text.replace('DE,2024-02,', 'DE,2024-01,'));
    expect(() => validateGasImporte(temp)).toThrow(/monthly coverage/);
  });
  test('wrong TJ/TWh conversion fails after coordinated hash update', () => {
    changePayload('partner_comparison.csv', (text) => text.replace('600.450745', '600450.745000'));
    expect(() => validateGasImporte(temp)).toThrow(/partner conversion/);
  });
  test('opposite stock sign fails balance reconciliation', () => {
    changePayload('balance_de.csv', (text) => text.replace('-55.026944', '55.026944'));
    expect(() => validateGasImporte(temp)).toThrow(/annual unit conversion/);
  });
  test('changed licence permission fails the gate', () => {
    const filename = file(temp, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(filename));
    manifest.licenses['eurostat-data-reuse-2011-833'].commercial_reuse = false;
    fs.writeFileSync(filename, JSON.stringify(manifest));
    expect(() => validateGasImporte(temp)).toThrow(/licence gate/);
  });
});
