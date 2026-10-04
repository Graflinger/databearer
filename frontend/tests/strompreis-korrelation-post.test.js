/** @jest-environment jsdom */
const fs = require('fs');
const os = require('os');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { validateStrompreisKorrelation } = require('../src/data_ingestion/utils/strompreisKorrelationValidation');
const configs = require('../src/data_ingestion/charts/strompreis_korrelation');

const root = path.resolve(__dirname, '../src');
const POST = path.join(root, 'posts/2026/strompreis-gaspreis-erneuerbare.md');
const DATA = path.join(root, 'data_ingestion/data/2026/strompreis-korrelation');
const data = validateStrompreisKorrelation();
const source = fs.readFileSync(POST, 'utf8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)[1];

beforeAll(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(source.slice(frontmatter.length + 8));
});

// German table text such as "−1,59 (−2,10 bis −1,07)" -> [-1.59, -2.1, -1.07].
const numbers = (text) => (text.match(/[−-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || [])
  .map((value) => ({ value: Number(value.replace('−', '-').replace(/\./g, '').replace(',', '.')), decimals: (value.split(',')[1] || '').length }));
const expectCell = (cell, expected) => {
  const parsed = numbers(cell.textContent);
  expect(parsed).toHaveLength(expected.length);
  parsed.forEach(({ value, decimals }, index) => expect(value).toBe(Number(expected[index].toFixed(decimals))));
};
const rows = (id) => [...document.querySelectorAll(`#${id} tbody tr`)];
const byPeriod = (period) => data.correlations.find((row) => row.Zeitraum === period);

describe('frozen data set', () => {
  test('rejects edited or missing files', () => {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'strompreis-'));
    try {
      for (const name of fs.readdirSync(DATA)) fs.copyFileSync(path.join(DATA, name), path.join(copy, name));
      expect(validateStrompreisKorrelation(copy).monthly).toHaveLength(84);
      const file = path.join(copy, 'strompreis_korrelation_monthly.csv');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('49.39', '49.40'));
      expect(() => validateStrompreisKorrelation(copy)).toThrow('size/hash mismatch');
      fs.unlinkSync(file);
      expect(() => validateStrompreisKorrelation(copy)).toThrow();
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test('chart configs read only the validated frozen files', () => {
    expect(configs.map((config) => config.containerId)).toEqual(['strompreis-gaspreis-verlauf', 'strompreis-streuung-gas', 'strompreis-streuung-erneuerbare', 'strompreis-korrelationen', 'strompreis-erwartung-2026']);
    for (const config of configs) expect(config.dataFile).toMatch(/^2026\/strompreis-korrelation\/strompreis_korrelation_(monthly|correlations|2026)\.csv$/);
    // Correlations are bounded: the axis must not suggest values beyond ±1.
    const bars = configs.find((config) => config.containerId === 'strompreis-korrelationen');
    expect([bars.yAxisMin, bars.yAxisMax]).toEqual([-1, 1]);
    const generated = fs.readFileSync(path.join(root, 'js/charts/strompreis_korrelation/korrelationen.js'), 'utf8');
    expect(generated).toMatch(/type: 'value',\n\s+min: -1,\n\s+max: 1,/);
  });
});

describe('article evidence', () => {
  test('every chart script belongs to a config and has a matching table and source', () => {
    const scripts = [...document.querySelectorAll('script[src^="/js/charts/strompreis_korrelation/"]')];
    expect(scripts.map((script) => script.getAttribute('src'))).toEqual(configs.map((config) => `/js/charts/strompreis_korrelation/${config.outputFile}`));
    for (const config of configs) {
      const container = document.getElementById(config.containerId);
      expect(container).not.toBeNull();
      const section = container.closest('.chart-section');
      expect(section.querySelector(`#${config.containerId}-table caption`).textContent).toMatch(/Ausgewählte/);
      expect(section.querySelector('.chart-sources a[href="https://www.smard.de/home/marktdaten"]')).not.toBeNull();
    }
  });

  test('monthly table matches the monthly CSV', () => {
    const tableRows = rows('strompreis-gaspreis-verlauf-table');
    expect(tableRows.length).toBeGreaterThanOrEqual(2);
    for (const row of tableRows) {
      const month = data.monthly.find((item) => item.Monat === row.querySelector('time').getAttribute('datetime'));
      const cells = row.querySelectorAll('td');
      expectCell(cells[0], [month.Strompreis_EUR_MWh]);
      expectCell(cells[1], [month.Gaspreis_EUR_MWh]);
    }
  });

  test.each([
    ['strompreis-streuung-gas-table', ['Pearson_Gas']],
    ['strompreis-streuung-erneuerbare-table', ['Pearson_Erneuerbare']],
    ['strompreis-korrelationen-table', ['Pearson_Erneuerbare', 'Pearson_Gas', 'Pearson_Veraenderung_Erneuerbare', 'Pearson_Veraenderung_Gas']],
  ])('%s matches the correlation CSV', (id, keys) => {
    const tableRows = rows(id);
    expect(tableRows.map((row) => row.querySelector('th').textContent)).toEqual(data.correlations.map((row) => row.Zeitraum));
    for (const row of tableRows) {
      const expected = byPeriod(row.querySelector('th').textContent);
      const cells = [...row.querySelectorAll('td')];
      const offset = cells.length - keys.length;
      if (offset) expectCell(cells[0], [expected.Monate]);
      keys.forEach((key, index) => expectCell(cells[offset + index], [expected[key]]));
    }
  });

  test('regression table matches the regression CSV including intervals', () => {
    const tableRows = rows('strompreis-regression-table');
    expect(tableRows).toHaveLength(data.regression.length);
    tableRows.forEach((row, index) => {
      const expected = data.regression[index];
      expect(row.querySelector('th').textContent).toContain(expected.Zeitraum);
      const cells = row.querySelectorAll('td');
      expectCell(cells[0], [expected.Gas_Koeffizient, expected.Gas_KI95_unten, expected.Gas_KI95_oben]);
      expectCell(cells[1], [expected.Erneuerbare_Koeffizient, expected.Erneuerbare_KI95_unten, expected.Erneuerbare_KI95_oben]);
      expectCell(cells[2], [expected.R2]);
    });
  });

  test('headline figures in the text match the frozen results', () => {
    const format = (value) => value.toFixed(2).replace('-', '−').replace('.', ',');
    const all = byPeriod('2019–2025');
    for (const value of [all.Pearson_Gas, all.Pearson_Erneuerbare, byPeriod('2019–2020').Pearson_Erneuerbare, byPeriod('2023–2025').Pearson_Erneuerbare]) {
      expect(source).toContain(`**${format(value)}**`);
    }
    // Annual means are hour-weighted from the published monthly values.
    for (const [year, text] of [['2019', '37,67'], ['2020', '30,47'], ['2022', '235,45'], ['2024', '78,51'], ['2025', '89,32']]) {
      const months = data.monthly.filter((row) => row.Monat.startsWith(year));
      const hours = months.reduce((sum, row) => sum + row.Stunden, 0);
      expect(format(months.reduce((sum, row) => sum + row.Strompreis_EUR_MWh * row.Stunden, 0) / hours)).toBe(text);
      expect(source).toContain(`**${text} Euro**`);
    }
  });

  test('regression backup table is a closed disclosure with a table note', () => {
    const details = document.getElementById('strompreis-regression-table').closest('details.post-data-details');
    expect(details).not.toBeNull();
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('p.table-note a[href="https://www.smard.de/home/marktdaten"]')).not.toBeNull();
    const key = data.regression.find((row) => row.Modell === 'Gas_Erneuerbare' && row.Zeitraum === '2023–2025');
    expect(source).toContain(`**In den Jahren 2023–2025 lag der Strompreis bei gleichem Gaspreis um rund ${(-key.Erneuerbare_Koeffizient).toFixed(2).replace('.', ',')} Euro`);
  });

  test('frontmatter describes the benchmark scope and the local image', () => {
    expect(frontmatter).toMatch(/^image: "\/images\/blog_card_images\/2026\/strompreis-gas-erneuerbare\.png"$/m);
    expect(fs.existsSync(path.join(root, 'images/blog_card_images/2026/strompreis-gas-erneuerbare.png'))).toBe(true);
    expect(frontmatter).toMatch(/^topic: \["energie", "wirtschaft"\]$/m);
    expect(source).toContain('nicht um einen täglichen Day-Ahead-Spotpreis');
    expect(source).toMatch(/Korrelation ist keine Ursache/);
  });
});

describe('2026 out-of-sample comparison', () => {
  const hourWeighted = (items, key) => items.reduce((sum, row) => sum + row[key] * row.Stunden, 0) / items.reduce((sum, row) => sum + row.Stunden, 0);
  const quarter = (items, year, index) => items.filter((row) => row.Monat.startsWith(year) && Math.ceil(Number(row.Monat.slice(5)) / 3) === index + 1);
  const whole = (value) => value.toFixed(0);
  const { intercept, gas, renewable_share: renewable } = data.metadata.current_year.model_coefficients;

  test('quarter table matches hour-weighted means of the frozen monthly files', () => {
    const tableRows = rows('strompreis-erwartung-2026-table');
    expect(tableRows.map((row) => row.querySelector('th').textContent)).toEqual(['1. Quartal', '2. Quartal', '3. Quartal']);
    tableRows.forEach((row, index) => {
      const before = quarter(data.monthly, '2025', index);
      const now = quarter(data.current, '2026', index);
      const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent);
      expect(cells).toEqual([
        `${whole(hourWeighted(before, 'Gaspreis_EUR_MWh'))} → ${whole(hourWeighted(now, 'Gaspreis_EUR_MWh'))}`,
        `${whole(hourWeighted(before, 'Strompreis_EUR_MWh'))} → ${whole(hourWeighted(now, 'Strompreis_EUR_MWh'))}`,
        whole(hourWeighted(now, 'Erwartet_EUR_MWh')),
      ]);
    });
  });

  test('text claims about deviations follow from the data', () => {
    const deviations = data.current.map((row) => row.Abweichung_EUR_MWh);
    const summer = deviations.slice(5);
    expect(Math.min(...summer)).toBeGreaterThan(20);
    expect(Math.round(Math.max(...summer))).toBe(32);
    expect(source).toContain('**20 bis 32 Euro je Megawattstunde**');
    expect(Math.max(...deviations.slice(0, 5).map(Math.abs))).toBeLessThanOrEqual(14);
    // No 2023–2025 month deviated by that much from the same model.
    const inSample = data.monthly.filter((row) => row.Zeitraum === '2023–2025')
      .map((row) => Math.abs(row.Strompreis_EUR_MWh - (intercept + gas * row.Gaspreis_EUR_MWh + renewable * row.Erneuerbarenanteil_Prozent)));
    expect(Math.max(...inSample)).toBeLessThan(20);
    expect(source).toContain('Eine so große Abweichung gab es in den Jahren 2023–2025 in keinem einzigen Monat.');
    // September gas lies outside the 2023–2025 range, which the article flags.
    const maxGas = Math.max(...data.monthly.filter((row) => row.Zeitraum === '2023–2025').map((row) => row.Gaspreis_EUR_MWh));
    expect(data.current.at(-1).Gaspreis_EUR_MWh).toBeGreaterThan(maxGas);
    expect(source).toContain('Im September lag der Gaspreis zudem über allen Werten der Jahre 2023–2025');
  });
});

