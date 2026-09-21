const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const nunjucks = require('nunjucks');
const seo = require('../src/seo');
const site = require('../src/_data/site');
const computed = require('../src/posts/posts.11tydata').eleventyComputed;

describe('SEO policy and metadata', () => {
  test('draft policy is explicit and preserves ordinary permalinks and exclusions', () => {
    expect(computed.permalink({ draft: true, permalink: '/preview/' })).toBe(false);
    expect(computed.eleventyExcludeFromCollections({ draft: true })).toBe(true);
    expect(computed.permalink({ draft: false, permalink: '/public/' })).toBe('/public/');
    expect(computed.permalink({})).toBeUndefined();
    expect(computed.eleventyExcludeFromCollections({ eleventyExcludeFromCollections: true })).toBe(true);
    expect(computed.permalink({ draft: 'true', permalink: '/public/' })).toBe('/public/');
  });

  test('script-safe objects preserve punctuation without markup injection', () => {
    const title = '"Quotes" & <tags> </script><script>alert(1)</script> \\ line\n\u2028\u2029';
    const data = seo.metadata({ site, page: { url: '/posts/test/' }, isPost: true, title, topic: ['energie'], date: '2026-01-01' });
    const encoded = seo.scriptJSON(data.structuredData);
    expect(encoded).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(encoded)[0].headline).toBe(title);
    expect(data.structuredData[0].author.url).toBe(`${site.url}/about/`);
    expect(data.structuredData[1].itemListElement[1].item).toBe(`${site.url}/themen/energie/`);
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../src/_includes')), { autoescape: true });
    env.addFilter('seoMetadata', seo.metadata);
    env.addFilter('scriptJSON', seo.scriptJSON);
    env.addFilter('htmlDateString', seo.isoDate);
    env.addFilter('socialImage', require('../lib/responsive-images').socialImage);
    const imageMetadata = { defaultSocial: { url: '/assets/images/default.jpg', width: 1200, height: 630, type: 'image/jpeg' } };
    const html = env.render('base.njk', { site, title, page: { url: '/posts/test/' }, isPost: true, helpers: {}, imageMetadata });
    document.documentElement.innerHTML = html;
    expect(document.querySelector('title').textContent).toBe(title);
    expect(document.querySelector('meta[property="og:title"]').content).toBe(title);
    const entities = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent));
    expect(entities[0].headline).toBe(title);
    expect(document.querySelector('nav.topics-nav .topics-menu')).not.toBeNull();
    expect(html).not.toContain('<script>alert(1)');
  });

  test('page identity is not inferred from incidental dates', () => {
    const meta = (data) => seo.metadata({ site, page: { url: '/static/' }, title: 'Page', ...data });
    expect(meta({ date: '2026-01-01' }).structuredData[0]['@type']).toBe('WebPage');
    expect(meta({ page: { url: '/about/' } }).structuredData[0]['@type']).toBe('AboutPage');
    expect(meta({ isTopicPage: true, pagination: { pageNumber: 1 } }).title).toBe('Page – Seite 2');
    expect(meta({ page: { url: '/' } }).structuredData.some((entity) => entity['@type'] === 'BreadcrumbList')).toBe(false);
    for (const url of ['/404.html', '/suche/']) expect(meta({ page: { url } }).noindex).toBe(true);
  });

  test('sitemap admits only intended public HTML', () => {
    for (const url of [false, '/feed.json', '/robots.txt', '/sitemap.xml', '/data/file.json', '/404.html', '/suche/']) {
      expect(seo.indexable({ url, data: {} })).toBe(false);
    }
    for (const flag of ['draft', 'noindex', 'excludeFromSitemap', 'eleventyExcludeFromCollections']) {
      expect(seo.indexable({ url: '/page/', data: { [flag]: true } })).toBe(false);
    }
    expect(seo.indexable({ url: '/page/', data: {} })).toBe(true);
  });

  test('related ordering uses shared topic count, date, URL without mutating collections', () => {
    const post = (url, topic, date = '2026-01-01', extra = {}) => ({ url, data: { topic, date, ...extra } });
    const posts = [post('/z/', ['energie']), post('/b/', ['energie']), post('/a/', ['energie']),
      post('/both/', ['energie', 'wirtschaft'], '2025-01-01'), post('/new/', ['energie'], '2026-09-01'),
      post('/self/', ['energie']), post('/draft/', ['energie', 'wirtschaft'], '2026-09-20', { draft: true })];
    const urls = posts.map((item) => item.url);
    for (const input of [posts, [...posts].reverse()]) {
      expect(seo.relatedPosts({ post: input }, { url: '/self/' }, ['energie', 'wirtschaft']).map((item) => item.url))
        .toEqual(['/both/', '/new/', '/a/', '/b/']);
    }
    expect(posts.map((item) => item.url)).toEqual(urls);
  });
});

