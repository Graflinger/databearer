/** @jest-environment jsdom */
const fs = require('fs');
const os = require('os');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { validatePvLernkurve } = require('../src/data_ingestion/utils/pvLernkurveValidation');
const configs = require('../src/data_ingestion/charts/pv_lernkurve');

const root = path.resolve(__dirname, '../src');
const POST = path.join(root, 'posts/2026/deutschland-solarstrom-lernkurve.md');
const DATA = path.join(root, 'data_ingestion/data/2026/pv-lernkurve');
const data = validatePvLernkurve();
const source = fs.readFileSync(POST, 'utf8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)[1];
const text = () => document.body.textContent.replace(/\s+/g, ' ');

beforeAll(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(source.slice(frontmatter.length + 8));
});

// German number text such as "1.200,4" -> 1200.4, with the number of decimals shown.
const numbers = (value) => (value.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || [])
  .map((match) => ({ value: Number(match.replace(/\./g, '').replace(',', '.')), decimals: (match.split(',')[1] || '').length }));
// Published text rounds the frozen CSV value: allow exactly half a unit of the last shown digit.
const expectRounded = (shown, expected) => {
  const [parsed] = numbers(shown);
  expect(Math.abs(parsed.value - expected)).toBeLessThanOrEqual(0.5 * 10 ** -parsed.decimals + 1e-9);
};
const rows = (id) => [...document.querySelectorAll(`#${id} tbody tr`)];
const byYear = (table, year) => table.find((row) => row.Jahr === year);
const kennzahl = (name, period) => data.kennzahlen.find((row) => row.Kennzahl === name && row.Zeitraum === period).Wert;

