/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');
const MarkdownIt = require('markdown-it');
const { validateEnergieintensiveIndustrie, DIRECTORY } = require('../src/data_ingestion/utils/energieintensiveIndustrieValidation');
const configs = require('../src/data_ingestion/charts/energieintensive_industrie');

const DATA = path.resolve(__dirname, '../src/data_ingestion/data', DIRECTORY);
const POST = path.resolve(__dirname, '../src/posts/2026/energieintensive-industrie.md');
const source = fs.readFileSync(POST, 'utf8');
const data = validateEnergieintensiveIndustrie();
const de = (value, digits) => value.toFixed(digits).replace('.', ',');

beforeAll(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(source.replace(/^---\n[\s\S]*?\n---\n/, ''));
});

function withCopy(test) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'industrie-'));
  try {
    for (const name of fs.readdirSync(DATA)) fs.copyFileSync(path.join(DATA, name), path.join(dir, name));
    test(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function rehash(dir, name) {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const bytes = fs.readFileSync(path.join(dir, name));
  Object.assign(manifest.files[name], { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

describe('frozen industry evidence', () => {
  test('missing, corrupt, extra and symlinked payloads fail', () => {
    for (const mutation of [
      (dir) => fs.unlinkSync(path.join(dir, 'quality.json')),
      (dir) => fs.appendFileSync(path.join(dir, 'production.csv'), '\n'),
      (dir) => fs.writeFileSync(path.join(dir, 'unexpected.csv'), 'x'),
      (dir) => { fs.unlinkSync(path.join(dir, 'quality.json')); fs.symlinkSync(path.join(DATA, 'quality.json'), path.join(dir, 'quality.json')); },
    ]) withCopy((dir) => { mutation(dir); expect(() => validateEnergieintensiveIndustrie(dir)).toThrow(); });
  });

  test('consistent hashes cannot hide duplicate dates or mixed supporting aggregates', () => {
    for (const [name, oldValue, newValue] of [
      ['production.csv', '2018-02', '2018-01'],
      ['production_annual.csv', '108.433', '109.433'],
      ['electricity_prices.csv', '2026-S1,17.420', '2026-S1,174.200'],
    ]) withCopy((dir) => {
      const file = path.join(dir, name);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(oldValue, newValue));
      rehash(dir, name);
      expect(() => validateEnergieintensiveIndustrie(dir)).toThrow();
    });
  });

  test('licence, revision and traversal changes fail', () => {
    for (const mutate of [
      (m) => { m.sources.prices.licence.changes = ''; },
      (m) => { m.sources.prices.tax = 'I_TAX'; },
      (m) => { m.sources.prices.updated = '2026-11-06T00:00:00Z'; },
      (m) => { m.files['../production.csv'] = m.files['production.csv']; },
    ]) withCopy((dir) => {
      const file = path.join(dir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(file));
      mutate(manifest);
      fs.writeFileSync(file, JSON.stringify(manifest));
      expect(() => validateEnergieintensiveIndustrie(dir)).toThrow();
    });
  });

  test('every chart reads nested frozen inputs and generated assets match every observation', () => {
    for (const config of configs) {
      expect(config.dataFile).toMatch(/^2026\/energieintensive_industrie\//);
      const generated = fs.readFileSync(path.resolve(__dirname, '../src/js/charts/energieintensive_industrie', config.outputFile), 'utf8');
      const expected = config.xKey === 'Monat' ? data.production : data.prices;
      const x = JSON.parse(generated.match(/const xData = (\[[^\n]+\]);/)[1]);
      const series = JSON.parse(generated.match(/const seriesData = (\[[^\n]+\]);/)[1]);
      expect(x).toEqual(expected.map((r) => r[config.xKey]));
      series.forEach((s, i) => expect(s.data).toEqual(expected.map((r) => r[config.seriesKeys[i]])));
    }
  });
});

describe('article and static evidence', () => {
  test('draft, topics, no invented card image and linked previous articles', () => {
    expect(source).toMatch(/^draft: true$/m);
    expect(source).toContain('topic: ["wirtschaft", "energie"]');
    expect(source).not.toMatch(/^image:/m);
    for (const target of ['2024/Deutschland-der-kranke-Mann-Europas', '2025/Industriepolitik', '2026/strompreis-gaspreis-erneuerbare']) {
      expect(source).toContain(`/posts/${target}/`);
    }
  });

  test('both chart tables match the frozen observations and preserve provisional labels', () => {
    for (const config of configs) {
      const container = document.getElementById(config.containerId);
      const table = document.getElementById(`${config.containerId}-table`);
      expect(container.getAttribute('role')).toBe('img');
      expect(document.getElementById(container.getAttribute('aria-describedby')).textContent.length).toBeGreaterThan(40);
      expect(table.querySelector('caption').textContent).toMatch(/Ausgewählte/);
      const rows = [...table.querySelectorAll('tbody tr')];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(6);
      for (const row of rows) {
        const period = row.querySelector('time')?.getAttribute('datetime') || row.dataset.period;
        const expected = (config.xKey === 'Monat' ? data.production : data.prices).find((r) => r[config.xKey] === period);
        [...row.querySelectorAll('td')].forEach((cell, i) => expect(cell.textContent).toBe(de(expected[config.seriesKeys[i]], config.xKey === 'Monat' ? 1 : 2)));
      }
      expect(rows.at(-1).textContent).toContain('vorläufig');
      expect(container.closest('.chart-section').querySelector('.chart-sources').textContent).toMatch(/Nutzungsbedingungen|Weiterverwendungsregeln/);
    }
  });

  test('headline gaps and price comparisons are computed from evidence', () => {
    const q = data.quality.calculated;
    for (const value of [-q.energy_intensive.vs_february_2022_pct, -q.industry.vs_february_2022_pct,
      -q.energy_intensive.vs_2018_mean_pct, -q.industry.vs_2018_mean_pct,
      -q.prices.de_vs_2025_s1_pct, q.prices.de_premium_pct, q.prices.de_vs_2018_s1_pct]) {
      expect(source).toContain(`${de(value, 1)} Prozent`);
    }
    expect(source).toContain('Eurostat ist für diese Bearbeitung nicht verantwortlich');
    expect(source).toContain('2,1 Prozent');
    expect(source).toContain('hier nur kalenderbereinigt');
  });
});
