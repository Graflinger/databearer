/** @jest-environment jsdom */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const MarkdownIt = require('markdown-it');
const { validateHaushaltsstrompreis, DIRECTORY } = require('../src/data_ingestion/utils/haushaltsstrompreisValidation');
const configs = require('../src/data_ingestion/charts/haushaltsstrompreis');

const dataDir = path.join(__dirname, '../src/data_ingestion/data', DIRECTORY);
const post = fs.readFileSync(path.join(__dirname, '../src/posts/2026/warum-haushaltsstrom-teuer-bleibt.md'), 'utf8');
const data = validateHaushaltsstrompreis();
const format = (v) => v.toFixed(2).replace('.', ',');

beforeAll(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(post.replace(/^---\n[\s\S]*?\n---\n/, ''));
});

function withCopy(check) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haushaltsstrompreis-'));
  try {
    fs.cpSync(dataDir, dir, { recursive: true });
    check(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.each(['missing', 'changed', 'extra', 'symlink'])('rejects %s evidence', (kind) => withCopy((dir) => {
  const file = path.join(dir, 'eu.csv');
  if (kind === 'missing') fs.unlinkSync(file);
  if (kind === 'changed') fs.appendFileSync(file, '\n');
  if (kind === 'extra') fs.writeFileSync(path.join(dir, 'unreviewed.csv'), 'not licensed');
  if (kind === 'symlink') {
    fs.unlinkSync(file);
    fs.symlinkSync(path.join(dataDir, 'eu.csv'), file);
  }
  expect(() => validateHaushaltsstrompreis(dir)).toThrow();
}));

test('a newly hashed but inconsistent component package still fails', () => withCopy((dir) => {
  const file = path.join(dir, 'komponenten.csv');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('14.81', '15.81'));
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files['komponenten.csv'].sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(() => validateHaushaltsstrompreis(dir)).toThrow('component sum mismatch');
}));

test('licence and observational status cannot silently disappear', () => withCopy((dir) => {
  const file = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(file));
  m.licenses.smard.status = 'usable';
  fs.writeFileSync(file, JSON.stringify(m));
  expect(() => validateHaushaltsstrompreis(dir)).toThrow('licence gate');
  m.licenses.smard.status = 'not_used';
  m.quality.source_flags = [];
  fs.writeFileSync(file, JSON.stringify(m));
  expect(() => validateHaushaltsstrompreis(dir)).toThrow('quality');
}));

test('tables reproduce the frozen data and each chart carries the reuse notice', () => {
  for (const config of configs) {
    expect(config.dataFile).toMatch(/^2026\/haushaltsstrompreis\//);
    const container = document.getElementById(config.containerId);
    const section = container.closest('.chart-section');
    expect(section.querySelector('.chart-sources').textContent).toContain('2011/833/EU');
    expect(section.querySelector('.chart-sources').textContent).toContain('Eurostat ist für diese Bearbeitung nicht verantwortlich.');
    const table = document.getElementById(`${config.containerId}-table`);
    expect(table.querySelector('caption').textContent).toContain('Ausgewählte');
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(6);
    for (const row of rows) {
      let expected;
      if (row.dataset.period) {
        const record = data.series.find((r) => r.Halbjahr === row.dataset.period);
        expected = [record.Gesamt_ct_kWh, record.Ohne_Steuern_ct_kWh, record.Steuern_ct_kWh];
      } else if (row.dataset.year) {
        const record = data.components.find((r) => r.Jahr === row.dataset.year);
        expected = [record.Energie_Vertrieb_ct_kWh, record.Netze_ct_kWh, record.Steuern_ct_kWh, record.Gesamt_ct_kWh];
      } else {
        expected = [data.eu.find((r) => r.Land === row.querySelector('th').textContent).Gesamt_ct_kWh];
      }
      expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual(expected.map(format));
    }
    const script = fs.readFileSync(path.join(__dirname, '../src/js/charts/haushaltsstrompreis', config.outputFile), 'utf8');
    expect(script).toContain(`getElementById('${config.containerId}')`);
  }
});

test('headline arithmetic, ranking and caveats agree with the actual evidence', () => {
  const a = data.components.find((r) => r.Jahr === '2023');
  const b = data.components.find((r) => r.Jahr === '2025');
  expect(format(a.Energie_Vertrieb_ct_kWh - b.Energie_Vertrieb_ct_kWh)).toBe('5,11');
  expect(format(a.Gesamt_ct_kWh - b.Gesamt_ct_kWh)).toBe('2,23');
  expect(format(b.Netze_ct_kWh + b.Steuern_ct_kWh - a.Netze_ct_kWh - a.Steuern_ct_kWh)).toBe('2,88');
  const current = data.series.at(-1).Gesamt_ct_kWh;
  const pre = data.series.find((r) => r.Halbjahr === '2021-S1').Gesamt_ct_kWh;
  const eu = data.eu.find((r) => r.Code === 'EU27_2020').Gesamt_ct_kWh;
  expect(((current / pre - 1) * 100).toFixed(1)).toBe('13.3');
  expect(((current / eu - 1) * 100).toFixed(1)).toBe('27.8');
  for (const fragment of ['5,11 Cent', '2,23 Cent', '2,88 ct/kWh', '13,3 Prozent', '27,8 Prozent', 'Preisbremsen 2023 eingerechnet', 'Malta', 'vorläufig', 'PPS']) expect(post).toContain(fragment);
  expect(data.eu.find((r) => r.Code === 'NL').Steuern_ct_kWh).toBeLessThan(0);
  expect(post).toMatch(/^draft: true$/m);
  expect(post).not.toMatch(/^image:/m);
  expect(post).not.toMatch(/235,45|78,51|89,32|\b(wir|unser\w*)\b/i);
  expect(document.querySelectorAll('h1')).toHaveLength(0);
  expect([...document.querySelectorAll('h2')].at(-1).textContent).toBe('Daten und Quellen');
});
