const fs = require('fs');
const path = require('path');

const topicNames = { energie: 'Energie', wirtschaft: 'Wirtschaft', 'politik-und-gesellschaft': 'Politik & Gesellschaft' };
// Measured intrinsic size of src/images/logo_transparent.png (tests verify it).
const LOGO = { url: '/images/logo_transparent.png', width: 1070, height: 388 };

function isoDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return undefined;
  return new Date(value).toISOString();
}

// Sitemap lastmod: UTC calendar date of the explicit editorial revision/publication.
function sitemapLastmod(item) {
  return isoDate(item.data.lastUpdated || item.data.date)?.slice(0, 10);
}

function absoluteUrl(value, origin) {
  return new URL(value || '/', origin).href;
}

function scriptJSON(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function published(post) {
  return post.data.draft !== true && post.data.eleventyExcludeFromCollections !== true && post.data.permalink !== false;
}

// Utility pages (search, 404) opt out with `noindex: true` data, not URL lists.
function indexable(item) {
  return published(item) && !item.data.noindex && !item.data.excludeFromSitemap &&
    typeof item.url === 'string' && (item.url.endsWith('/') || item.url.endsWith('.html'));
}

function time(value) {
  const milliseconds = value === undefined || value === null ? NaN : new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function topicSet(value) {
  return new Set(Array.isArray(value) ? value : value ? [value] : []);
}

// Rank by Jaccard similarity of topic sets, so a broad multi-topic post no longer
// ties an exact match. Ties: closer publication date to the current post, then
// newer, then URL. Self and drafts are excluded; the input is never mutated.
function relatedPosts(collections, currentPage, currentTopics = []) {
  const posts = collections?.post || [];
  const topics = topicSet(currentTopics);
  const self = posts.find((post) => post.url === currentPage?.url);
  const current = time(currentPage?.date) ?? time(self?.data?.date) ?? time(self?.date);
  const ranked = posts.filter((post) => published(post) && post.url !== currentPage?.url).map((post) => {
    const other = topicSet(post.data.topic);
    const shared = [...other].filter((topic) => topics.has(topic)).length;
    const date = time(post.data.date) ?? time(post.date);
    return {
      post, shared, union: (topics.size + other.size - shared) || 1, date: date ?? -Infinity,
      distance: date === undefined || current === undefined ? Infinity : Math.abs(date - current),
    };
  });
  const order = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  // Cross-multiplied integers keep equal similarities (1/2 vs 2/4) exact ties.
  ranked.sort((a, b) => order(b.shared * a.union, a.shared * b.union) ||
    order(a.distance, b.distance) || order(b.date, a.date) || order(a.post.url, b.post.url));
  return ranked.slice(0, 4).map((entry) => entry.post);
}

function metadata(data) {
  const { site, page = {}, pagination } = data;
  const url = absoluteUrl(page.url || '/', site.url);
  const title = (data.metaTitle || data.title || site.title) +
    (pagination?.pageNumber > 0 ? ` – Seite ${pagination.pageNumber + 1}` : '');
  const description = data.metaDescription || data.excerpt || data.description || site.description;
  const isPost = data.isPost === true;
  // Data-driven: utility pages such as search and 404 declare `noindex: true`.
  const noindex = data.draft === true || data.noindex === true;
  const image = absoluteUrl(data.social?.url || data.image || LOGO.url, site.url);
  const author = { '@type': 'Person', name: site.author, url: absoluteUrl(site.authorUrl || '/about/', site.url) };
  const organization = {
    '@type': 'Organization', '@id': `${site.url}/#organization`, name: site.name, url: `${site.url}/`,
    logo: { '@type': 'ImageObject', url: absoluteUrl(LOGO.url, site.url), width: LOGO.width, height: LOGO.height },
  };
  const website = {
    '@type': 'WebSite', '@id': `${site.url}/#website`, name: site.name, alternateName: [site.title],
    url: `${site.url}/`, publisher: { '@id': organization['@id'] },
  };
  const entity = {
    '@context': 'https://schema.org',
    '@type': isPost ? 'BlogPosting' : data.isTopicPage || pagination || page.url === '/dashboards/' ? 'CollectionPage' : page.url === '/about/' ? 'AboutPage' : 'WebPage',
    '@id': `${url}#${isPost ? 'article' : 'webpage'}`, url, name: title, description, inLanguage: site.locale,
    isPartOf: { '@id': website['@id'] },
  };
  if (isPost) Object.assign(entity, {
    headline: data.title, image, author, publisher: organization,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: isoDate(data.date), dateModified: isoDate(data.lastUpdated || data.date),
  });
  const structuredData = [entity];
  if (page.url === '/') {
    structuredData.push({ '@context': 'https://schema.org', ...website }, {
      '@context': 'https://schema.org', ...organization, description: site.description, sameAs: site.social, founder: author,
    });
  }
  if (page.url && page.url !== '/' && !noindex) {
    const crumbs = [{ name: 'Home', item: `${site.url}/` }];
    const topic = isPost && data.topic?.[0];
    if (topicNames[topic]) crumbs.push({ name: topicNames[topic], item: absoluteUrl(`/themen/${topic}/`, site.url) });
    crumbs.push({ name: title, item: url });
    structuredData.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })) });
  }
  return { title, description, url, image, isPost, noindex, structuredData };
}

