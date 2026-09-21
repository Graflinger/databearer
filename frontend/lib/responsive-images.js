const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

const WIDTHS = [360, 720, 1200, 1408];
const SIZES = {
  card: '(max-width: 768px) calc(100vw - 56px), 360px',
  full: '(max-width: 768px) calc(100vw - 56px), (max-width: 932px) calc(100vw - 56px), 874px',
  hero: '(max-width: 768px) calc(100vw - 48px), 780px',
};
const INPUT_OPTIONS = { limitInputPixels: 32 * 1024 * 1024, animated: false };
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 128;
const EXTENSIONS = /\.(png|jpe?g|webp|svg)$/i;
// Include the encoder versions and all conversion settings in disk-cache keys.
const RECIPE = JSON.stringify({ version: 1, sharp: sharp.versions, widths: WIDTHS,
  webp: { quality: 78, effort: 4 }, jpeg: { quality: 82 }, png: { compressionLevel: 9 } });

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderPicture(metadata, alt = '', mode = 'card', eager = false) {
  if (!SIZES[mode]) throw new Error(`Unknown responsive image mode: ${mode}`);
  const fallback = metadata.fallback;
  const largest = fallback[fallback.length - 1];
  const srcset = (items) => items.map((item) => `${item.url} ${item.width}w`).join(', ');
  const sizes = escapeAttribute(SIZES[mode]);
  return `<picture><source type="image/webp" srcset="${srcset(metadata.webp)}" sizes="${sizes}">`
    + `<img src="${largest.url}" srcset="${srcset(fallback)}" sizes="${sizes}"`
    + ` width="${largest.width}" height="${largest.height}" alt="${escapeAttribute(alt)}"`
    + ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture>`;
}

function socialImage(metadata, source, alt) {
  if (!metadata) throw new Error('Image metadata has not been prepared');
  if (!source) return { ...metadata.defaultSocial, alt: alt || 'Databearer – Datenjournalismus' };
  const image = metadata.images[source];
  if (!image) throw new Error(`Social image is not a prepared local image: ${source}`);
  return { ...image.social, alt: alt || 'Redaktionelle Illustration' };
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

function createImageService({
  inputDir = path.join(__dirname, '../src'),
  outputDir = path.join(__dirname, '../_site'),
} = {}) {
  inputDir = path.resolve(inputDir);
  outputDir = path.resolve(outputDir);
  const imageRoot = path.join(inputDir, 'images');
  const assetDir = path.join(outputDir, 'assets/images');
  const pending = new Map();
  const queue = [];
  let active = 0;
  let prepared;
  // Two source workers; each encodes one variant at a time. No network inputs,
  // AVIF, unbounded Promise.all, or persistent source downloads during builds.
  sharp.concurrency(1);

  async function readSource(source) {
    if (typeof source !== 'string' || !source.startsWith('/images/')
        || /[?#\\\0]/.test(source) || source.split('/').includes('..') || !EXTENSIONS.test(source)) {
      throw new Error(`Expected a local /images/ raster or SVG path: ${source}`);
    }
    const filename = await fs.realpath(path.join(inputDir, source.slice(1)));
    const root = await fs.realpath(imageRoot);
    if (!filename.startsWith(`${root}${path.sep}`)) throw new Error(`Image escapes source directory: ${source}`);
    const stat = await fs.stat(filename);
    if (stat.size > MAX_SOURCE_BYTES) throw new Error(`Image exceeds 20 MiB source budget: ${source}`);
    const buffer = await fs.readFile(filename);
    if (/\.svg$/i.test(source) && !isSelfContainedSvg(buffer.toString())) {
      throw new Error(`SVG must be self-contained: ${source}`);
    }
    return buffer;
  }

  function identity(source, buffer) {
    const stem = path.basename(source, path.extname(source)).normalize('NFKD')
      .replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60);
    const hash = createHash('sha256').update(RECIPE).update(source).update(buffer).digest('hex').slice(0, 16);
    return `${stem}-${hash}`;
  }

  async function variant(buffer, id, width, format, branded = false) {
    const filename = `${id}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
    const destination = path.join(assetDir, filename);
    let info;
    try {
      info = await sharp(destination, INPUT_OPTIONS).metadata();
    } catch (error) {
      // Rebuild missing or interrupted cache entries from the original source.
      let pipeline = sharp(buffer, INPUT_OPTIONS).autoOrient();
      if (branded) {
        pipeline = pipeline.resize({ width: 1200, height: 630, fit: 'contain',
          withoutEnlargement: true, background: '#141824' });
      } else {
        pipeline = pipeline.resize({ width, withoutEnlargement: true });
      }
      if (format === 'webp') pipeline = pipeline.webp({ quality: 78, effort: 4 });
      else if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 82 });
      else pipeline = pipeline.png({ compressionLevel: 9 });
      await fs.mkdir(assetDir, { recursive: true });
      const temporary = `${destination}.tmp`;
      info = await pipeline.toFile(temporary);
      await fs.rename(temporary, destination);
    }
    return { url: `/assets/images/${filename}`, width: info.width, height: info.height,
      type: `image/${format}` };
  }

  async function generate(source) {
    const buffer = await readSource(source);
    const info = await sharp(buffer, INPUT_OPTIONS).metadata();
    if ((info.pages || 1) !== 1) throw new Error(`Animated images are not supported: ${source}`);
    const originalWidth = info.autoOrient ? info.autoOrient.width
      : ([5, 6, 7, 8].includes(info.orientation) ? info.height : info.width);
    const widths = [...new Set(WIDTHS.map((width) => Math.min(width, originalWidth)))];
    const id = identity(source, buffer);
    const transparent = info.hasAlpha && !(await sharp(buffer, INPUT_OPTIONS).stats()).isOpaque;
    const fallbackFormat = transparent || info.format === 'svg' ? 'png' : 'jpeg';
    const metadata = { webp: [], fallback: [] };
    for (const width of widths) {
      metadata.webp.push(await variant(buffer, id, width, 'webp'));
      metadata.fallback.push(await variant(buffer, id, width, fallbackFormat));
    }
    metadata.social = metadata.fallback.filter((item) => item.width <= 1200).slice(-1)[0];
    return metadata;
  }

  function drain() {
    while (active < 2 && queue.length) {
      const { source, resolve, reject } = queue.shift();
      active++;
      generate(source).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }

  function get(source) {
    if (!pending.has(source)) {
      if (pending.size >= MAX_IMAGES) throw new Error('Responsive image budget exceeded (128 sources)');
      pending.set(source, new Promise((resolve, reject) => {
        queue.push({ source, resolve, reject });
      }).catch((error) => { pending.delete(source); throw error; }));
      drain();
    }
    return pending.get(source);
  }

  async function listSources(directory = imageRoot) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const sources = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) sources.push(...await listSources(filename));
      else if (EXTENSIONS.test(entry.name)) sources.push(`/${path.relative(inputDir, filename).split(path.sep).join('/')}`);
      if (sources.length > MAX_IMAGES) throw new Error('Responsive image budget exceeded (128 sources)');
    }
    return sources;
  }

  async function prepare() {
    const sources = await listSources();
    const images = {};
    let index = 0;
    await Promise.all([0, 1].map(async () => {
      while (index < sources.length) {
        const source = sources[index++];
        images[source] = await get(source);
      }
    }));
    const logo = await readSource('/images/logo_big.png');
    const defaultSocial = await variant(logo, identity('/social-default.png', logo), 1200, 'jpeg', true);
    return { images, defaultSocial };
  }

  return {
    get,
    prepare() {
      if (!prepared) prepared = prepare();
      return prepared;
    },
    reset() { pending.clear(); prepared = undefined; },
    async shortcode(source, alt = '', mode = 'card', eager = false) {
      if (!source) return '';
      return renderPicture(await get(source), alt, mode, eager);
    },
  };
}

