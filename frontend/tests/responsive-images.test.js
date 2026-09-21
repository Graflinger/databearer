const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const nunjucks = require('nunjucks');
const matter = require('gray-matter');
const { execFileSync } = require('node:child_process');
const { createImageService, renderPicture, socialImage, register } = require('../lib/responsive-images');

const root = path.resolve(__dirname, '..');
const source = '/images/blog_card_images/2026/windenergie3.png';
let temporary;
let service;
let metadata;

beforeAll(async () => {
  await fs.mkdir(path.join(root, '_site'), { recursive: true });
  temporary = await fs.mkdtemp(path.join(root, '_site/image-test-'));
  service = createImageService({ outputDir: temporary });
  metadata = await service.get(source);
}, 30000);

afterAll(async () => { await fs.rm(temporary, { recursive: true, force: true }); });

function outputPath(item) { return path.join(temporary, item.url); }

test('actual local PNG produces smaller, correctly sized raster variants without upscaling', async () => {
  const original = await sharp(path.join(root, 'src', source)).metadata();
  const originalSize = (await fs.stat(path.join(root, 'src', source))).size;
  expect(metadata.webp.map((item) => item.width))
    .toEqual([...new Set([360, 720, 1200, 1408].map((width) => Math.min(width, original.width)))]);
  for (const item of [...metadata.webp, ...metadata.fallback]) {
    const output = await sharp(outputPath(item)).metadata();
    expect(output.width).toBe(item.width);
    expect(output.height).toBe(item.height);
    expect(output.width).toBeLessThanOrEqual(original.width);
    expect(output.height / output.width).toBeCloseTo(original.height / original.width, 2);
  }
  const webpSize = (await fs.stat(outputPath(metadata.webp[1]))).size;
  const fallbackSize = (await fs.stat(outputPath(metadata.fallback[1]))).size;
  expect(webpSize).toBeLessThan(originalSize / 3);
  expect(fallbackSize).toBeLessThan(originalSize / 3);
  expect(metadata.fallback[0].type).toBe('image/jpeg');
  console.info(`Image smoke: original ${originalSize} B; 720w WebP ${webpSize} B; JPEG ${fallbackSize} B`);
});

test('picture attributes carry real dimensions, escaped optional alt, sizes and priority', () => {
  document.body.innerHTML = renderPicture(metadata, 'Illustration: "Wind" & <Strom>', 'hero', true);
  const img = document.querySelector('img');
  const largest = metadata.fallback.slice(-1)[0];
  expect(img.getAttribute('alt')).toBe('Illustration: "Wind" & <Strom>');
  expect(img.getAttribute('width')).toBe(String(largest.width));
  expect(img.getAttribute('height')).toBe(String(largest.height));
  expect(img.getAttribute('decoding')).toBe('async');
  expect(img.getAttribute('loading')).toBe('eager');
  expect(img.getAttribute('fetchpriority')).toBe('high');
  expect(img.getAttribute('srcset')).toContain('720w');
  expect(img.getAttribute('sizes')).toContain('768px');
  expect(document.querySelector('source').getAttribute('type')).toBe('image/webp');
  document.body.innerHTML = renderPicture(metadata);
  expect(document.querySelector('img').getAttribute('alt')).toBe('');
  expect(document.querySelector('img').getAttribute('loading')).toBe('lazy');
  expect(document.querySelector('img').hasAttribute('fetchpriority')).toBe(false);
});

test('disk cache reuses deterministic URLs and output bytes across service instances', async () => {
  const item = metadata.webp[0];
  const before = await fs.stat(outputPath(item));
  const bytes = await fs.readFile(outputPath(item));
  const second = createImageService({ outputDir: temporary });
  expect(await second.get(source)).toEqual(metadata);
  expect((await fs.stat(outputPath(item))).mtimeMs).toBe(before.mtimeMs);
  expect(await fs.readFile(outputPath(item))).toEqual(bytes);
  // A clean rebuild is byte-for-byte reproducible, too.
  await fs.unlink(outputPath(item));
  second.reset();
  await second.get(source);
  expect(await fs.readFile(outputPath(item))).toEqual(bytes);
});