test('no calculation links a higher renewable share to a higher wholesale price', () => {
  expect(source).toContain('**Kein Hinweis, dass Erneuerbare den Börsenstrom verteuert haben.**');
  const values = [
    ...data.correlations.flatMap((row) => [row.Pearson_Erneuerbare, row.Spearman_Erneuerbare, row.Partiell_Erneuerbare, row.Pearson_Veraenderung_Erneuerbare]),
    ...data.regression.map((row) => row.Erneuerbare_Koeffizient),
  ];
  // "Negativ oder nahe null": no positive value above 0.05.
  for (const value of values) expect(value).toBeLessThanOrEqual(0.05);
});

describe('editorial rules', () => {
  const body = () => document.body.textContent;
  test('one-author voice, no pipeline detail, caveat stated once', () => {
    expect(body()).not.toMatch(/\b(wir|uns|unser\w*)\b/i);
    expect(body()).not.toMatch(/[a-f0-9]{40}|\.csv|\.json|Prüfsumme|Repository|Newey|Spearman|Pearson|MMBtu|Methodik/);
    expect(source.match(/Korrelation ist keine Ursache/g)).toHaveLength(1);
    expect(source).not.toContain('Schritt für Schritt');
  });

  test('ends with a short Daten und Quellen section', () => {
    const headings = [...document.querySelectorAll('h2')];
    const last = headings.at(-1);
    expect(last.textContent).toBe('Daten und Quellen');
    const following = [];
    for (let node = last.nextElementSibling; node; node = node.nextElementSibling) following.push(node);
    expect(following.filter((node) => node.tagName === 'P')).toHaveLength(2);
    expect(following.at(-1).tagName).toBe('UL');
  });

  test('explains the correlation scale at first mention', () => {
    expect(document.querySelector('p').textContent).toContain('+1 bedeutet vollständigen Gleichlauf, −1 eine vollständige Gegenbewegung');
  });
});
