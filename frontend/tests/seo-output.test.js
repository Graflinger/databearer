const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// Already supplied by Eleventy's frontmatter pipeline; no additional dependency.
const matter = require('gray-matter');
const site = require('../src/_data/site');

const enabled = process.env.SEO_OUTPUT_CHECK === '1';
const output = path.join(__dirname, '../_site');
const source = path.join(__dirname, '../src');
const origin = new URL(site.url).origin;
const batteryRoute = '/posts/2026/batteriespeicher-wandel/';
const html = (text) => new DOMParser().parseFromString(text, 'text/html');
const read = (file) => fs.readFileSync(path.join(output, file), 'utf8');
const absolute = (value, base = `${origin}/`) => new URL(value, base).href;

function filesBelow(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected generated-output symlink: ${file}`);
    if (entry.isDirectory()) return filesBelow(file, extension);
    return entry.isFile() && file.endsWith(extension) ? [file] : [];
  }).sort();
}

function routeFor(file) {
  return `/${path.relative(output, file).split(path.sep).join('/')}`.replace(/index\.html$/, '');
}

function one(document, selector) {
  const nodes = document.querySelectorAll(selector);
  expect({ selector, count: nodes.length }).toEqual({ selector, count: 1 });
  return nodes[0];
}

function meta(document, key) {
  const node = one(document, `meta[name="${key}"], meta[property="${key}"]`);
  expect(node.content.trim()).not.toBe('');
  return node.content;
}

function localFile(value, base) {
  const url = new URL(value, base);
  if (url.origin !== origin) return null;
  const filename = path.resolve(output, `.${decodeURIComponent(url.pathname)}`);
  expect(filename.startsWith(`${output}${path.sep}`)).toBe(true);
  expect({ url: url.href, exists: fs.existsSync(filename) }).toEqual({ url: url.href, exists: true });
  expect(fs.statSync(filename).isFile()).toBe(true);
  return filename;
}

function srcsetUrls(value) {
  // Tokenize the generated srcset attribute, never the surrounding HTML.
  return value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]);
}

function imageReferences(document) {
  const urls = [...document.querySelectorAll('img[src], input[type="image"][src]')]
    .map((node) => node.getAttribute('src'));
  for (const node of document.querySelectorAll('img[srcset], source[srcset]')) {
    urls.push(...srcsetUrls(node.getAttribute('srcset')));
  }
  for (const node of document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')) {
    urls.push(node.getAttribute('href'));
  }
  return urls;
}

function xml(file, root, namespace) {
  const document = new DOMParser().parseFromString(read(file), 'application/xml');
  expect(document.querySelector('parsererror')).toBeNull();
  expect(document.documentElement.localName).toBe(root);
  expect(document.documentElement.namespaceURI).toBe(namespace);
  return document;
}

function absoluteLink(value) {
  expect(typeof value).toBe('string');
  expect(value.trim()).not.toBe('');
  const url = new URL(value); // No base: relative URLs must fail.
  expect(['https:', 'http:', 'mailto:', 'tel:']).toContain(url.protocol);
  return url.href;
}

function feedContent(content, base) {
  expect(content.trim()).not.toBe('');
  const document = html(content);
  expect(document.body.textContent.trim()).not.toBe('');
  for (const node of document.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      if (node.hasAttribute(attribute)) absoluteLink(node.getAttribute(attribute));
    }
  }
  for (const value of imageReferences(document)) {
    absoluteLink(value);
    localFile(value, base);
  }
}

// Do not inspect _site at all during the ordinary, build-independent Jest suite.
// The opt-in gate is read-only and never builds or creates a fixture in _site.
const htmlFiles = enabled ? filesBelow(output, '.html') : [];
(enabled ? describe : describe.skip)('production generated-output SEO', () => {
  let pages, posts, jsonFeed, atom, sitemap, search;
  const imageMetadata = new Map();
  const dimensions = (filename) => {
    if (!imageMetadata.has(filename)) imageMetadata.set(filename, sharp(filename).metadata());
    return imageMetadata.get(filename);
  };

  beforeAll(() => {
    expect(htmlFiles.length).toBeGreaterThan(0);
    pages = new Map(htmlFiles.map((file) => [absolute(routeFor(file)), html(fs.readFileSync(file, 'utf8'))]));
    posts = filesBelow(path.join(source, 'posts'), '.md').map((file) => {
      const data = matter(fs.readFileSync(file, 'utf8')).data;
      const route = data.permalink || `/${path.relative(source, file).split(path.sep).join('/').replace(/\.md$/, '/')}`;
      return { ...data, url: absolute(route) };
    });
    jsonFeed = JSON.parse(read('feed.json'));
    atom = xml('feed.xml', 'feed', 'http://www.w3.org/2005/Atom');
    sitemap = xml('sitemap.xml', 'urlset', 'http://www.sitemaps.org/schemas/sitemap/0.9');
    search = JSON.parse(read('search.json'));
  });

  test.each(htmlFiles.map((file) => [routeFor(file)]))('%s: canonical, title, H1, description and JSON-LD', (route) => {
    const url = absolute(route);
    const document = pages.get(url);
    expect(one(document, 'link[rel="canonical"]').getAttribute('href')).toBe(url);
    const title = one(document, 'title').textContent.trim();
    expect(title).not.toBe('');
    expect(one(document, 'h1').textContent.trim()).not.toBe(''); // Includes 404.
    const description = meta(document, 'description');
    for (const prefix of ['og', 'twitter']) {
      expect(meta(document, `${prefix}:url`)).toBe(url);
      expect(meta(document, `${prefix}:title`)).toBe(title);
      expect(meta(document, `${prefix}:description`)).toBe(description);
    }
    const entities = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.textContent));
    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0]).toMatchObject({ '@context': 'https://schema.org', url });
    for (const entity of entities) expect(entity['@type']).toBeTruthy();
    const post = posts.find((item) => item.url === url);
    if (post) {
      expect(entities[0]).toMatchObject({
        '@type': 'BlogPosting',
        datePublished: new Date(post.date).toISOString(),
        dateModified: new Date(post.lastUpdated || post.date).toISOString(),
      });
    }
  });

  test.each(htmlFiles.map((file) => [routeFor(file)]))('%s: local images and measured raster social metadata', async (route) => {
    const url = absolute(route);
    const document = pages.get(url);
    for (const value of imageReferences(document)) localFile(value, url);
    for (const node of document.querySelectorAll('img[src][width][height]')) {
      const filename = localFile(node.getAttribute('src'), url);
      if (!filename) continue;
      const actual = await dimensions(filename);
      expect({ src: node.getAttribute('src'), width: Number(node.width), height: Number(node.height) })
        .toEqual({ src: node.getAttribute('src'), width: actual.width, height: actual.height });
    }
    const social = meta(document, 'og:image');
    expect(new URL(social).origin).toBe(origin);
    expect(meta(document, 'twitter:image')).toBe(social);
    const actual = await dimensions(localFile(social, url));
    expect(['jpeg', 'png', 'webp']).toContain(actual.format);
    expect(meta(document, 'og:image:type')).toBe(`image/${actual.format}`);
    expect({ width: Number(meta(document, 'og:image:width')), height: Number(meta(document, 'og:image:height')) })
      .toEqual({ width: actual.width, height: actual.height });
  });

  test('canonical URLs and page titles are unique, including pagination', () => {
    for (const selector of ['link[rel="canonical"]', 'title']) {
      const values = [...pages.values()].map((document) => {
        const node = one(document, selector);
        return node.getAttribute('href') || node.textContent.trim();
      });
      expect(new Set(values).size).toBe(values.length);
    }
  });

  test('search includes every published feed article', () => {
    expect(jsonFeed.items.length).toBeGreaterThan(0);
    const searchUrls = new Set(search.map((item) => absolute(item.url)));
    const missing = jsonFeed.items.map((item) => absolute(item.url)).filter((url) => !searchUrls.has(url));
    expect(missing).toEqual([]);
  });

  test('battery draft has no HTML or discovery references; search includes the dashboard', () => {
    const battery = posts.find((post) => post.url === absolute(batteryRoute));
    expect(battery).toMatchObject({ draft: true });
    for (const draft of posts.filter((post) => post.draft === true)) {
      expect(pages.has(draft.url)).toBe(false);
      const slug = decodeURIComponent(new URL(draft.url).pathname);
      for (const [url, document] of pages) {
        expect(document.body.textContent).not.toContain(draft.title);
        for (const link of document.querySelectorAll('[href]')) {
          expect(decodeURIComponent(new URL(link.getAttribute('href'), url).pathname)).not.toBe(slug);
        }
      }
      for (const discovery of [JSON.stringify(jsonFeed), JSON.stringify(search), atom.documentElement.textContent, sitemap.documentElement.textContent]) {
        expect(discovery).not.toContain(slug);
        expect(discovery).not.toContain(new URL(draft.url).pathname);
        expect(discovery).not.toContain(draft.title);
      }
    }
    expect(Array.isArray(search)).toBe(true);
    expect(search.some((item) => item.url === '/dashboards/strom/')).toBe(true);
    expect(new Set(search.map((item) => item.url)).size).toBe(search.length);
    for (const item of search) {
      expect(pages.has(absolute(item.url))).toBe(true);
      expect(item.title.trim()).not.toBe('');
      expect(meta(pages.get(absolute(item.url)), 'robots')).not.toContain('noindex');
    }
  });

  test('sitemap contains only public HTML and explicit content dates; utility pages are noindex', () => {
    for (const route of ['/suche/', '/404.html']) {
      expect(meta(pages.get(absolute(route)), 'robots')).toBe('noindex, follow');
    }
    const entries = [...sitemap.querySelectorAll('url')];
    expect(entries.length).toBeGreaterThan(0);
    const urls = entries.map((entry) => absoluteLink(one(entry, 'loc').textContent));
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(absolute('/dashboards/strom/'));
    expect(urls).toContain(absolute('/1/'));
    for (const entry of entries) {
      const url = absoluteLink(one(entry, 'loc').textContent);
      expect(pages.has(url)).toBe(true); // Rejects feeds, JSON, robots and machine routes.
      expect(meta(pages.get(url), 'robots')).not.toContain('noindex');
      const post = posts.find((item) => item.url === url);
      if (post) {
        expect(one(entry, 'lastmod').textContent).toBe(new Date(post.lastUpdated || post.date).toISOString());
      } else {
        // Current static/dashboard pages have no explicit editorial revision date.
        expect(entry.querySelector('lastmod')).toBeNull();
      }
    }
    expect(read('robots.txt')).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });

  test('JSON Feed preserves downstream fields, source image/caption semantics and absolute content links', () => {
    expect(jsonFeed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(absoluteLink(jsonFeed.home_page_url)).toBe(absolute('/'));
    expect(absoluteLink(jsonFeed.feed_url)).toBe(absolute('/feed.json'));
    const published = posts.filter((post) => post.draft !== true && post.eleventyExcludeFromCollections !== true && post.permalink !== false);
    expect(jsonFeed.items.map((item) => absoluteLink(item.url)).sort()).toEqual(published.map((post) => post.url).sort());
    for (const item of jsonFeed.items) {
      const post = published.find((entry) => entry.url === absoluteLink(item.url));
      expect(absoluteLink(item.id)).toBe(post.url);
      expect(item).toMatchObject({
        title: post.title, summary: post.excerpt || post.description || '',
        date_published: new Date(post.date).toISOString(),
        date_modified: new Date(post.lastUpdated || post.date).toISOString(),
        tags: post.topic || [],
      });
      if (post.image) {
        expect(absoluteLink(item.image)).toBe(absolute(post.image));
        localFile(item.image, item.url);
      }
      if (post.imageText) expect(item._image_alt).toBe(post.imageText);
      feedContent(item.content_html, item.url);
    }
  });

  test('Atom preserves the latest-20 contract, absolute links and maximum explicit modification date', () => {
    const entries = [...atom.querySelectorAll('entry')];
    const expected = jsonFeed.items.slice(0, 20);
    expect(entries.map((entry) => absoluteLink(one(entry, 'id').textContent)))
      .toEqual(expected.map((item) => absoluteLink(item.id)));
    expect(entries.length).toBeGreaterThan(0);
    for (const link of atom.querySelectorAll('link[href]')) absoluteLink(link.getAttribute('href'));
    for (const uri of atom.querySelectorAll('author uri')) absoluteLink(uri.textContent);
    for (const [index, entry] of entries.entries()) {
      const item = expected[index];
      expect(one(entry, 'title').textContent).toBe(item.title);
      expect(absoluteLink(one(entry, 'link').getAttribute('href'))).toBe(absoluteLink(item.url));
      expect(one(entry, 'published').textContent).toBe(item.date_published);
      expect(one(entry, 'updated').textContent).toBe(item.date_modified);
      expect(one(entry, 'summary').textContent).toBe(item.summary);
      const content = one(entry, 'content');
      expect(content.getAttribute('type')).toBe('html');
      feedContent(content.textContent, item.url);
    }
    const updated = [...atom.documentElement.children].filter((node) => node.localName === 'updated');
    expect(updated).toHaveLength(1);
    expect(updated[0].textContent).toBe(new Date(Math.max(...expected.map((item) => Date.parse(item.date_modified)))).toISOString());
  });
});
