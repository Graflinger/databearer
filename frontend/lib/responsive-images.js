const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const WIDTHS = [360, 720, 1200, 1408];
const SIZES = {
  card: '(max-width: 768px) calc(100vw - 56px), 360px',
  full: '(max-width: 768px) calc(100vw - 56px), (max-width: 932px) calc(100vw - 56px), 874px',
  hero: '(max-width: 768px) calc(100vw - 48px), 780px',
};
const INPUT_OPTIONS = { limitInputPixels: 32 * 1024 * 1024, animated: false };
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
// Counts distinct sources referenced by templates in one build, not files on disk.
const MAX_IMAGES = 256;
const WORKERS = 2;
const THUMBNAIL_MAX_WIDTH = 720;
const EXTENSIONS = /\.(png|jpe?g|webp|svg)$/i;
const ENCODERS = { webp: { quality: 78, effort: 4 }, jpeg: { quality: 82 }, png: { compressionLevel: 9 } };
const BRAND_SOURCE = '/images/logo_big.png';
const DEFAULT_SOCIAL_ALT = 'Databearer-Logo';
// og:image URLs are cached by crawlers and embedded in shared links. Their hashes
// cover only the source path/bytes and this recipe, never encoder versions, so a
// Sharp/libvips upgrade does not rename them. Changing this recipe renames them.
const SOCIAL_RECIPE = {
  version: 1,
  // Article/dashboard previews keep their aspect ratio: largest fallback <= 1200w.
  source: { maxWidth: 1200, withoutEnlargement: true, opaque: 'jpeg', transparentOrSvg: 'png' },
  // Brand fallback: the logo contained on a 1200x630 canvas.
  brand: { source: BRAND_SOURCE, width: 1200, height: 630, fit: 'contain', withoutEnlargement: true,
    background: '#141824', format: 'jpeg' },
  jpeg: { quality: 82 },
  png: { compressionLevel: 9 },
};
const SOCIAL_KEY = JSON.stringify(SOCIAL_RECIPE);

