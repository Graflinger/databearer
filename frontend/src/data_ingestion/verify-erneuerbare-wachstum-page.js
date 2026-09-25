const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { validateErneuerbareWachstum } = require('./utils/erneuerbareWachstumValidation');

const root = path.resolve(__dirname, '../..');
const site = path.join(root, '_site');
const route = '/posts/2026/solar-boomt-wind-waechst/';
const post = fs.readFileSync(path.join(root, 'src/posts/2026/solar-boomt-wind-waechst.md'), 'utf8');
const html = fs.readFileSync(path.join(site, route, 'index.html'), 'utf8');
const doc = new JSDOM(html).window.document;
const article = doc.querySelector('article');
assert(article, 'Rendered article missing');
assert.strictEqual(doc.querySelectorAll('h1').length, 1);
assert.strictEqual(article.querySelectorAll('table').length, 1);
const { tables } = validateErneuerbareWachstum();
const cells = [...article.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim()));
const keys = ['capacity_2020_gw', 'capacity_2025_gw', 'change_2025_gw', 'generation_2024_twh', 'generation_2025_twh'];
keys.forEach((key, i) => assert.deepStrictEqual(cells[i].slice(1), tables['summary.csv'].map((row) => `${i === 2 ? '+' : ''}${row[key].toFixed(1).replace('.', ',')}`)));
for (const node of article.querySelectorAll('a[href^="/"], script[src^="/"], img[src^="/"]')) {
  const url = node.getAttribute('href') || node.getAttribute('src');
  assert(fs.existsSync(path.join(site, url.endsWith('/') ? `${url}index.html` : url)), `Broken local URL: ${url}`);
}
const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
assert.strictEqual(new Set(ids).size, ids.length, 'Duplicate IDs');
for (const config of require('./charts/erneuerbare_wachstum')) {
  const code = fs.readFileSync(path.join(site, 'js/charts/erneuerbare_wachstum', config.outputFile), 'utf8');
  assert(code.includes(config.containerId) && code.includes('smooth: false'), 'Chart output drift');
  for (const key of config.seriesKeys) assert(code.includes(`"key":"${key}"`), 'Missing series');
  assert(code.includes(`name: "${config.yAxisLabel}"`), 'Wrong unit');
  assert(!/fetch\(|XMLHttpRequest/.test(code), 'Unexpected runtime data request');
}
for (const filename of ['feed.json', 'feed.xml', 'search.json', 'sitemap.xml', 'themen/energie/index.html']) {
  assert(fs.readFileSync(path.join(site, filename), 'utf8').includes(route), `Route absent: ${filename}`);
}
assert(!fs.existsSync(path.join(site, 'data_ingestion')), 'Ingestion sources leaked');
assert(!fs.existsSync(path.join(site, 'data/2026/erneuerbare_wachstum')), 'Frozen inputs accidentally published');
const body = post.split('---\n').slice(2).join('---\n').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const words = body.split(/\s+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
assert(words >= 600 && words <= 850, `Article length: ${words}`);
const excerpt = post.match(/^excerpt: "(.+)"$/m)[1];
assert(excerpt.length >= 140 && excerpt.length <= 160, `Excerpt length: ${excerpt.length}`);
console.log(`Verified ${route}: ${words} words, ${excerpt.length}-character excerpt; static table, charts, links and discovery routes valid.`);
