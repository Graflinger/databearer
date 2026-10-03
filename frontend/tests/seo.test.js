const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const nunjucks = require('nunjucks');
const matter = require('gray-matter');
const sharp = require('sharp');
const seo = require('../src/seo');
const site = require('../src/_data/site');

// Jest cannot load Eleventy's ESM entry that .eleventy.js requires; the draft
// policy is captured from the real production config with a recording config.
jest.mock('@11ty/eleventy', () => ({ HtmlBasePlugin() {} }));
const { productionPreprocessors } = require('./fixtures/seo-cleanup.cjs');

const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js');window.addEventListener('load',function(){if(!document.documentElement.classList.contains('nav-enhanced'))document.documentElement.classList.remove('js');});";
const BRAND = { url: '/assets/images/social-default-0123456789abcdef-1200.jpg', width: 1200, height: 630, type: 'image/jpeg', alt: 'Databearer-Logo' };
const sourceFile = (name) => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const parse = (text) => new DOMParser().parseFromString(text, 'text/html');

// Render the real base layout with a mock of the async `socialImageMeta` filter
// contract: { url, width, height, type, alt }, brand default for a falsy source.
function renderLayout(context = {}) {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../src/_includes')), { autoescape: true });
  env.addFilter('seoMetadata', seo.metadata);
  env.addFilter('scriptJSON', seo.scriptJSON);
  env.addFilter('htmlDateString', seo.isoDate);
  const calls = [];
  env.addFilter('socialImageMeta', (...args) => {
    const callback = args.pop();
    const [source, alt] = args;
    calls.push([source, alt]);
    const image = source ? { url: `/assets/images/${path.basename(source, path.extname(source))}-0123456789abcdef-1200.jpg`,
      width: 1200, height: 675, type: 'image/jpeg', alt: alt || '' } : BRAND;
    // Resolve asynchronously, as the real universal async filter does.
    Promise.resolve().then(() => callback(null, image));
  }, true);
  return new Promise((resolve, reject) => env.render('base.njk', { site, helpers: {}, page: { url: '/' }, ...context },
    (error, html) => (error ? reject(error) : resolve({ html, document: parse(html), calls }))));
}

function headOrder(document) {
  const head = [...document.head.children];
  const inline = head.filter((node) => node.localName === 'script' && !node.hasAttribute('src') && node.textContent === JS_CLASS_SCRIPT);
  return {
    count: inline.length,
    afterViewport: head[head.indexOf(inline[0]) - 1]?.getAttribute('name') === 'viewport',
    beforeStyles: head.indexOf(inline[0]) < head.findIndex((node) => node.localName === 'link' && node.getAttribute('rel') === 'stylesheet'),
  };
}

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file) : entry.isFile() ? [file] : [];
  });
}

function parseHeaders(text) {
  const rules = new Map();
  let headers;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      expect(rules.has(line.trim())).toBe(false);
      rules.set(line.trim(), headers = new Map());
      continue;
    }
    const separator = line.indexOf(':');
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return rules;
}

