// A tiny real Eleventy build: no charts, dashboard ingestion, or repository output.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const seo = require('../../src/seo');
const root = path.resolve(__dirname, '../..');
const workspace = process.argv[2];
const input = path.join(workspace, 'src');
const output = path.join(workspace, '_site');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, seo.OUTPUT_MARKER), seo.OUTPUT_MARKER_CONTENT);
process.chdir(workspace);
const write = (name, content) => {
  const file = path.join(input, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const copy = (name) => write(name, fs.readFileSync(path.join(root, 'src', name)));
for (const name of ['_data/site.js', '_includes/base.njk',
  'posts/posts.11tydata.js', 'feed.njk', 'feed.json.njk', 'sitemap.njk', 'robots.njk', 'search.json.njk', '404.md', 'images/logo_big.png']) copy(name);
write('_includes/post.njk', '---\nlayout: base.njk\n---\n{{ content | safe }}');
write('index.njk', '---\nlayout: base.njk\ntitle: Archive\npagination:\n  data: collections.post\n  size: 1\n---\nArchive');
write('suche.njk', '---\nlayout: base.njk\ntitle: Suche\nnoindex: true\n---\nSuche');
write('about.md', '---\nlayout: base.njk\ntitle: Über mich\n---\nAbout');
write('data.njk', '---\npermalink: /data/example.json\n---\n{}');
write('posts/older.md', '---\ntitle: Older\ndate: 2025-01-01\nlastUpdated: 2026-09-20\ntopic: [energie]\n---\n<a href="../newer/?mode=full#chart">More</a><img src="/images/test.png"><a href="#local">Local</a><p>CDATA ]]&gt;</p>');
write('posts/newer.md', '---\ntitle: \'Newer & "quoted"\'\ndate: 2026-01-01\ntopic: [wirtschaft]\nimage: https://images.example.org/photo.png\nsocialImage: /images/logo_big.png\nimageText: Bildbeschreibung\n---\nNewer');
const draft = '---\ntitle: Secret draft\ndate: 2026-09-01\npermalink: /draft-preview/\nDRAFT_FLAG\n---\nSecret';

async function build() {
  const { default: Eleventy, HtmlBasePlugin } = await import('@11ty/eleventy');
  const eleventy = new Eleventy('src', '_site', { configPath: false, quietMode: true, config(config) {
    require('../../lib/responsive-images').register(config);
    seo.configure(config);
    config.addPlugin(HtmlBasePlugin);
    config.addFilter('htmlDateString', seo.isoDate);
    config.addGlobalData('helpers', { year: 2026 });
    config.addCollection('post', (api) => api.getFilteredByTag('post').filter(seo.published));
    return { dir: { input: 'src', output: '_site' } };
  } });
  await eleventy.write();
}

(async () => {
  if (process.argv[3] === 'draft') {
    write('posts/draft.md', draft.replace('DRAFT_FLAG', 'draft: true'));
    await build();
    return;
  }
  write('posts/draft.md', draft.replace('DRAFT_FLAG', 'draft: false'));
  await build();
  if (!fs.existsSync(path.join(output, 'draft-preview/index.html'))) throw new Error('Published fixture missing');
  fs.writeFileSync(path.join(output, 'preserved.json'), '{"keep":true}');
  execFileSync(process.execPath, [__filename, workspace, 'draft'], { stdio: 'inherit' });
})().catch((error) => { console.error(error); process.exitCode = 1; });
