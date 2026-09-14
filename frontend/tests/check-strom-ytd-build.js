// Run after npm run build: exercise the actual Eleventy/Liquid/Markdown output.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { comparisonEmbed } = require('../src/data_ingestion/builders/comparisonEmbed');
const output = path.resolve(__dirname, '../_site');
const route = '/posts/2026/strom-2026-ytd-zahlen/';
const html = fs.readFileSync(path.join(output, route, 'index.html'), 'utf8');
const document = new JSDOM(html).window.document;
const expected = new JSDOM(comparisonEmbed('strom_ytd_2026', 'strom-ytd-2026-comparison')).window.document.querySelector('dl');

function checkContent(document) {
  assert.equal(document.querySelector('.comparison-chart').outerHTML, expected.outerHTML);
  assert.equal(document.querySelectorAll('.comparison-chart').length, 1);
  const method = document.querySelector('details.post-methodology');
  assert.equal(method.hasAttribute('open'), false);
  assert.equal(method.firstElementChild.tagName, 'SUMMARY');
  assert.equal(method.firstElementChild.textContent, 'Methodik und Datenquellen');
  assert.equal(method.querySelectorAll('h3').length, 2);
  assert.equal(method.querySelectorAll('ul li ul li').length, 2);
  assert.ok(method.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]'));
  assert.doesNotMatch(method.textContent, /\*\*|###|\]\(https:/);
  assert.equal(document.querySelectorAll('table').length, 2);
  for (const table of document.querySelectorAll('table')) assert.equal(table.closest('details').open, false);
}

checkContent(document);
assert.ok(document.querySelector('.comparison-section .chart-sources a'));
assert.doesNotMatch(html, /{% comparisonChart/);
assert.equal(document.querySelectorAll('h1').length, 1);
const script = document.querySelector('#strom-ytd-2026-comparison + script').getAttribute('src');
assert.equal(script, '/js/charts/strom_ytd_2026/comparison.js');
assert.ok(fs.existsSync(path.join(output, script)));
const feed = JSON.parse(fs.readFileSync(path.join(output, 'feed.json'), 'utf8'));
const item = feed.items.find((item) => new URL(item.url).pathname === route);
assert.ok(item);
checkContent(new JSDOM(item.content_html).window.document);
console.log(`Built HTML and feed verified: ${route}`);