describe('SEO policy and metadata', () => {
  test('one strict production preprocessor skips boolean drafts in every template and run mode', () => {
    const registered = productionPreprocessors();
    expect(registered.map(([name, extensions]) => [name, extensions])).toEqual([['drafts', '*']]);
    const skip = registered[0][2];
    const mode = process.env.ELEVENTY_RUN_MODE;
    try {
      for (const runMode of ['build', 'serve', 'watch', undefined]) {
        if (runMode) process.env.ELEVENTY_RUN_MODE = runMode;
        else delete process.env.ELEVENTY_RUN_MODE;
        expect(skip({ draft: true, permalink: '/preview/' })).toBe(false);
        expect(skip({ draft: true, eleventyExcludeFromCollections: false })).toBe(false);
      }
    } finally {
      if (mode === undefined) delete process.env.ELEVENTY_RUN_MODE;
      else process.env.ELEVENTY_RUN_MODE = mode;
    }
    // Only explicit boolean true is a draft; a future date is not a draft policy.
    for (const data of [{}, { draft: false }, { draft: 'true' }, { draft: 1 }, { date: '2999-01-01' }, { permalink: '/public/' }]) {
      expect(skip(data)).toBeUndefined();
    }
    // Post directory data keeps shared defaults only; no computed draft fields.
    expect(require('../src/posts/posts.11tydata')).toEqual({ layout: 'post.njk', tags: 'post', isPost: true });
    // Drafts never reach the layout, so it has no draft wrapper of its own.
    expect(sourceFile('_includes/base.njk')).not.toMatch(/\bdraft\s*(!=|==)|if\s+draft/);
    expect(sourceFile('_includes/base.njk').startsWith('<!DOCTYPE html>')).toBe(true);
  });

  test('script-safe objects preserve punctuation without markup injection', async () => {
    const title = '"Quotes" & <tags> </script><script>alert(1)</script> \\ line\n\u2028\u2029';
    const data = seo.metadata({ site, page: { url: '/posts/test/' }, isPost: true, title, topic: ['energie'], date: '2026-01-01' });
    const encoded = seo.scriptJSON(data.structuredData);
    expect(encoded).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(encoded)[0].headline).toBe(title);
    expect(data.structuredData[0].author.url).toBe(`${site.url}/about/`);
    expect(data.structuredData[1].itemListElement[1].item).toBe(`${site.url}/themen/energie/`);
    const { html, document } = await renderLayout({ title, page: { url: '/posts/test/' }, isPost: true });
    expect(document.querySelector('title').textContent).toBe(title);
    expect(document.querySelector('meta[property="og:title"]').content).toBe(title);
    const entities = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent));
    expect(entities[0].headline).toBe(title);
    expect(document.querySelector('nav.topics-nav .topics-menu')).not.toBeNull();
    expect(html).not.toContain('<script>alert(1)');
  });

  test('head adds the JS class right after the viewport, before any stylesheet', async () => {
    for (const context of [{ title: 'Home' }, { title: 'Post', isPost: true, page: { url: '/posts/p/' } }, { title: 'Suche', noindex: true, page: { url: '/suche/' } }]) {
      const { document } = await renderLayout(context);
      expect(headOrder(document)).toEqual({ count: 1, afterViewport: true, beforeStyles: true });
    }
  });

  test('AdSense follows only the site-wide switch, which is disabled', async () => {
    expect(site.adsense).toEqual({ enabled: false, client: 'ca-pub-6146112394026755' });
    const ads = (document) => [...document.querySelectorAll('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')];
    const contexts = [{ title: 'Post', isPost: true, page: { url: '/posts/p/' } }, { title: 'Archiv', pagination: { pageNumber: 0 } },
      { title: 'Suche', noindex: true, page: { url: '/suche/' } }, { title: 'Seite', page: { url: '/seite/' }, ads: false }];
    for (const context of [...contexts, { title: 'Seite', page: { url: '/seite/' }, ads: true }]) {
      expect((await renderLayout(context)).html).not.toMatch(/pagead2\.googlesyndication\.com|adsbygoogle/);
    }
    // Re-enabling is one data switch: every page, regardless of type or per-page flags.
    for (const context of contexts) {
      const { document } = await renderLayout({ ...context, site: { ...site, adsense: { enabled: true, client: 'ca-pub-123' } } });
      expect(ads(document).map((node) => new URL(node.getAttribute('src')).searchParams.get('client'))).toEqual(['ca-pub-123']);
      expect(ads(document)[0].hasAttribute('async')).toBe(true);
    }
  });

  test('canonical links only indexable pages; noindex is data-driven, not URL-driven', async () => {
    const indexable = (await renderLayout({ title: 'Seite', page: { url: '/seite/' } })).document;
    expect([...indexable.querySelectorAll('link[rel="canonical"]')].map((node) => node.getAttribute('href'))).toEqual([`${site.url}/seite/`]);
    for (const url of ['/suche/', '/404.html']) {
      const { document } = await renderLayout({ title: 'Utility', noindex: true, page: { url } });
      expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
      expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
      expect(document.querySelector('meta[property="og:url"]').content).toBe(`${site.url}${url}`);
      const unflagged = (await renderLayout({ title: 'Utility', page: { url } })).document;
      expect(unflagged.querySelector('meta[name="robots"]').content).toBe('index, follow');
      expect(unflagged.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    }
  });

  test('social image alt is emitted only when explicit; the brand fallback names the logo', async () => {
    const cases = [
      [{ isPost: true, image: '/images/hero.png' }, ['/images/hero.png', undefined], null],
      [{ isPost: true, image: '/images/hero.png', imageAlt: 'Windräder an Land' }, ['/images/hero.png', 'Windräder an Land'], 'Windräder an Land'],
      [{ socialImage: '/images/social.png', socialImageAlt: 'Vorschau', image: '/images/hero.png', imageAlt: 'Hero' }, ['/images/social.png', 'Vorschau'], 'Vorschau'],
      // A dedicated social image must not inherit the hero description.
      [{ socialImage: '/images/social.png', image: '/images/hero.png', imageAlt: 'Hero' }, ['/images/social.png', undefined], null],
      [{ dashboardImage: '/images/board.svg', dashboardImageAlt: 'Stromkurven' }, ['/images/board.svg', 'Stromkurven'], 'Stromkurven'],
      // The alt must come from the field that supplied the image.
      [{ image: '/images/hero.png', dashboardImageAlt: 'Stromkurven' }, ['/images/hero.png', undefined], null],
      [{ imageAlt: 'Verwaist' }, [undefined, undefined], 'Databearer-Logo'],
      [{}, [undefined, undefined], 'Databearer-Logo'],
    ];
    for (const [context, call, alt] of cases) {
      const { html, document, calls } = await renderLayout({ title: 'Seite', page: { url: '/seite/' }, ...context });
      expect(calls).toEqual([call]);
      for (const selector of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
        expect([...document.querySelectorAll(selector)].map((node) => node.content)).toEqual(alt === null ? [] : [alt]);
      }
      const expected = call[0] ? { width: '1200', height: '675' } : { width: '1200', height: '630' };
      const ogImage = document.querySelector('meta[property="og:image"]').content;
      expect(ogImage.startsWith(`${site.url}/assets/images/`)).toBe(true);
      expect(document.querySelector('meta[name="twitter:image"]').content).toBe(ogImage);
      expect(document.querySelector('meta[property="og:image:width"]').content).toBe(expected.width);
      expect(document.querySelector('meta[property="og:image:height"]').content).toBe(expected.height);
      expect(document.querySelector('meta[property="og:image:type"]').content).toBe('image/jpeg');
      expect(html).not.toContain('Redaktionelle Illustration');
    }
  });

  test('page identity is not inferred from incidental dates or utility URLs', () => {
    const meta = (data) => seo.metadata({ site, page: { url: '/static/' }, title: 'Page', ...data });
    expect(meta({ date: '2026-01-01' }).structuredData[0]['@type']).toBe('WebPage');
    expect(meta({ page: { url: '/about/' } }).structuredData[0]['@type']).toBe('AboutPage');
    expect(meta({ isTopicPage: true, pagination: { pageNumber: 1 } }).title).toBe('Page – Seite 2');
    expect(meta({ page: { url: '/' } }).structuredData.some((entity) => entity['@type'] === 'BreadcrumbList')).toBe(false);
    for (const url of ['/404.html', '/suche/']) {
      expect(meta({ page: { url }, noindex: true }).noindex).toBe(true);
      expect(meta({ page: { url } }).noindex).toBe(false);
    }
    expect(meta({ draft: true }).noindex).toBe(true); // Defensive; drafts are never rendered.
  });

  test('real utility pages opt out of indexing in frontmatter; the author page is in the sitemap', () => {
    for (const name of ['404.md', 'suche.njk']) expect(matter(sourceFile(name)).data.noindex).toBe(true);
    const about = matter(sourceFile('about.md')).data;
    expect(about.excludeFromSitemap).toBeUndefined();
    expect(about.noindex).toBeUndefined();
    expect(seo.indexable({ url: '/about/', data: about })).toBe(true);
    expect(`${site.url}${site.authorUrl}`).toBe(`${site.url}/about/`);
  });

  test('sitemap admits only intended public HTML', () => {
    for (const url of [false, '/feed.json', '/robots.txt', '/sitemap.xml', '/data/file.json']) {
      expect(seo.indexable({ url, data: {} })).toBe(false);
    }
    for (const flag of ['draft', 'noindex', 'excludeFromSitemap', 'eleventyExcludeFromCollections']) {
      expect(seo.indexable({ url: '/page/', data: { [flag]: true } })).toBe(false);
    }
    // Utility routes are excluded by their `noindex: true` data, not by URL.
    for (const url of ['/404.html', '/suche/']) {
      expect(seo.indexable({ url, data: { noindex: true } })).toBe(false);
      expect(seo.indexable({ url, data: {} })).toBe(true);
    }
    expect(seo.indexable({ url: '/page/', data: {} })).toBe(true);
  });

  test('sitemap lastmod is the UTC calendar date of the explicit revision or publication date', () => {
    expect(seo.sitemapLastmod({ data: { date: new Date('2026-09-20T00:00:00Z') } })).toBe('2026-09-20');
    expect(seo.sitemapLastmod({ data: { date: '2025-01-01', lastUpdated: '2026-09-21T01:30:00+02:00' } })).toBe('2026-09-20');
    expect(seo.sitemapLastmod({ data: { date: '2025-01-01' } })).toBe('2025-01-01');
    for (const data of [{}, { date: 'not a date' }]) expect(seo.sitemapLastmod({ data })).toBeUndefined();
  });

  test('homepage WebSite and Organization carry name, alternate title, measured logo, profiles and founder', async () => {
    expect(site.name).toBe('Databearer');
    expect(site.social).toEqual(['https://bsky.app/profile/databearer.bsky.social', 'https://x.com/databearerde']);
    const actual = await sharp(path.join(__dirname, '../src/images/logo_transparent.png')).metadata();
    expect(seo.LOGO).toEqual({ url: '/images/logo_transparent.png', width: actual.width, height: actual.height });
    const logo = { '@type': 'ImageObject', url: `${site.url}/images/logo_transparent.png`, width: 1070, height: 388 };
    const [, website, organization] = seo.metadata({ site, page: { url: '/' }, title: site.title }).structuredData;
    expect(website).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${site.url}/#website`,
      name: 'Databearer', alternateName: ['Databearer – Datenjournalismus'], url: `${site.url}/`,
      publisher: { '@id': `${site.url}/#organization` } });
    expect(organization).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', '@id': `${site.url}/#organization`,
      name: 'Databearer', url: `${site.url}/`, logo, description: site.description, sameAs: site.social,
      founder: { '@type': 'Person', name: site.author, url: `${site.url}/about/` } });
    // Articles reference the same publisher identity and logo, without homepage-only profiles.
    const [post] = seo.metadata({ site, page: { url: '/posts/p/' }, isPost: true, title: 'P', date: '2026-01-01' }).structuredData;
    expect(post.publisher).toEqual({ '@type': 'Organization', '@id': `${site.url}/#organization`, name: 'Databearer', url: `${site.url}/`, logo });
    expect(seo.metadata({ site, page: { url: '/seite/' }, title: 'Seite' }).structuredData.map((entity) => entity['@type']))
      .toEqual(['WebPage', 'BreadcrumbList']);
  });

  test('Cloudflare headers: noindex utility routes and immutable hashed images', () => {
    const rules = parseHeaders(sourceFile('_headers'));
    expect(rules.get('/404')).toEqual(new Map([['x-robots-tag', 'noindex, follow']]));
    expect(rules.has('/404.html')).toBe(false);
    expect(rules.get('/suche/')).toEqual(new Map([['x-robots-tag', 'noindex, follow']]));
    expect(rules.get('/search.json')).toEqual(new Map([['x-robots-tag', 'noindex']]));
    expect(rules.get('/assets/images/*')).toEqual(new Map([['cache-control', 'public, max-age=31536000, immutable']]));
    expect(rules.get('/data/history/german-electricity/manifest.json')).toEqual(new Map([['cache-control', 'no-cache']]));
    expect(rules.get('/data/history/german-electricity/:year.:sha.json'))
      .toEqual(new Map([['cache-control', 'public, max-age=31536000, immutable']]));
    expect(rules.size).toBe(6);
  });
});