describe('focused generated SEO output', () => {
  let workspace;
  const read = (name) => fs.readFileSync(path.join(workspace, '_site', name), 'utf8');
  const xml = (name) => new DOMParser().parseFromString(read(name), 'application/xml');
  beforeAll(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'databearer-seo-'));
    execFileSync(process.execPath, [path.join(__dirname, 'fixtures/seo-build.cjs'), workspace], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  }, 30000);
  afterAll(() => { if (workspace) fs.rmSync(workspace, { recursive: true, force: true }); });

  test('republishing as a draft removes old HTML and every discovery reference', () => {
    expect(fs.existsSync(path.join(workspace, '_site/draft-preview/index.html'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, '_site/2/index.html'))).toBe(false);
    expect(read('preserved.json')).toBe('{"keep":true}');
    for (const file of ['index.html', 'feed.json', 'feed.xml', 'search.json', 'sitemap.xml']) {
      expect(read(file)).not.toMatch(/draft-preview|Secret draft/);
    }
  });

  test('search includes every published fixture article with an implicit permalink', () => {
    const feed = JSON.parse(read('feed.json'));
    const search = JSON.parse(read('search.json'));
    expect(feed.items).toHaveLength(2);
    for (const name of ['older', 'newer']) {
      const source = fs.readFileSync(path.join(workspace, 'src/posts', `${name}.md`), 'utf8');
      expect(source).not.toMatch(/^permalink:/m);
      expect(fs.existsSync(path.join(workspace, '_site/posts', name, 'index.html'))).toBe(true);
    }
    expect(search.map((item) => new URL(item.url, site.url).href).sort())
      .toEqual(feed.items.map((item) => item.url).sort());
  });

  test('feeds preserve JSON fields, make content URLs absolute and use the maximum modification date', () => {
    const json = JSON.parse(read('feed.json'));
    expect(json.items).toHaveLength(2);
    const older = json.items.find((item) => item.title === 'Older');
    expect(json.items.find((item) => item.title.startsWith('Newer'))).toMatchObject({
      title: 'Newer & "quoted"', image: 'https://images.example.org/photo.png', _image_alt: 'Bildbeschreibung',
    });
    for (const key of ['id', 'url', 'title', 'summary', 'date_published', 'date_modified', 'tags', 'content_html']) expect(older).toHaveProperty(key);
    expect(older.content_html).toContain(`href="${site.url}/posts/newer/?mode=full#chart"`);
    expect(older.content_html).toContain(`src="${site.url}/images/test.png"`);
    expect(older.content_html).toContain(`href="${site.url}/posts/older/#local"`);
    const atom = xml('feed.xml');
    expect(atom.querySelector('parsererror')).toBeNull();
    expect([...atom.querySelectorAll('entry title')].map((entry) => entry.textContent)).toContain('Newer & "quoted"');
    expect(atom.documentElement.querySelector('updated').textContent).toBe('2026-09-20T00:00:00.000Z');
    const content = [...atom.querySelectorAll('entry')].find((entry) => entry.querySelector('title').textContent === 'Older').querySelector('content').textContent;
    expect(content).toContain(`href="${site.url}/posts/newer/?mode=full#chart"`);
    expect(content).toContain(`src="${site.url}/images/test.png"`);
  });

  test('sitemap omits non-HTML and filesystem dates, robots uses the site origin', () => {
    const sitemap = xml('sitemap.xml');
    expect(sitemap.querySelector('parsererror')).toBeNull();
    const urls = [...sitemap.querySelectorAll('url')];
    const about = urls.find((item) => item.querySelector('loc').textContent === `${site.url}/about/`);
    expect(about).toBeDefined();
    expect(about.querySelector('lastmod')).toBeNull();
    expect(read('sitemap.xml')).not.toMatch(/example.json|suche|404.html|feed.json|robots.txt/);
    expect(urls.find((item) => item.querySelector('loc').textContent.endsWith('/posts/older/')).querySelector('lastmod').textContent).toBe('2026-09-20T00:00:00.000Z');
    expect(read('robots.txt')).toContain(`Sitemap: ${site.url}/sitemap.xml`);
  });

  test('archives have unique canonical metadata and utility pages are noindex', () => {
    for (const [name, title] of [['index.html', 'Archive'], ['1/index.html', 'Archive – Seite 2']]) {
      document.documentElement.innerHTML = read(name);
      expect(document.title).toBe(title);
      expect(document.querySelector('meta[property="og:title"]').content).toBe(title);
      expect(document.querySelector('link[type="application/feed+json"]').href).toBe(`${site.url}/feed.json`);
      const canonical = document.querySelector('link[rel="canonical"]').href;
      expect(canonical).toBe(`${site.url}/${name === 'index.html' ? '' : '1/'}`);
    }
    for (const name of ['404.html', 'suche/index.html']) {
      document.documentElement.innerHTML = read(name);
      expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
    }
    expect(read('404.html')).not.toContain('/themen/alle_posts');
  });

  test('HTML cleanup rejects source overlap and resolves safe output aliases canonically', () => {
    expect(() => seo.htmlOutputSnapshot(workspace, path.join(workspace, 'src'))).toThrow(/Refusing/);
    const link = path.join(workspace, 'linked-output');
    fs.symlinkSync(path.join(workspace, '_site'), link);
    // An alias to the same approved canonical output is safe; an alias into
    // source is not (covered by the ancestor-symlink regression below).
    expect(seo.htmlOutputSnapshot(link, path.join(workspace, 'src')).root)
      .toBe(fs.realpathSync(path.join(workspace, '_site')));
    expect(read('preserved.json')).toBe('{"keep":true}');
  });
});