function register(eleventyConfig, options = {}) {
  let service;
  const current = () => (service ||= createImageService(options));
  // Eleventy resolves CLI/API directory overrides before this event, then
  // evaluates global data while writing templates. Use closures so every watch
  // build's metadata and shortcodes share its new service and effective paths.
  eleventyConfig.on('eleventy.before', async ({ directories, dir } = {}) => {
    const effective = directories || dir || {};
    const inputDir = effective.input || options.inputDir || path.join(__dirname, '../src');
    const outputDir = effective.output || options.outputDir || path.join(__dirname, '../_site');
    service = createImageService({ ...options, inputDir, outputDir });
    eleventyConfig.addWatchTarget(path.join(inputDir, 'images'));
    // Global data may be cached on repeated programmatic builds. Always ensure
    // social-only assets exist, even when no responsive shortcode requests them.
    if (directories || dir) await service.prepare();
  });
  eleventyConfig.addGlobalData('imageMetadata', () => current().prepare());
  eleventyConfig.addFilter('socialImage', socialImage);
  eleventyConfig.addNunjucksAsyncShortcode('responsiveImage', (...args) => current().shortcode(...args));
  return {
    get: (...args) => current().get(...args),
    prepare: () => current().prepare(),
    shortcode: (...args) => current().shortcode(...args),
    reset: () => current().reset(),
  };
}

module.exports = { WIDTHS, SIZES, createImageService, renderPicture, socialImage, register };