// Responsive variant cache keys include encoder versions and all conversion settings.
function responsiveRecipe(versions) {
  return JSON.stringify({ version: 1, sharp: versions, widths: WIDTHS,
    webp: ENCODERS.webp, jpeg: ENCODERS.jpeg, png: ENCODERS.png });
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function srcset(items) {
  return items.map((item) => `${item.url} ${item.width}w`).join(', ');
}

function renderPicture(metadata, alt = '', mode = 'card', eager = false) {
  if (!SIZES[mode]) throw new Error(`Unknown responsive image mode: ${mode}`);
  const fallback = metadata.fallback;
  const largest = fallback[fallback.length - 1];
  const sizes = escapeAttribute(SIZES[mode]);
  return `<picture><source type="image/webp" srcset="${srcset(metadata.webp)}" sizes="${sizes}">`
    + `<img src="${largest.url}" srcset="${srcset(fallback)}" sizes="${sizes}"`
    + ` width="${largest.width}" height="${largest.height}" alt="${escapeAttribute(alt)}"`
    + ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture>`;
}

// Card-mode candidates for client-rendered cards (search results).
function thumbnail(metadata) {
  const within = (items) => items.filter((item) => item.width <= THUMBNAIL_MAX_WIDTH);
  const src = metadata.fallback[0]; // 360w, or the source width when narrower
  return { src: src.url, srcset: srcset(within(metadata.fallback)), webpSrcset: srcset(within(metadata.webp)),
    sizes: SIZES.card, width: src.width, height: src.height };
}

function isSelfContainedSvg(svg) {
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) return false;
  const localFragment = (value) => /^#[^\s"'()<>\\&]+$/.test(value.trim());
  // Extract complete values first: optional quotes in a negative lookahead can
  // backtrack and incorrectly reject valid url('#paint') references.
  for (const match of svg.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
    if (!localFragment(match[1] ?? match[2] ?? match[3])) return false;
  }
  for (const match of svg.matchAll(/\burl\s*\(([^)]*)\)/gi)) {
    let value = match[1].trim();
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!localFragment(value)) return false;
  }
  return true;
}

function stem(source) {
  return path.basename(source, path.extname(source)).normalize('NFKD')
    .replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60);
}

function digest(...parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, 16);
}

function notFound(source, cause) {
  return new Error(`Image not found: ${source}. Expected a file under src/images (check path, letter case`
    + ' and Unicode normalization). Supported: png, jpg, jpeg, webp, svg.', cause ? { cause } : undefined);
}

function validate(source) {
  if (typeof source !== 'string' || !source.startsWith('/images/')
      || /[?#\\\0]/.test(source) || source.split('/').includes('..') || !EXTENSIONS.test(source)) {
    throw new Error(`Expected a local /images/ raster or SVG path: ${source}`);
  }
}

function createImageService({
  inputDir = path.join(__dirname, '../src'),
  outputDir = path.join(__dirname, '../_site'),
  sharpVersions = sharp.versions,
} = {}) {
  inputDir = path.resolve(inputDir);
  outputDir = path.resolve(outputDir);
  const imageRoot = path.join(inputDir, 'images');
  const assetDir = path.join(outputDir, 'assets/images');
  const recipe = responsiveRecipe(sharpVersions);
  const pending = new Map();
  const referenced = new Set();
  const queue = [];
  let active = 0;
  // Two workers; each encodes one variant at a time. Only sources referenced by
  // templates are read: no folder scan, network input, AVIF or unbounded Promise.all.
  sharp.concurrency(1);

  async function readSource(source) {
    let root;
    let filename;
    try {
      root = await fs.realpath(imageRoot);
      filename = await fs.realpath(path.join(inputDir, source.slice(1)));
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw notFound(source, error);
      throw error;
    }
    if (!filename.startsWith(`${root}${path.sep}`)) throw new Error(`Image escapes source directory: ${source}`);
    // Case-insensitive file systems (macOS default) resolve a wrongly cased path
    // that case-sensitive CI/hosting rejects; fail the same way everywhere.
    const actual = path.relative(root, filename).split(path.sep).join('/').normalize('NFC');
    const requested = source.slice('/images/'.length).normalize('NFC');
    if (actual !== requested && actual.toLowerCase() === requested.toLowerCase()) throw notFound(source);
    const stat = await fs.stat(filename);
    if (!stat.isFile()) throw notFound(source);
    if (stat.size > MAX_SOURCE_BYTES) throw new Error(`Image exceeds 20 MiB source budget: ${source}`);
    const buffer = await fs.readFile(filename);
    if (/\.svg$/i.test(source) && !isSelfContainedSvg(buffer.toString())) {
      throw new Error(`SVG must be self-contained: ${source}`);
    }
    return buffer;
  }

  async function inspect(buffer, source) {
    const info = await sharp(buffer, INPUT_OPTIONS).metadata();
    if ((info.pages || 1) !== 1) throw new Error(`Animated images are not supported: ${source}`);
    const width = info.autoOrient ? info.autoOrient.width
      : ([5, 6, 7, 8].includes(info.orientation) ? info.height : info.width);
    const transparent = info.hasAlpha && !(await sharp(buffer, INPUT_OPTIONS).stats()).isOpaque;
    return { width, format: transparent || info.format === 'svg' ? 'png' : 'jpeg' };
  }

  async function encode(buffer, destination, resize, format, options) {
    const pipeline = sharp(buffer, INPUT_OPTIONS).autoOrient().resize(resize)[format](options);
    await fs.mkdir(assetDir, { recursive: true });
    // Unique per process and write: concurrent builds sharing an output directory
    // never write, rename or delete each other's partial files.
    const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let renamed = false;
    try {
      const info = await pipeline.toFile(temporary);
      await fs.rename(temporary, destination);
      renamed = true;
      return info;
    } finally {
      if (!renamed) await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function variant(buffer, id, width, format, resize, options) {
    const filename = `${id}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
    const destination = path.join(assetDir, filename);
    let info;
    try {
      info = await sharp(destination, INPUT_OPTIONS).metadata();
    } catch {
      // Rebuild missing cache entries from the original source.
      info = await encode(buffer, destination, resize, format, options);
    }
    return { url: `/assets/images/${filename}`, width: info.width, height: info.height,
      type: `image/${format}` };
  }

  async function responsive(source) {
    const buffer = await readSource(source);
    const { width: originalWidth, format } = await inspect(buffer, source);
    const widths = [...new Set(WIDTHS.map((width) => Math.min(width, originalWidth)))];
    const id = `${stem(source)}-${digest(recipe, source, buffer)}`;
    const metadata = { webp: [], fallback: [] };
    for (const width of widths) {
      const resize = { width, withoutEnlargement: true };
      metadata.webp.push(await variant(buffer, id, width, 'webp', resize, ENCODERS.webp));
      metadata.fallback.push(await variant(buffer, id, width, format, resize, ENCODERS[format]));
    }
    return metadata;
  }

  async function social(source) {
    const buffer = await readSource(source);
    const { width: originalWidth, format } = await inspect(buffer, source);
    const width = Math.min(SOCIAL_RECIPE.source.maxWidth, originalWidth);
    const id = `${stem(source)}-social-${digest(SOCIAL_KEY, 'source', source, buffer)}`;
    return variant(buffer, id, width, format, { width, withoutEnlargement: true }, SOCIAL_RECIPE[format]);
  }

  async function brand() {
    const buffer = await readSource(BRAND_SOURCE);
    const { width, height, fit, withoutEnlargement, background, format } = SOCIAL_RECIPE.brand;
    const id = `social-default-${digest(SOCIAL_KEY, 'brand', BRAND_SOURCE, buffer)}`;
    return variant(buffer, id, width, format, { width, height, fit, withoutEnlargement, background },
      SOCIAL_RECIPE[format]);
  }

  function drain() {
    while (active < WORKERS && queue.length) {
      const { job, resolve, reject } = queue.shift();
      active++;
      job().then(resolve, reject).finally(() => { active--; drain(); });
    }
  }

  function schedule(kind, source, job) {
    const key = `${kind}\0${source}`;
    if (!pending.has(key)) {
      if (!referenced.has(source)) {
        if (referenced.size >= MAX_IMAGES) {
          throw new Error(`Responsive image budget exceeded: ${referenced.size + 1} referenced sources`
            + ` (limit ${MAX_IMAGES}). Raise MAX_IMAGES in lib/responsive-images.js if intended.`);
        }
        referenced.add(source);
      }
      const promise = new Promise((resolve, reject) => {
        queue.push({ job: () => job(source), resolve, reject });
      }).catch((error) => {
        // Failed entries are retried by later references instead of cached.
        if (pending.get(key) === promise) pending.delete(key);
        throw error;
      });
      pending.set(key, promise);
      drain();
    }
    return pending.get(key);
  }

  async function get(source) {
    validate(source);
    return schedule('responsive', source, responsive);
  }

  return {
    get,
    async shortcode(source, alt = '', mode = 'card', eager = false) {
      if (!source) return '';
      return renderPicture(await get(source), alt, mode, eager);
    },
    async socialImageMeta(source, alt) {
      const text = typeof alt === 'string' ? alt.trim() : '';
      if (!source) return { ...await schedule('brand', BRAND_SOURCE, brand), alt: text || DEFAULT_SOCIAL_ALT };
      validate(source);
      return { ...await schedule('social', source, social), alt: text };
    },
    async imageThumbnail(source) {
      if (!source) return null;
      return thumbnail(await get(source));
    },
    reset() { pending.clear(); referenced.clear(); },
  };
}

// Eleventy 3.1's Nunjucks adapter for addAsyncFilter never passes a rejection to
// Nunjucks' callback: a missing image would become an unhandled rejection instead
// of a failed render. Re-register only the Nunjucks variant so errors fail builds;
// Liquid and JavaScript templates (`await this.name()`) keep addAsyncFilter's.
function addAsyncFilter(eleventyConfig, name, callback) {
  eleventyConfig.addAsyncFilter(name, callback);
  eleventyConfig.addNunjucksAsyncFilter?.(name, function (...args) {
    const done = args.pop();
    Promise.resolve().then(() => callback.apply(this, args)).then((value) => done(null, value), done);
  });
}

function register(eleventyConfig, options = {}) {
  let service;
  const current = () => (service ||= createImageService(options));
  // Eleventy resolves CLI/API directory overrides before this event. Every build
  // (including watch rebuilds) gets a fresh service for its effective paths, so
  // changed sources are re-read and removed variants recreated on demand.
  eleventyConfig.on('eleventy.before', ({ directories, dir } = {}) => {
    const effective = directories || dir || {};
    const inputDir = effective.input || options.inputDir || path.join(__dirname, '../src');
    const outputDir = effective.output || options.outputDir || path.join(__dirname, '../_site');
    service = createImageService({ ...options, inputDir, outputDir });
    eleventyConfig.addWatchTarget(path.join(inputDir, 'images'));
  });
  eleventyConfig.addNunjucksAsyncShortcode('responsiveImage', (...args) => current().shortcode(...args));
  addAsyncFilter(eleventyConfig, 'socialImageMeta', (source, alt) => current().socialImageMeta(source, alt));
  addAsyncFilter(eleventyConfig, 'imageThumbnail', (source) => current().imageThumbnail(source));
  return {
    get: (...args) => current().get(...args),
    shortcode: (...args) => current().shortcode(...args),
    socialImageMeta: (...args) => current().socialImageMeta(...args),
    imageThumbnail: (...args) => current().imageThumbnail(...args),
    reset: () => current().reset(),
  };
}

module.exports = { WIDTHS, SIZES, MAX_IMAGES, SOCIAL_RECIPE, DEFAULT_SOCIAL_ALT, createImageService,
  renderPicture, register };