test('tiny transparent input preserves alpha and never duplicates or enlarges widths', async () => {
  const inputDir = path.join(temporary, 'fixture');
  await fs.mkdir(path.join(inputDir, 'images'), { recursive: true });
  await sharp({ create: { width: 100, height: 60, channels: 4,
    background: { r: 200, g: 100, b: 0, alpha: 0.5 } } }).png().toFile(path.join(inputDir, 'images/tiny.png'));
  const tiny = await createImageService({ inputDir, outputDir: temporary }).get('/images/tiny.png');
  expect(tiny.webp).toHaveLength(1);
  expect(tiny.fallback).toHaveLength(1);
  expect(tiny.fallback[0]).toMatchObject({ width: 100, height: 60, type: 'image/png' });
  expect((await sharp(outputPath(tiny.fallback[0])).metadata()).hasAlpha).toBe(true);
});

test('missing optional images render nothing; remote, escaping, and nonexistent sources fail', async () => {
  expect(await service.shortcode(undefined)).toBe('');
  await expect(service.get('https://example.com/image.png')).rejects.toThrow('local');
  await expect(service.get('/images/../../package.json')).rejects.toThrow('local');
  await expect(service.get('/images/missing.png')).rejects.toThrow();
});

describe('self-contained SVG references', () => {
  let svgService;
  let inputDir;
  let sequence = 0;
  beforeAll(async () => {
    inputDir = path.join(temporary, 'svg-fixtures');
    await fs.mkdir(path.join(inputDir, 'images'), { recursive: true });
    svgService = createImageService({ inputDir, outputDir: path.join(temporary, 'svg-output') });
  });
  async function generate(reference) {
    const source = `/images/reference-${sequence++}.svg`;
    await fs.writeFile(path.join(inputDir, source), `<svg xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="10">
      <defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient>
      <rect id="shape" width="20" height="10"/></defs>${reference}</svg>`);
    return svgService.get(source);
  }

  test.each([
    `<rect width="20" height="10" style="fill:url('#paint')"/>`,
    `<rect width="20" height="10" style='fill:url("#paint")'/>`,
    `<rect width="20" height="10" style="fill:url(#paint)"/>`,
    `<rect width="20" height="10" style="fill:url(  '#paint'  )"/>`,
    `<rect width="20" height="10" style='fill:url(  "#paint"  )'/>`,
    `<rect width="20" height="10" style="fill:url(  #paint  )"/>`,
    `<use href="#shape"/>`,
    `<use xlink:href='  #shape  '/>`,
  ])('accepts local fragments: %s', async (reference) => {
    const result = await generate(reference);
    expect(result.fallback[0]).toMatchObject({ width: 20, height: 10, type: 'image/png' });
  });

  test.each([
    `<rect style="fill:url('https://example.org/paint.svg#paint')"/>`,
    `<rect style='fill:url( "//example.org/paint.svg#paint" )'/>`,
    `<rect style="fill:url( ../paint.svg#paint )"/>`,
    `<rect style="fill:url(data:image/svg+xml;base64,AAAA)"/>`,
    `<rect style="fill:url('file:///tmp/paint.svg#paint')"/>`,
    `<use href="https://example.org/shape.svg#shape"/>`,
    `<use xlink:href=' data:image/svg+xml;base64,AAAA '/>`,
    `<use href="../shape.svg#shape"/>`,
    `<use href=https://example.org/shape.svg#shape />`,
    `<rect style="fill:url(' #paint external ')"/>`,
  ])('rejects non-fragment references before conversion: %s', async (reference) => {
    await expect(generate(reference)).rejects.toThrow('SVG must be self-contained');
  });
});

test('offline preparation rasterizes SVG and provides a branded social default synchronously', async () => {
  const prepared = await service.prepare();
  const dashboard = socialImage(prepared, '/images/dashboards/strommarkt-deutschland.svg', 'Illustration zum Strommarkt');
  expect(dashboard).toMatchObject({ width: 960, height: 540, type: 'image/png', alt: 'Illustration zum Strommarkt' });
  expect(dashboard.url).toMatch(/^\/assets\/images\/strommarkt-deutschland-[a-f0-9]+-960\.png$/);
  const fallback = socialImage(prepared);
  expect(fallback).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg', alt: 'Databearer – Datenjournalismus' });
  expect((await sharp(outputPath(fallback)).metadata()).width).toBe(1200);
  expect(socialImage(prepared, source).alt).toBe('Redaktionelle Illustration');
  expect(() => socialImage(prepared, '/images/missing.png')).toThrow('not a prepared local image');
}, 60000);