const OUTPUT_MARKER = '.databearer-seo-output';
const OUTPUT_MARKER_CONTENT = 'databearer-owned-html-output-v1\n';

// Resolve existing ancestors too, including when the final directory is absent.
function canonicalPath(filename) {
  try {
    return fs.realpathSync(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = path.dirname(filename);
    if (parent === filename) throw error;
    return path.join(canonicalPath(parent), path.basename(filename));
  }
}

function approvedOutput(output, input) {
  const source = canonicalPath(path.resolve(input));
  const root = canonicalPath(path.resolve(output));
  const project = fs.realpathSync(path.join(__dirname, '..'));
  // Output must be the canonical _site sibling of input, never source, its
  // ancestor, a nested directory, or an alias whose target lies elsewhere.
  if (path.basename(source) !== 'src' || root !== path.join(path.dirname(source), '_site')) {
    throw new Error('Refusing HTML cleanup outside an approved canonical _site directory');
  }
  if (root === path.join(project, '_site') && source === path.join(project, 'src')) return root;
  const marker = path.join(root, OUTPUT_MARKER);
  if (!fs.existsSync(marker) || !fs.lstatSync(marker).isFile() || fs.readFileSync(marker, 'utf8') !== OUTPUT_MARKER_CONTENT) {
    throw new Error('Refusing HTML cleanup in an unowned output directory (explicit marker required)');
  }
  return root;
}

// Read-only inventory before rendering. The approved output tree owns its HTML,
// including legacy draft pages written before this cleanup policy existed.
function htmlOutputSnapshot(output, input) {
  const root = approvedOutput(output, input);
  const files = new Map();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Refusing HTML cleanup through an output-tree symlink');
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && entry.name.endsWith('.html')) files.set(filename, fs.statSync(filename));
    }
  }
  if (fs.existsSync(root)) visit(root);
  return { root, files };
}

function cleanHtmlOutput(output, input, snapshot, results) {
  // Eleventy 3 Template._write returns undefined in dry-run mode; only actual
  // writes return outputPath/content. No writes (including an empty site) means
  // no cleanup. Do not infer dry-run from argv or filesystem timestamps.
  const written = (results || []).filter((result) => result && typeof result.outputPath === 'string');
  if (!snapshot || !written.length) return;
  const root = approvedOutput(output, input);
  if (root !== snapshot.root) throw new Error('Output directory changed during build');
  const current = new Set(written.map((result) => canonicalPath(path.resolve(result.outputPath))));
  const stale = [];
  for (const [filename, previous] of snapshot.files) {
    if (current.has(filename) || !fs.existsSync(filename)) continue;
    // Validate every candidate before deleting any. Do not follow replaced
    // ancestor directories or remove files changed outside this build.
    if (canonicalPath(filename) !== filename) throw new Error('Output symlink changed during build');
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.ino !== previous.ino || stat.dev !== previous.dev ||
      stat.size !== previous.size || stat.mtimeMs !== previous.mtimeMs || stat.ctimeMs !== previous.ctimeMs) {
      throw new Error('Stale HTML changed during build');
    }
    stale.push(filename);
  }
  for (const filename of stale) fs.unlinkSync(filename);
}

function configure(eleventyConfig) {
  eleventyConfig.ignores.add('src/seo.js');
  eleventyConfig.addFilter('seoMetadata', metadata);
  eleventyConfig.addFilter('scriptJSON', scriptJSON);
  eleventyConfig.addFilter('absoluteUrl', absoluteUrl);
  eleventyConfig.addFilter('published', published);
  eleventyConfig.addFilter('indexablePages', (items) => items.filter(indexable));
  eleventyConfig.addFilter('explicitLastmod', sitemapLastmod);
  eleventyConfig.addFilter('feedUpdated', (posts) => posts.reduce((latest, post) => {
    const date = isoDate(post.data.lastUpdated || post.data.date);
    return date && date > latest ? date : latest;
  }, '1970-01-01T00:00:00.000Z'));
  eleventyConfig.addFilter('relatedPosts', relatedPosts);
  eleventyConfig.addAsyncFilter('feedHTML', function (html, url, origin) {
    // Resolve against the complete article URL. Supplying pageUrlOverride to
    // HtmlBasePlugin drops relative query strings in Eleventy 3.1.x.
    return eleventyConfig.getFilter('transformWithHtmlBase')
      .call({ page: {} }, html, absoluteUrl(url, origin));
  });
  let outputSnapshot;
  eleventyConfig.on('eleventy.before', ({ directories, runMode, outputMode, incremental }) => {
    outputSnapshot = undefined;
    if (runMode === 'build' && outputMode === 'fs') {
      if (incremental) throw new Error('Production SEO output requires a full build, not --incremental');
      outputSnapshot = htmlOutputSnapshot(directories.output, directories.input);
    }
  });
  eleventyConfig.on('eleventy.after', ({ directories, runMode, outputMode, results }) => {
    if (runMode === 'build' && outputMode === 'fs') {
      cleanHtmlOutput(directories.output, directories.input, outputSnapshot, results);
    }
    outputSnapshot = undefined;
  });
}

module.exports = { LOGO, isoDate, sitemapLastmod, absoluteUrl, scriptJSON, published, indexable, relatedPosts, metadata,
  OUTPUT_MARKER, OUTPUT_MARKER_CONTENT, htmlOutputSnapshot, cleanHtmlOutput, configure };
