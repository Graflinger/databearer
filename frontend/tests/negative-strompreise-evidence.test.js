/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { parse } = require('csv-parse/sync');

const root = path.resolve(__dirname, '../src');
const article = fs.readFileSync(path.join(root, 'posts/2026/negative-strompreise.md'), 'utf8');
const directory = path.join(root, 'data_ingestion/data/2026/negative_strompreise');
const table = (file) => parse(fs.readFileSync(path.join(directory, file)), { columns: true });
const german = (value, decimals) => Number(value).toLocaleString('de-DE', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
});
const mappings = [
  ['negative-preise-jahre', 'annual.csv', 'Zeitraum', ['Negative_Stunden', 'Anteil_Prozent']],
  ['negative-preise-quartale', 'quarterly.csv', 'Zeitraum', ['Negative_Stunden', 'Minimum_EUR_MWh', 'Laengste_Phase_Stunden']],
  ['negative-preise-tageszeit', 'midday.csv', 'Stunde', ['Anteil_2024_Prozent', 'Anteil_2025_Prozent', 'Anteil_2026_Prozent']],
  ['negative-preise-batterien', 'battery.csv', 'Jahr', ['Energie_GWh']],
];

beforeEach(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(article.replace(/^---\n[\s\S]*?\n---\n/, ''));
});

test.each(mappings)('%s: all static cells match the frozen evidence', (id, file, key, columns) => {
  const element = document.getElementById(`${id}-table`);
  expect(element.querySelector('caption').textContent).toMatch(/Ausgewählte/);
  expect([...element.querySelectorAll('thead th')].every((cell) => cell.getAttribute('scope') === 'col')).toBe(true);
  const rows = [...element.querySelectorAll('tbody tr')];
  expect(rows.length).toBeGreaterThanOrEqual(2);
  expect(rows.length).toBeLessThanOrEqual(6);
  for (const row of rows) {
    const label = row.querySelector('th[scope="row"]').textContent;
    const evidence = table(file).find((record) => record[key] === label);
    expect(evidence).toBeDefined();
    const cells = [...row.querySelectorAll('td')];
    expect(cells).toHaveLength(columns.length);
    cells.forEach((cell, index) => {
      const displayed = cell.textContent.trim().replace('−', '-');
      const decimals = displayed.includes(',') ? displayed.split(',')[1].length : 0;
      expect(displayed).toBe(german(evidence[columns[index]], decimals));
    });
  }
});

test('draft, source separation, caveats and contextual links remain explicit', () => {
  expect(article).toMatch(/^draft: true$/m);
  expect(article).toContain('topic: ["energie", "wirtschaft"]');
  expect(article).not.toMatch(/^# /m);
  expect(article).not.toMatch(/^image:/m);
  for (const phrase of ['Was die Zahlen zeigen – und was nicht', 'Daten und Quellen',
    '31. Oktober 2026', '26. September 2026', 'keine historischen Gesamtbestände',
    'Negative Preise sind nicht Abregelung', 'Eine kausale Speicherwirkung ist nicht nachgewiesen',
    'SMARD-Preiszeitreihen wurden für diesen Artikel nicht übernommen']) {
    expect(article).toContain(phrase);
  }
  for (const slug of ['batteriespeicher-wandel', 'strompreis-gaspreis-erneuerbare']) {
    expect(fs.existsSync(path.join(root, `posts/2026/${slug}.md`))).toBe(true);
    expect(document.querySelector(`a[href="/posts/2026/${slug}/"]`)).not.toBeNull();
  }
  expect(document.querySelector('a[href="/dashboards/strom/"]')).not.toBeNull();
  const sections = [...document.querySelectorAll('.chart-section')];
  expect(sections).toHaveLength(4);
  for (const [index, section] of sections.entries()) {
    const source = section.querySelector('.chart-sources');
    expect(source.textContent).toMatch(index === 3 ? /Datenlizenz Deutschland/ : /CC BY 4\.0/);
    expect(source.querySelector('a[href*="smard.de"]')).toBeNull();
  }
});

test('key prose figures follow quarter inputs, not the scouting numbers', () => {
  const quarters = table('quarterly.csv');
  const prior = quarters.find((r) => r.Zeitraum === '2025 Q2');
  const current = quarters.find((r) => r.Zeitraum === '2026 Q2');
  expect(article).toContain(`**${german(current.Negative_Stunden, 1)} Stunden`);
  const reduction = (1 - Number(current.Negative_Stunden) / Number(prior.Negative_Stunden)) * 100;
  expect(article).toContain(`**${german(reduction, 0)} Prozent weniger**`);
  expect(article).toContain(`−${german(-Number(current.Minimum_EUR_MWh), 2)} Euro`);
  expect(article).toContain(`−${german(-Number(current.Negativmittel_EUR_MWh), 2)} statt`);
});

test.each([
  ['annual.js', 'annual.csv', 'Zeitraum', ['Negative_Stunden']],
  ['quarters.js', 'quarterly.csv', 'Zeitraum', ['Negative_Stunden']],
  ['midday.js', 'midday.csv', 'Stunde', ['Anteil_2024_Prozent', 'Anteil_2025_Prozent', 'Anteil_2026_Prozent']],
  ['batteries.js', 'battery.csv', 'Jahr', ['Energie_GWh']],
])('%s: generated data match CSV', (script, file, x, keys) => {
  const code = fs.readFileSync(path.join(root, 'js/charts/negative_strompreise', script), 'utf8');
  const xData = JSON.parse(code.match(/const xData = (\[[^\n]+\]);/)[1]);
  const series = JSON.parse(code.match(/const seriesData = (\[[^\n]+\]);/)[1]);
  const rows = table(file);
  expect(xData.map(String)).toEqual(rows.map((row) => row[x]));
  expect(series).toHaveLength(keys.length);
  keys.forEach((key, i) => expect(series[i].data).toEqual(rows.map((row) => Number(row[key]))));
});
