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

function render() {
  const document = new JSDOM().window.document;
  const expanded = article.replace(/{% comparisonChart "([\w-]+)", "([\w-]+)" %}/g, (_, config, id) => comparisonEmbed(config, id));
  document.body.innerHTML = markdown.render(expanded);
  return document;
}

test('backup tables render closed with native summaries and table notes; data notes stay short and visible', () => {
  const document = render();
  expect(document.querySelectorAll('details.post-methodology')).toHaveLength(0);
  const disclosures = [...document.querySelectorAll('details.post-data-details')];
  expect(disclosures).toHaveLength(2);
  for (const details of disclosures) {
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.firstElementChild.tagName).toBe('SUMMARY');
    expect(details.querySelectorAll('table th').length).toBeGreaterThan(0);
    expect(details.querySelector('table + p.table-note a[href="https://www.smard.de/home/marktdaten"]')).not.toBeNull();
    expect(details.textContent).not.toMatch(/\*\*|###|\]\(https:/);
  }
  expect(document.querySelectorAll('table')).toHaveLength(2);
  expect(document.querySelector('.comparison-chart').closest('details')).toBeNull();
  expect(document.querySelector('.comparison-section .chart-sources a')).not.toBeNull();

  const headings = [...document.querySelectorAll('h2')];
  const data = headings.at(-1);
  expect(data.textContent).toBe('Daten und Quellen');
  const notes = [];
  for (let node = data.nextElementSibling; node; node = node.nextElementSibling) notes.push(node);
  expect(notes.filter((node) => node.tagName === 'P')).toHaveLength(1);
  expect(notes.some((node) => node.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]'))).toBe(true);

  for (const caveat of ['kein Maß für den Stromhandel', 'nicht auf den Bruttostromverbrauch', 'lässt sich aus den Tagesdaten nicht bestimmen', 'Börsenpreis ist kein Haushaltstarif', 'lässt sich aus diesen Daten nicht ablesen']) {
    expect([...document.querySelectorAll('p')].some((p) => !p.closest('details') && p.textContent.includes(caveat))).toBe(true);
  }
});

test('one-author voice and no pipeline detail in the article text', () => {
  const text = render().body.textContent;
  expect(text).not.toMatch(/\b(wir|uns|unser\w*)\b/i);
  expect(text).not.toMatch(/[a-f0-9]{40}|\.csv|\.json|eingefroren|Prüfsumme|Datenpaket/i);
});

test('compiled disclosure CSS preserves native focus styling, theme borders and nested list spacing', () => {
  const css = sass.compile(path.join(root, 'src/scss/style.scss')).css;
  const dark = css.slice(css.indexOf('/* Dark Mode */'));
  expect(dark).toMatch(/@media \(prefers-color-scheme: dark\)/);
  expect(dark).toMatch(/\.post-content \{[^}]*--table-line: #404040;/);
  expect(css).toMatch(/\.post-content \.post-data-details > summary:focus-visible[^}]*outline: 2px solid currentColor/);
  expect(css).toMatch(/\.post-content \.post-data-details\[open\] > summary[^}]*margin-bottom/);
  expect(css).toContain('.post-content li ul,\n.post-content li ol');
});