describe('frozen data set', () => {
  test('rejects edited or missing files', () => {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-lernkurve-'));
    try {
      for (const name of fs.readdirSync(DATA)) fs.copyFileSync(path.join(DATA, name), path.join(copy, name));
      expect(validatePvLernkurve(copy).jahre).toHaveLength(26);
      const file = path.join(copy, 'pv_lernkurve_zubau.csv');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('512.692', '512.693'));
      expect(() => validatePvLernkurve(copy)).toThrow('size/hash mismatch');
      fs.unlinkSync(file);
      expect(() => validatePvLernkurve(copy)).toThrow();
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test('chart configs read only the validated frozen files', () => {
    expect(configs.map((config) => config.containerId)).toEqual(['pv-anteil-deutschland', 'pv-modulpreis', 'pv-zubau-welt']);
    for (const config of configs) expect(config.dataFile).toMatch(/^2026\/pv-lernkurve\/pv_lernkurve_(zubau|modulpreis)\.csv$/);
  });
});

describe('article evidence', () => {
  test('every chart script belongs to a config and has a matching table and source', () => {
    const scripts = [...document.querySelectorAll('script[src^="/js/charts/pv_lernkurve/"]')];
    expect(scripts.map((script) => script.getAttribute('src'))).toEqual(configs.map((config) => `/js/charts/pv_lernkurve/${config.outputFile}`));
    for (const config of configs) {
      const section = document.getElementById(config.containerId).closest('.chart-section');
      expect(section.querySelector(`#${config.containerId}-table caption`).textContent).toMatch(/Ausgewählte/);
      expect(section.querySelector('.chart-sources a[href^="https://ourworldindata.org/grapher/"]')).not.toBeNull();
    }
  });

  test('share table matches the additions CSV', () => {
    for (const row of rows('pv-anteil-deutschland-table')) {
      const year = byYear(data.zubau, row.querySelector('th').textContent);
      const cells = row.querySelectorAll('td');
      expectRounded(cells[0].textContent, year.Anteil_Zubau_Deutschland_Prozent);
      expectRounded(cells[1].textContent, year.Anteil_Bestand_Deutschland_Prozent);
    }
  });

  test('price table matches the module price CSV', () => {
    for (const row of rows('pv-modulpreis-table')) {
      expectRounded(row.querySelector('td').textContent, byYear(data.modulpreis, row.querySelector('th').textContent).Modulpreis_USD_W);
    }
  });

  test('additions table matches the additions CSV and adds up', () => {
    for (const row of rows('pv-zubau-welt-table')) {
      const year = byYear(data.zubau, row.querySelector('th').textContent);
      const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent);
      ['Zubau_Deutschland_GW', 'Zubau_China_GW', 'Zubau_Uebrige_Welt_GW', 'Zubau_Welt_GW'].forEach((key, index) => expectRounded(cells[index], year[key]));
    }
  });

  test('headline numbers in the text follow the frozen key figures', () => {
    const body = text();
    expect(Math.round(kennzahl('Anteil Deutschlands am weltweiten Zubau', '2004–2010'))).toBe(46);
    expect(body).toMatch('46 Prozent der weltweit neu gebauten Solarleistung');
    expect(Math.round(kennzahl('Höchster Anteil am Jahreszubau', '2005'))).toBe(64);
    expect(Math.round(kennzahl('Anteil Deutschlands am weltweiten Zubau', '2001–2012'))).toBe(34);
    expect(Math.round(kennzahl('Lernrate', '1975–2025'))).toBe(24);
    expect(Math.round(kennzahl('Lernrate', '2000–2025'))).toBe(29);
    expect(Math.round(kennzahl('Rückgang des Modulpreises', '2004–2012'))).toBe(76);
    expect(Math.round(kennzahl('Rückgang des Modulpreises', '2004–2025'))).toBe(97);
    expect(Math.round(kennzahl('Verdopplungen der weltweiten Leistung', '2004–2012'))).toBe(5);
    expect(kennzahl('Höchster Anteil am Bestand', '2007')).toBeCloseTo(49.19, 2);
    const y2025 = byYear(data.jahre, '2025');
    expect(y2025.CO2_Anteil_Deutschland_Prozent).toBeGreaterThan(1.4);
    expect(y2025.CO2_Anteil_Deutschland_Prozent).toBeLessThan(1.5); // "knapp 1,5 Prozent"
    expect(Math.round(byYear(data.zubau, '2025').Zubau_Welt_GW)).toBe(513);
    expect(Math.round(byYear(data.zubau, '2025').Zubau_Welt_GW / y2025.Deutschland_GW)).toBe(5); // "fast fünfmal"
    expect(byYear(data.zubau, '2025').Zubau_Welt_GW / y2025.Deutschland_GW).toBeLessThan(5);
    expect(byYear(data.jahre, '2005').CO2_Anteil_Deutschland_Prozent).toBeCloseTo(2.93, 2); // "2,9 Prozent", "knapp 3 Prozent"
    expect(Math.round(y2025.Solar_Stromanteil_Welt_Prozent)).toBe(9); // "fast 9 Prozent"
    expect(y2025.Solar_Stromanteil_Welt_Prozent).toBeLessThan(9);
    expect(Math.round(y2025.Solar_Stromanteil_Deutschland_Prozent)).toBe(18); // "knapp 18 Prozent"
    // German additions stayed below China's from 2013 and above it through 2012.
    for (const row of data.zubau) expect(row.Zubau_Deutschland_GW > row.Zubau_China_GW).toBe(row.Jahr <= '2012');
    // Since 2013 Germany's share of annual additions stays below 8 percent.
    for (const row of data.zubau.filter((item) => item.Jahr >= '2013')) expect(row.Anteil_Zubau_Deutschland_Prozent).toBeLessThan(8);
  });

  test('the tariff table outside charts carries its sources in a table note', () => {
    const wrapper = document.getElementById('pv-verguetung-table').closest('.table-scroll');
    const note = wrapper.nextElementSibling;
    expect(note.matches('p.table-note')).toBe(true);
    expect(note.querySelector('a[href*="bundesnetzagentur.de"]')).not.toBeNull();
  });
});