describe('related posts', () => {
  const post = (url, topic, date, extra = {}) => ({ url, data: { topic, date, ...extra } });
  const related = (posts, current, topics) => seo.relatedPosts({ post: posts }, current, topics).map((item) => item.url);

  test('Jaccard topic similarity: a broad three-topic post no longer outranks an exact single-topic match', () => {
    const posts = [
      post('/self/', ['energie'], '2026-01-01'),
      post('/broad/', ['wirtschaft', 'politik-und-gesellschaft', 'energie'], '2026-01-02'),
      post('/exact-old/', ['energie'], '2023-01-01'),
      post('/pair/', ['energie', 'wirtschaft'], '2026-01-01'),
      post('/unrelated/', ['wirtschaft'], '2026-01-01'),
      post('/exact-near/', ['energie'], '2025-12-01'),
    ];
    // Shared-topic counts would tie all four; newest-first placed /broad/ first.
    expect(related(posts, { url: '/self/', date: new Date('2026-01-01') }, ['energie']))
      .toEqual(['/exact-near/', '/exact-old/', '/pair/', '/broad/']);
    // Equal similarities compare exactly (1/2 === 2/4) and fall through to date proximity.
    expect(related([post('/one-of-two/', ['energie'], '2020-01-01'),
      post('/two-of-four/', ['energie', 'wirtschaft', 'politik-und-gesellschaft', 'international'], '2025-12-31')],
    { url: '/self/', date: '2026-01-01' }, ['energie', 'wirtschaft'])).toEqual(['/two-of-four/', '/one-of-two/']);
  });

  test('ties: closer date to the current post, then newer, then URL; zero-overlap posts fill last', () => {
    const posts = [
      post('/latest/', ['energie'], '2026-06-01'),
      post('/after/', ['energie'], '2025-07-15'),
      post('/before/', ['energie'], '2025-05-01'),
      post('/unrelated-near/', ['wirtschaft'], '2025-06-01'),
      post('/same-distance-newer/', ['wirtschaft'], '2025-07-02'),
    ];
    // Current 2025-06-01: 31 days before, 44 days after, 365 days after; then zero overlap.
    expect(related(posts, { url: '/current/', date: '2025-06-01' }, ['energie']))
      .toEqual(['/before/', '/after/', '/latest/', '/unrelated-near/']);
    // Equal distance (31 days before/after): newer first. Equal dates: URL order.
    expect(related([post('/b/', ['energie'], '2025-05-01'), post('/a/', ['energie'], '2025-07-02'), post('/c/', ['energie'], '2025-07-02')],
      { url: '/current/', date: '2025-06-01' }, ['energie'])).toEqual(['/a/', '/c/', '/b/']);
    // Without a known current date, recency decides; undated posts come last.
    expect(related([post('/undated/', ['energie']), post('/old/', ['energie'], '2020-01-01'), post('/new/', ['energie'], '2026-01-01')],
      { url: '/unknown/' }, ['energie'])).toEqual(['/new/', '/old/', '/undated/']);
  });

  test('excludes self and drafts, returns at most four, is order-independent and never mutates input', () => {
    const posts = [post('/self/', ['energie'], '2026-01-01'), post('/draft/', ['energie'], '2026-01-01', { draft: true }),
      post('/hidden/', ['energie'], '2026-01-01', { permalink: false }), post('/excluded/', ['energie'], '2026-01-01', { eleventyExcludeFromCollections: true }),
      ...['/a/', '/b/', '/c/', '/d/', '/e/'].map((url, index) => post(url, ['energie'], `2025-12-0${index + 1}`))];
    const snapshot = JSON.stringify(posts);
    const expected = ['/e/', '/d/', '/c/', '/b/'];
    // The current post date comes from Eleventy's `page.date`, or its collection entry.
    for (const current of [{ url: '/self/', date: new Date('2026-01-01') }, { url: '/self/' }]) {
      for (const input of [posts, [...posts].reverse()]) expect(related(input, current, ['energie'])).toEqual(expected);
    }
    expect(JSON.stringify(posts)).toBe(snapshot);
    expect(seo.relatedPosts({}, { url: '/self/' }, ['energie'])).toEqual([]);
    expect(seo.relatedPosts({ post: posts }, { url: '/self/' }, undefined)).toHaveLength(4);
  });
});