test('robots follows canonical origin changes and build cleanup requires a complete filesystem build', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/robots.njk'), 'utf8').replace(/^---[\s\S]*?---\s*/, '');
  expect(nunjucks.renderString(source, { site: { url: 'https://canonical.example' } }))
    .toContain('Sitemap: https://canonical.example/sitemap.xml');
  let before;
  seo.configure({ ignores: new Set(), addFilter() {}, addAsyncFilter() {}, on(event, callback) { if (event === 'eleventy.before') before = callback; } });
  expect(() => before({ runMode: 'build', outputMode: 'fs', incremental: true })).toThrow(/full build/);
  expect(() => before({ runMode: 'build', outputMode: 'json', incremental: true })).not.toThrow();
  expect(() => before({ runMode: 'serve', outputMode: 'fs', incremental: true })).not.toThrow();
});

describe('scoped post-write cleanup lifecycle', () => {
  let workspace, input, output;
  const runner = path.join(__dirname, 'fixtures/seo-cleanup.cjs');
  const cli = path.join(__dirname, '../node_modules/@11ty/eleventy/cmd.cjs');
  const write = (filename, text) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, text);
  };
  const run = (args) => execFileSync(process.execPath, args, { cwd: workspace, encoding: 'utf8', stdio: 'pipe' });
  const contents = () => Object.fromEntries(fs.readdirSync(output).map((name) => [name, fs.readFileSync(path.join(output, name), 'utf8')]));
  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-cleanup-'));
    input = path.join(workspace, 'src');
    output = path.join(workspace, '_site');
    write(path.join(input, 'index.njk'), 'New home');
    write(path.join(input, 'draft.njk'), '---\ndraft: true\npermalink: /draft.html\n---\nHidden');
    write(path.join(output, seo.OUTPUT_MARKER), seo.OUTPUT_MARKER_CONTENT);
    write(path.join(output, 'index.html'), 'Last good home');
    write(path.join(output, 'draft.html'), 'Legacy draft before cleanup policy');
    write(path.join(output, 'data.json'), '{"preserve":true}');
  });
  afterEach(() => fs.rmSync(workspace, { recursive: true, force: true }));

  test.each(['programmatic', 'cli'])('%s dry-run leaves every output byte unchanged', (mode) => {
    const before = contents();
    const stats = () => fs.readdirSync(output).map((name) => {
      const stat = fs.statSync(path.join(output, name));
      return [name, stat.ino, stat.mtimeMs, stat.ctimeMs];
    });
    const beforeStats = stats();
    run(mode === 'cli' ? [cli, '--config', runner, '--dryrun', '--quiet'] : [runner, 'dryrun']);
    expect(contents()).toEqual(before);
    expect(stats()).toEqual(beforeStats);
  });

  test('a no-write build preserves the old output instead of treating empty results as deletion authority', () => {
    write(path.join(input, 'index.njk'), '---\npermalink: false\n---\nNo output');
    const before = contents();
    run([runner, 'build']);
    expect(contents()).toEqual(before);
  });

  test('successful writes remove legacy stale HTML and preserve current output/data/marker', () => {
    run([runner, 'build']);
    expect(contents()).toEqual({
      [seo.OUTPUT_MARKER]: seo.OUTPUT_MARKER_CONTENT,
      'index.html': 'New home', 'data.json': '{"preserve":true}',
    });
  });

  test('render failure never runs stale cleanup', () => {
    write(path.join(input, 'broken.njk'), '{{ missing | nonexistentFilter }}');
    expect(() => run([runner, 'build'])).toThrow();
    expect(fs.readFileSync(path.join(output, 'draft.html'), 'utf8')).toBe('Legacy draft before cleanup policy');
    expect(fs.readFileSync(path.join(output, seo.OUTPUT_MARKER), 'utf8')).toBe(seo.OUTPUT_MARKER_CONTENT);
  });

  test('ancestor symlink into source is rejected before any write or cleanup', () => {
    write(path.join(input, 'precious.html'), 'Source must survive');
    fs.symlinkSync(workspace, path.join(workspace, 'link'));
    // Reviewer reproduction: link/src lexically looks separate from real src.
    const aliasedSource = path.join(workspace, 'link/src');
    expect(() => seo.htmlOutputSnapshot(aliasedSource, input)).toThrow(/approved canonical/);
    expect(() => run([runner, 'build', aliasedSource])).toThrow();
    expect(fs.readFileSync(path.join(input, 'precious.html'), 'utf8')).toBe('Source must survive');
    expect(fs.existsSync(path.join(input, 'index.html'))).toBe(false);
  });

  test('arbitrary output and unmarked custom _site are rejected without modification', () => {
    const arbitrary = path.join(workspace, 'unrelated');
    write(path.join(arbitrary, 'precious.html'), 'Unrelated HTML');
    write(path.join(arbitrary, seo.OUTPUT_MARKER), seo.OUTPUT_MARKER_CONTENT);
    expect(() => run([runner, 'build', arbitrary])).toThrow();
    expect(fs.readFileSync(path.join(arbitrary, 'precious.html'), 'utf8')).toBe('Unrelated HTML');
    fs.unlinkSync(path.join(output, seo.OUTPUT_MARKER));
    const before = contents();
    expect(() => run([runner, 'build'])).toThrow();
    expect(contents()).toEqual(before);
  });

  test('output redirected through an ancestor symlink to an unrelated tree is rejected', () => {
    const elsewhere = path.join(workspace, 'elsewhere');
    write(path.join(elsewhere, '_site/precious.html'), 'Outside');
    write(path.join(elsewhere, '_site', seo.OUTPUT_MARKER), seo.OUTPUT_MARKER_CONTENT);
    fs.symlinkSync(elsewhere, path.join(workspace, 'link'));
    expect(() => seo.htmlOutputSnapshot(path.join(workspace, 'link/_site'), input)).toThrow(/approved canonical/);
    expect(fs.readFileSync(path.join(elsewhere, '_site/precious.html'), 'utf8')).toBe('Outside');
  });

  test('symlinked ownership markers and output-tree links cannot authorize cleanup', () => {
    const marker = path.join(output, seo.OUTPUT_MARKER);
    fs.unlinkSync(marker);
    write(path.join(workspace, 'marker'), seo.OUTPUT_MARKER_CONTENT);
    fs.symlinkSync(path.join(workspace, 'marker'), marker);
    expect(() => seo.htmlOutputSnapshot(output, input)).toThrow(/unowned/);
    fs.unlinkSync(marker);
    write(marker, seo.OUTPUT_MARKER_CONTENT);
    fs.symlinkSync(input, path.join(output, 'linked-source'));
    expect(() => seo.htmlOutputSnapshot(output, input)).toThrow(/output-tree symlink/);
    expect(fs.readFileSync(path.join(output, 'draft.html'), 'utf8')).toBe('Legacy draft before cleanup policy');
  });

  test('post-snapshot symlink substitution cannot delete source HTML', () => {
    write(path.join(output, 'nested/precious.html'), 'Old');
    write(path.join(input, 'precious.html'), 'Source');
    const snapshot = seo.htmlOutputSnapshot(output, input);
    fs.rmSync(path.join(output, 'nested'), { recursive: true });
    fs.symlinkSync(input, path.join(output, 'nested'));
    expect(() => seo.cleanHtmlOutput(output, input, snapshot, [{ outputPath: path.join(output, 'index.html') }]))
      .toThrow(/symlink changed/);
    expect(fs.readFileSync(path.join(input, 'precious.html'), 'utf8')).toBe('Source');
    expect(fs.existsSync(path.join(output, 'draft.html'))).toBe(true);
  });
});
