const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../_site');
const route = '/posts/2026/stromimporte-exporte-deutschland/';
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const document = new JSDOM(read(`${route}index.html`)).window.document;
assert.equal(document.querySelectorAll('h1').length, 1);
assert.equal(document.querySelectorAll('table tbody tr').length, 7);
for (const name of ['importe_exporte', 'nettoexport']) {
  const asset = `/js/charts/stromhandel_jahre/${name}.js`;
  assert(document.querySelector(`script[src="${asset}"]`));
  assert.equal(read(asset), fs.readFileSync(path.resolve(__dirname, `../src${asset}`), 'utf8'));
}
assert(read('sitemap.xml').includes(route));
assert(read('search.json').includes(route));
assert(read('themen/energie/index.html').includes(route));
assert(read('themen/wirtschaft/index.html').includes(route));
const item = JSON.parse(read('feed.json')).items.find((entry) => entry.url.endsWith(route));
assert(item);
assert(item.date_published.startsWith('2026-09-11'));
assert(item.date_modified.startsWith('2026-09-14'));
const content = new JSDOM(item.content_html).window.document.body;
assert.equal(content.lastElementChild.lastElementChild.getAttribute('href'), '/dashboards/strom/');
assert(!fs.existsSync(path.join(root, 'data_ingestion')));
console.log(`Stromhandel build verified: ${route}, seven table rows, chart assets, feeds, search, topics and sitemap.`);
