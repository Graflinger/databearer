/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const markdown = require('markdown-it')({ html: true });
const sass = require('sass');
const { JSDOM } = require('jsdom');
const { comparisonEmbed } = require('../src/data_ingestion/builders/comparisonEmbed');

const root = path.resolve(__dirname, '..');
const article = matter(fs.readFileSync(path.join(root, 'src/posts/2026/strom-2026-ytd-zahlen.md'), 'utf8')).content;

test('methodology renders closed with a native summary, real headings, nested lists and links', () => {
  const document = new JSDOM().window.document;
  const expanded = article.replace(/{% comparisonChart "([\w-]+)", "([\w-]+)" %}/g, (_, config, id) => comparisonEmbed(config, id));
  document.body.innerHTML = markdown.render(expanded);
  const methodology = document.querySelector('details.post-methodology');
  expect(methodology.open).toBe(false);
  expect(methodology.hasAttribute('open')).toBe(false);
  expect(methodology.firstElementChild.tagName).toBe('SUMMARY');
  expect(methodology.firstElementChild.textContent).toBe('Methodik und Datenquellen');
  expect(methodology.querySelectorAll('h3')).toHaveLength(2);
  expect(methodology.querySelectorAll('ul li ul li')).toHaveLength(2);
  expect(methodology.querySelector('li strong').textContent).toBe('Zeiträume:');
  expect(methodology.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]')).not.toBeNull();
  expect(methodology.textContent).not.toMatch(/\*\*|###|\]\(https:/);
  expect(document.querySelectorAll('table')).toHaveLength(2);
  for (const table of document.querySelectorAll('table')) {
    expect(table.closest('details').open).toBe(false);
    expect(table.querySelectorAll('th').length).toBeGreaterThan(0);
  }
  expect(document.querySelector('.comparison-chart').closest('details')).toBeNull();
  expect(document.querySelector('.comparison-section .chart-sources a')).not.toBeNull();
  for (const caveat of ['kein Maß für den kommerziellen Stromhandel', 'nicht auf den Bruttostromverbrauch', 'lässt sich aus den Tagesaggregaten nicht bestimmen', 'Börsenpreis ist kein Haushaltstarif']) {
    expect([...document.querySelectorAll('p')].some((p) => !p.closest('details') && p.textContent.includes(caveat))).toBe(true);
  }
});

test('compiled disclosure CSS preserves native focus styling, theme borders and nested list spacing', () => {
  const css = sass.compile(path.join(root, 'src/scss/style.scss')).css;
  const dark = css.slice(css.indexOf('/* Dark Mode */'));
  expect(dark).toMatch(/@media \(prefers-color-scheme: dark\)/);
  expect(dark).toMatch(/\.post-content \{[^}]*--post-border: #404040;/);
  expect(css).toMatch(/\.post-content \.post-methodology > summary:focus-visible[^}]*outline: 2px solid currentColor/);
  expect(css).toMatch(/\.post-content \.post-methodology\[open\] > summary[^}]*margin-bottom/);
  expect(css).toContain('.post-content li ul,\n.post-content li ol');
});
