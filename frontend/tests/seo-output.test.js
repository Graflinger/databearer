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
const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js');window.addEventListener('load',function(){if(!document.documentElement.classList.contains('nav-enhanced'))document.documentElement.classList.remove('js');});";
const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const BRAND_ALT = 'Databearer-Logo';
const html = (text) => new DOMParser().parseFromString(text, 'text/html');
const read = (file) => fs.readFileSync(path.join(output, file), 'utf8');
const absolute = (value, base = `${origin}/`) => new URL(value, base).href;
const trimSlash = (pathname) => pathname.replace(/\/+$/, '') || '/';

function filesBelow(directory, extension, skip = []) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${file}`);
    if (entry.isDirectory()) return skip.includes(entry.name) ? [] : filesBelow(file, extension, skip);
    return entry.isFile() && extension.test(file) ? [file] : [];
  }).sort();
}

function routeFor(file) {
  return `/${path.relative(output, file).split(path.sep).join('/')}`.replace(/index\.html$/, '');
}

// Eleventy's implicit route for a source template, or its explicit permalink.
function templateRoute(file, data) {
  if (data.permalink === false) return null;
  if (typeof data.permalink === 'string') return data.permalink.includes('{') ? null : data.permalink;
  const stem = path.relative(source, file).split(path.sep).join('/').replace(/\.(md|njk)$/, '')
    .replace(/(^|\/)index$/, '');
  return stem ? `/${stem}/` : '/';
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

function jsonLd(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent));
}

function imageObjects(value) {
  if (!value || typeof value !== 'object') return [];
  const nested = Object.values(value).flatMap(imageObjects);
  return value['@type'] === 'ImageObject' ? [value, ...nested] : nested;
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
const htmlFiles = enabled && fs.existsSync(output) ? filesBelow(output, /\.html$/) : [];
if (enabled && !htmlFiles.length) {
  test('generated output exists', () => {
    throw new Error(`No generated HTML in ${output}. Run npm run build first.`);
  });
}

(htmlFiles.length ? describe : describe.skip)('production generated-output SEO', () => {
  let pages, texts, posts, drafts, jsonFeed, atom, sitemap, search, brandImage;
  const imageMetadata = new Map();
  const dimensions = (filename) => {
    if (!imageMetadata.has(filename)) imageMetadata.set(filename, sharp(filename).metadata());
    return imageMetadata.get(filename);
  };
  const noindex = (document) => meta(document, 'robots') === 'noindex, follow';

  beforeAll(() => {
    texts = new Map(htmlFiles.map((file) => [absolute(routeFor(file)), fs.readFileSync(file, 'utf8')]));
    pages = new Map([...texts].map(([url, text]) => [url, html(text)]));
    const templates = filesBelow(source, /\.(md|njk)$/, ['_includes', '_data', 'data_ingestion']).map((file) => {
      const data = matter(fs.readFileSync(file, 'utf8')).data;
      const route = templateRoute(file, data);
      return { ...data, file, route, url: route && absolute(route), isPost: file.startsWith(path.join(source, 'posts') + path.sep) };
    });
    posts = templates.filter((template) => template.isPost && template.file.endsWith('.md'));
    drafts = templates.filter((template) => template.draft === true);
    jsonFeed = JSON.parse(read('feed.json'));
    atom = xml('feed.xml', 'feed', 'http://www.w3.org/2005/Atom');
    sitemap = xml('sitemap.xml', 'urlset', 'http://www.sitemaps.org/schemas/sitemap/0.9');
    search = JSON.parse(read('search.json'));
    // The homepage declares no image, so it carries the default brand preview.
    brandImage = meta(pages.get(absolute('/')), 'og:image');
  });

  test.each(htmlFiles.map((file) => [routeFor(file)]))('%s: canonical (indexable only), title, H1, description and JSON-LD', (route) => {
    const url = absolute(route);
    const document = pages.get(url);
    expect(['index, follow', 'noindex, follow']).toContain(meta(document, 'robots'));
    const canonical = [...document.querySelectorAll('link[rel="canonical"]')].map((node) => node.getAttribute('href'));
    expect(canonical).toEqual(noindex(document) ? [] : [url]);
    const title = one(document, 'title').textContent.trim();
    expect(title).not.toBe('');
    expect(one(document, 'h1').textContent.trim()).not.toBe(''); // Includes 404.
    const description = meta(document, 'description');
    for (const prefix of ['og', 'twitter']) {
      expect(meta(document, `${prefix}:url`)).toBe(url);
      expect(meta(document, `${prefix}:title`)).toBe(title);
      expect(meta(document, `${prefix}:description`)).toBe(description);
    }
    const entities = jsonLd(document);
    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0]).toMatchObject({ '@context': 'https://schema.org', url });
    for (const entity of entities) expect(entity['@type']).toBeTruthy();
    const post = posts.find((item) => item.url === url);
    if (post) {
      expect(entities[0]).toMatchObject({
        '@type': 'BlogPosting',
        datePublished: new Date(post.date).toISOString(),
        dateModified: new Date(post.lastUpdated || post.date).toISOString(),
        publisher: { '@type': 'Organization', name: site.name },
      });
    }
  });

  test.each(htmlFiles.map((file) => [routeFor(file)]))('%s: early JS class, site-wide ad switch and explicit-only social alt', (route) => {
    const url = absolute(route);
    const document = pages.get(url);
    const head = [...document.head.children];
    const inline = head.filter((node) => node.localName === 'script' && node.textContent === JS_CLASS_SCRIPT);
    expect(inline).toHaveLength(1);
    const script = head.indexOf(inline[0]);
    expect(inline[0].hasAttribute('src')).toBe(false);
    expect(head[script - 1].getAttribute('name')).toBe('viewport');
    const stylesheet = head.findIndex((node) => node.localName === 'link' && node.getAttribute('rel') === 'stylesheet');
    expect(stylesheet).toBeGreaterThan(script);
    const text = texts.get(url);
    if (site.adsense?.enabled) {
      const ads = [...document.querySelectorAll(`script[src^="${ADSENSE_SCRIPT}"]`)];
      expect(ads).toHaveLength(1);
      expect(new URL(ads[0].getAttribute('src')).searchParams.get('client')).toBe(site.adsense.client);
    } else {
      expect(text).not.toMatch(/pagead2\.googlesyndication\.com|adsbygoogle/);
    }
    expect(text).not.toContain('Redaktionelle Illustration');
    const alts = [...document.querySelectorAll('meta[property="og:image:alt"]')].map((node) => node.content);
    expect([...document.querySelectorAll('meta[name="twitter:image:alt"]')].map((node) => node.content)).toEqual(alts);
    expect(alts.length).toBeLessThanOrEqual(1);
    for (const alt of alts) expect(alt.trim()).not.toBe('');
    if (meta(document, 'og:image') === brandImage) expect(alts).toEqual([BRAND_ALT]);
    const post = posts.find((item) => item.url === url);
    if (post && (post.socialImage || post.image)) {
      const explicit = post.socialImage ? post.socialImageAlt : post.imageAlt;
      expect(alts).toEqual(explicit ? [explicit] : []);
    }
  });

  test.each(htmlFiles.map((file) => [routeFor(file)]))('%s: local images and measured raster social/structured-data metadata', async (route) => {
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
    for (const image of jsonLd(document).flatMap(imageObjects)) {
      expect(new URL(image.url).origin).toBe(origin);
      const measured = await dimensions(localFile(image.url, url));
      if ('width' in image || 'height' in image) {
        expect({ url: image.url, width: image.width, height: image.height })
          .toEqual({ url: image.url, width: measured.width, height: measured.height });
      }
    }
  });

  test('default brand preview is the measured 1200x630 JPEG named as the logo', async () => {
    const home = pages.get(absolute('/'));
    expect(meta(home, 'og:image:alt')).toBe(BRAND_ALT);
    expect(await dimensions(localFile(brandImage, absolute('/')))).toMatchObject({ width: 1200, height: 630, format: 'jpeg' });
  });

  test('canonical URLs of indexable pages and all page titles are unique, including pagination', () => {
    const documents = [...pages.values()];
    const canonicals = documents.flatMap((document) => [...document.querySelectorAll('link[rel="canonical"]')]
      .map((node) => node.getAttribute('href')));
    expect(canonicals).toHaveLength(documents.filter((document) => !noindex(document)).length);
    expect(new Set(canonicals).size).toBe(canonicals.length);
    const titles = documents.map((document) => one(document, 'title').textContent.trim());
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('homepage structured data names the WebSite and Organization with logo and profiles', () => {
    const entities = jsonLd(pages.get(absolute('/')));
    expect(entities.find((entity) => entity['@type'] === 'WebSite'))
      .toMatchObject({ name: site.name, alternateName: [site.title], url: absolute('/') });
    expect(entities.find((entity) => entity['@type'] === 'Organization')).toMatchObject({
      name: site.name, url: absolute('/'), description: site.description, sameAs: site.social,
      founder: { '@type': 'Person', name: site.author, url: absolute(site.authorUrl) },
      logo: { '@type': 'ImageObject', url: absolute('/images/logo_transparent.png'), width: expect.any(Number), height: expect.any(Number) },
    });
  });

  test('search includes every published feed article', () => {
    expect(jsonFeed.items.length).toBeGreaterThan(0);
    const searchUrls = new Set(search.map((item) => absolute(item.url)));
    const missing = jsonFeed.items.map((item) => absolute(item.url)).filter((url) => !searchUrls.has(url));
    expect(missing).toEqual([]);
  });

  test('source drafts, if any, have no HTML and no discovery references', () => {
    const discovery = [JSON.stringify(jsonFeed), JSON.stringify(search), read('feed.xml'), atom.documentElement.textContent,
      read('sitemap.xml'), sitemap.documentElement.textContent];
    for (const draft of drafts) {
      if (draft.url && draft.route !== '/') {
        const pathname = new URL(draft.url).pathname;
        expect(pages.has(draft.url)).toBe(false);
        expect(fs.existsSync(path.join(output, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : ''))).toBe(false);
        for (const [url, document] of pages) {
          for (const link of document.querySelectorAll('[href]')) {
            expect(trimSlash(decodeURIComponent(new URL(link.getAttribute('href'), url).pathname)))
              .not.toBe(trimSlash(decodeURIComponent(pathname)));
          }
        }
        for (const text of discovery) {
          expect(text).not.toContain(decodeURIComponent(pathname));
          expect(text).not.toContain(pathname);
        }
      }
      if (draft.isPost && draft.title) {
        for (const document of pages.values()) expect(document.body.textContent).not.toContain(draft.title);
        for (const text of discovery) expect(text).not.toContain(draft.title);
      }
    }
  });

  test('search lists only public, indexable pages, including the dashboard', () => {
    expect(Array.isArray(search)).toBe(true);
    expect(search.some((item) => item.url === '/dashboards/strom/')).toBe(true);
    expect(new Set(search.map((item) => item.url)).size).toBe(search.length);
    for (const item of search) {
      expect(pages.has(absolute(item.url))).toBe(true);
      expect(item.title.trim()).not.toBe('');
      expect(meta(pages.get(absolute(item.url)), 'robots')).not.toContain('noindex');
    }
  });

  test('sitemap contains only public HTML with date-only explicit content dates; utility pages are noindex', () => {
    for (const route of ['/suche/', '/404.html']) {
      const document = pages.get(absolute(route));
      expect(meta(document, 'robots')).toBe('noindex, follow');
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    }
    const entries = [...sitemap.querySelectorAll('url')];
    expect(entries.length).toBeGreaterThan(0);
    const urls = entries.map((entry) => absoluteLink(one(entry, 'loc').textContent));
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(absolute('/dashboards/strom/'));
    expect(urls).toContain(absolute('/1/'));
    expect(urls).toContain(absolute('/about/')); // The author URL of every article.
    for (const route of ['/suche/', '/404.html']) expect(urls).not.toContain(absolute(route));
    for (const entry of entries) {
      const url = absoluteLink(one(entry, 'loc').textContent);
      expect(pages.has(url)).toBe(true); // Rejects feeds, JSON, robots and machine routes.
      expect(meta(pages.get(url), 'robots')).not.toContain('noindex');
      const post = posts.find((item) => item.url === url);
      if (post) {
        const lastmod = one(entry, 'lastmod').textContent;
        expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(lastmod).toBe(new Date(post.lastUpdated || post.date).toISOString().slice(0, 10));
      } else {
        // Current static/dashboard pages have no explicit editorial revision date.
        expect(entry.querySelector('lastmod')).toBeNull();
      }
    }
    expect(read('robots.txt')).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });

  test('Cloudflare header rules are published unchanged', () => {
    expect(read('_headers')).toBe(fs.readFileSync(path.join(source, '_headers'), 'utf8'));
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
