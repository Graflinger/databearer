/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { parse } = require('csv-parse/sync');
const configs = require('../src/data_ingestion/charts/waermepumpen');

const root = path.resolve(__dirname, '../src');
const source = fs.readFileSync(path.join(root, 'posts/2026/waermepumpen-neubau-absatz.md'), 'utf8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)[1];
const number = (text) => Number(text.replace(/\./g, '').replace(',', '.'));

beforeEach(() => {
  document.body.innerHTML = new MarkdownIt({ html: true }).render(source.replace(/^---\n[\s\S]*?\n---\n/, ''));
});

test('draft, topics and intentional lack of an invented card image', () => {
  expect(frontmatter).toMatch(/^draft: true$/m);
  expect(frontmatter).toMatch(/^topic: \["energie", "politik-und-gesellschaft"\]$/m);
  expect(frontmatter).not.toMatch(/^image:/m);
  expect(document.querySelector('h1')).toBeNull();
  expect([...document.querySelectorAll('h2')].at(-1).textContent).toBe('Daten und Quellen');
});

test('every table cell matches its frozen chart input and generated script', () => {
  expect(configs).toHaveLength(2);
  expect(document.querySelectorAll('table')).toHaveLength(2);
  for (const config of configs) {
    expect(config.dataFile).toMatch(/^2026\/waermepumpen\/[^/]+\.csv$/);
    const records = parse(fs.readFileSync(path.join(root, 'data_ingestion/data', config.dataFile)), { columns: true });
    const generated = fs.readFileSync(path.join(root, 'js/charts/waermepumpen', config.outputFile), 'utf8');
    const x = JSON.parse(generated.match(/const xData = (\[[^\n]+\]);/)[1]);
    const series = JSON.parse(generated.match(/const seriesData = (\[[^\n]+\]);/)[1]);
    const table = document.getElementById(`${config.containerId}-table`);
    expect(table.querySelector('caption').textContent).toMatch(/Ausgewählte/);
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(6);
    for (const row of rows) {
      const year = row.querySelector('th[scope="row"]').textContent;
      const record = records.find((item) => String(item[config.xKey]) === year);
      expect(record).toBeDefined();
      const cells = [...row.querySelectorAll('td')];
      expect(cells).toHaveLength(config.seriesKeys.length);
      cells.forEach((cell, index) => {
        const expected = Number(record[config.seriesKeys[index]]);
        expect(number(cell.textContent)).toBe(expected);
        expect(series[index].data[x.findIndex((value) => String(value) === year)]).toBe(expected);
      });
    }
    const section = table.closest('.chart-section');
    expect(section.querySelector('.chart-sources a[href="https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html"]')).not.toBeNull();
    expect(section.textContent).toContain('eigene');
    expect(section.textContent).toContain('5. November 2026');
  }
});

test('scope and approximations stay explicit; unlicensed sources stay out', () => {
  const text = document.body.textContent;
  expect(text).toContain('Gebäude, nicht Wohnungen');
  expect(text).toContain('Näherungen, nicht um exakte Fallzahlen oder verkaufte Geräte');
  expect(text).toContain('den Austausch alter Heizungen in bestehenden Häusern bildet sie nicht ab');
  expect(text).toContain('verfügbarer Haushaltsmittel');
  expect(text).toContain('Rechtsanspruch');
  // Industry sales figures have no redistribution licence and must stay out.
  expect(source).not.toMatch(/waermepumpe\.de|bdh-industrie|\bBWP\b|\bBDH\b/);
  expect(document.querySelectorAll('img')).toHaveLength(0);
  expect(document.querySelectorAll('iframe')).toHaveLength(0);
  expect(text).not.toMatch(/\b(wir|unser\w*)\b/i);
});

test('internal contextual links resolve without changing the existing articles', () => {
  for (const link of document.querySelectorAll('a[href^="/posts/"]')) {
    const route = link.getAttribute('href');
    expect(route.endsWith('/')).toBe(true);
    expect(fs.existsSync(path.join(root, `${route.slice(1, -1)}.md`))).toBe(true);
    expect(link.textContent).not.toBe('hier');
  }
});