describe('focused generated SEO output', () => {
  let workspace;
  const read = (name) => fs.readFileSync(path.join(workspace, '_site', name), 'utf8');
  const xml = (name) => new DOMParser().parseFromString(read(name), 'application/xml');
  const exists = (name) => fs.existsSync(path.join(workspace, '_site', name));
  beforeAll(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'databearer-seo-'));
    execFileSync(process.execPath, [path.join(__dirname, 'fixtures/seo-build.cjs'), workspace], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  }, 60000);
  afterAll(() => { if (workspace) fs.rmSync(workspace, { recursive: true, force: true }); });

  test('republishing a post and a page as drafts removes old HTML and every discovery reference', () => {
    for (const name of ['draft-preview/index.html', 'retired-page/index.html', '2/index.html']) expect(exists(name)).toBe(false);
    expect(read('preserved.json')).toBe('{"keep":true}');
    for (const file of ['index.html', '1/index.html', 'feed.json', 'feed.xml', 'search.json', 'sitemap.xml']) {
      expect(read(file)).not.toMatch(/draft-preview|Secret draft|retired-page|Retired page/);
    }
  });

  test('draft pages and directory-data drafts write no file and appear in no output', () => {
    for (const name of ['hidden-page', 'drafts', 'posts/wip']) expect(exists(name)).toBe(false);
    const leaks = filesBelow(path.join(workspace, '_site')).filter((file) => /\.(html|json|xml|txt)$/.test(file) &&
      /hidden-page|Hidden utility page|drafts\/note|Directory draft|wip\/unfinished|Unfinished directory draft|draft-preview|Secret draft|retired-page|Retired page/
        .test(fs.readFileSync(file, 'utf8')));
    expect(leaks).toEqual([]);
  });

  test('search includes every published fixture article with an implicit permalink', () => {
    const feed = JSON.parse(read('feed.json'));
    const search = JSON.parse(read('search.json'));
    expect(feed.items).toHaveLength(2);
    for (const name of ['older', 'newer']) {
      const source = fs.readFileSync(path.join(workspace, 'src/posts', `${name}.md`), 'utf8');
      expect(source).not.toMatch(/^permalink:/m);
      expect(exists(`posts/${name}/index.html`)).toBe(true);
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

  test('sitemap uses date-only explicit lastmod, omits non-HTML and filesystem dates; robots uses the site origin', () => {
    const sitemap = xml('sitemap.xml');
    expect(sitemap.querySelector('parsererror')).toBeNull();
    const urls = [...sitemap.querySelectorAll('url')];
    const about = urls.find((item) => item.querySelector('loc').textContent === `${site.url}/about/`);
    expect(about).toBeDefined();
    expect(about.querySelector('lastmod')).toBeNull();
    expect(read('sitemap.xml')).not.toMatch(/example.json|suche|404.html|feed.json|robots.txt/);
    const lastmod = (suffix) => urls.find((item) => item.querySelector('loc').textContent.endsWith(suffix)).querySelector('lastmod').textContent;
    expect(lastmod('/posts/older/')).toBe('2026-09-20');
    expect(lastmod('/posts/newer/')).toBe('2026-01-01');
    for (const node of sitemap.querySelectorAll('lastmod')) expect(node.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(read('robots.txt')).toContain(`Sitemap: ${site.url}/sitemap.xml`);
  });

  test('archives have unique canonical metadata; noindex utility pages have no canonical', () => {
    for (const [name, title] of [['index.html', 'Archive'], ['1/index.html', 'Archive – Seite 2']]) {
      const document = parse(read(name));
      expect(document.title).toBe(title);
      expect(document.querySelector('meta[property="og:title"]').content).toBe(title);
      expect(document.querySelector('link[type="application/feed+json"]').href).toBe(`${site.url}/feed.json`);
      expect([...document.querySelectorAll('link[rel="canonical"]')].map((node) => node.getAttribute('href')))
        .toEqual([`${site.url}/${name === 'index.html' ? '' : '1/'}`]);
    }
    for (const name of ['404.html', 'suche/index.html']) {
      const document = parse(read(name));
      expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
      expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
    }
    expect(read('404.html')).not.toContain('/themen/alle_posts');
  });

  test('every generated page adds the JS class before stylesheets, loads no ads and names only explicit social images', () => {
    const pages = filesBelow(path.join(workspace, '_site')).filter((file) => file.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(5);
    for (const file of pages) {
      const text = fs.readFileSync(file, 'utf8');
      expect(headOrder(parse(text))).toEqual({ count: 1, afterViewport: true, beforeStyles: true });
      expect(text).not.toMatch(/pagead2\.googlesyndication\.com|adsbygoogle|Redaktionelle Illustration/);
    }
    const alts = (name) => {
      const document = parse(read(name));
      const values = [...document.querySelectorAll('meta[property="og:image:alt"]')].map((node) => node.content);
      expect([...document.querySelectorAll('meta[name="twitter:image:alt"]')].map((node) => node.content)).toEqual(values);
      return values;
    };
    expect(alts('posts/older/index.html')).toEqual(['Databearer-Logo']); // No image: default brand preview.
    expect(alts('index.html')).toEqual(['Databearer-Logo']);
    expect(alts('posts/newer/index.html')).toEqual([]); // Social image without explicit alt.
    expect(alts('about/index.html')).toEqual(['Großes Databearer-Logo']);
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
  const source = sourceFile('robots.njk').replace(/^---[\s\S]*?---\s*/, '');
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