test('real Eleventy custom input/output and rebuild publish assets before rendering social metadata', async () => {
  execFileSync(process.execPath, [path.join(__dirname, 'fixtures/image-build.cjs'), temporary], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  const output = path.join(temporary, 'custom-output');
  document.documentElement.innerHTML = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  const social = document.querySelector('meta[property="og:image"]').content;
  expect(social).toMatch(/^\/assets\/images\/social-default-/);
  const info = await sharp(path.join(output, social)).metadata();
  expect(info).toMatchObject({ width: 1200, height: 630, format: 'jpeg' });
  expect(document.querySelector('meta[property="og:image:width"]').content).toBe(String(info.width));
  expect(document.querySelector('meta[property="og:image:height"]').content).toBe(String(info.height));
  const img = document.querySelector('img');
  expect(img.getAttribute('loading')).toBe('eager');
  const urls = [img.getAttribute('src'), ...[...document.querySelectorAll('[srcset]')]
    .flatMap((node) => node.getAttribute('srcset').split(', ').map((item) => item.split(' ')[0]))];
  for (const url of urls) await expect(fs.stat(path.join(output, url))).resolves.toBeDefined();
}, 30000);

// Exercise the real Nunjucks templates and async shortcode, without a full site build.
function environment() {
  const env = new nunjucks.Environment(null, { autoescape: true });
  const config = {
    on: jest.fn(), addWatchTarget: jest.fn(), addGlobalData: jest.fn(),
    addFilter: (name, filter) => env.addFilter(name, filter),
    addNunjucksAsyncShortcode(name, callback) {
      const extension = {
        tags: [name],
        parse(parser, nodes) {
          const token = parser.nextToken();
          const args = parser.parseSignature(true, true) || new nodes.NodeList(token.lineno, token.colno);
          parser.advanceAfterBlockEnd(token.value);
          return new nodes.CallExtensionAsync(this, 'run', args);
        },
        run(context, ...args) {
          const done = args.pop();
          callback(...args).then((html) => done(null, new nunjucks.runtime.SafeString(html)), done);
        },
      };
      env.addExtension(name, extension);
    },
  };
  register(config, { outputDir: temporary });
  expect(config.addGlobalData).toHaveBeenCalledWith('imageMetadata', expect.any(Function));
  env.addFilter('localDate', () => '20. September 2026');
  env.addFilter('htmlDateString', () => '2026-09-20');
  env.addFilter('relatedPosts', (collections) => collections.post);
  return env;
}

async function renderTemplate(filename, data) {
  const template = matter(await fs.readFile(path.join(root, 'src/_includes', filename), 'utf8')).content;
  return new Promise((resolve, reject) => environment().renderString(template, data,
    (error, html) => error ? reject(error) : resolve(html)));
}

const post = { url: '/posts/example/', data: { image: source, title: 'Ein Beitrag', date: '2026-09-20' } };

test('listing renders first card eager, later cards lazy and missing images without broken img', async () => {
  document.body.innerHTML = await renderTemplate('all_posts.njk', {
    pagination: { items: [post, post, { url: '/missing/', data: { title: 'Ohne Bild' } }], href: {} },
  });
  const images = [...document.querySelectorAll('img')];
  expect(images).toHaveLength(2);
  expect(images.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'lazy']);
  expect(images.every((img) => img.getAttribute('alt') === '')).toBe(true);
});

test('article has eager hero, byline, slash-terminated topics and guarded lazy related images', async () => {
  document.body.innerHTML = await renderTemplate('post.njk', {
    ...post.data, topic: ['energie'], imageAlt: 'Illustration mit Windrädern',
    site: { author: 'Stefan Graf' }, page: {}, collections: { post: [post, { data: { title: 'Ohne Bild' } }] },
  });
  const hero = document.querySelector('.post-header-image img');
  expect(hero.getAttribute('loading')).toBe('eager');
  expect(hero.getAttribute('alt')).toBe('Illustration mit Windrädern');
  expect(document.querySelector('a[rel="author"]').getAttribute('href')).toBe('/about/');
  expect([...document.querySelectorAll('a[href^="/themen/"]')].every((a) => a.getAttribute('href') === '/themen/energie/')).toBe(true);
  expect(document.querySelectorAll('.related-posts img')).toHaveLength(1);
  expect(document.querySelector('.related-posts img').getAttribute('loading')).toBe('lazy');
});
