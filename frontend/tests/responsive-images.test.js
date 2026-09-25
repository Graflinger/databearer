const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const nunjucks = require('nunjucks');
const matter = require('gray-matter');
const { execFileSync } = require('node:child_process');
const { MAX_IMAGES, SIZES, createImageService, renderPicture, register } = require('../lib/responsive-images');

const root = path.resolve(__dirname, '..');
const source = '/images/blog_card_images/2026/windenergie3.png';
const notFound = (value) => `Image not found: ${value}. Expected a file under src/images (check path, letter case`
  + ' and Unicode normalization). Supported: png, jpg, jpeg, webp, svg.';
let temporary;
let service;
let metadata;
let inputDir; // small generated sources, isolated from src/images

beforeAll(async () => {
  // Never inside the real _site: all output goes to an OS temporary directory.
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'databearer-images-'));
  service = createImageService({ outputDir: temporary });
  metadata = await service.get(source);
  inputDir = path.join(temporary, 'input');
  const images = path.join(inputDir, 'images');
  await fs.mkdir(path.join(images, 'folder.png'), { recursive: true });
  await fs.copyFile(path.join(root, 'src/images/logo_big.png'), path.join(images, 'logo_big.png'));
  await sharp({ create: { width: 1500, height: 844, channels: 3, background: '#2a6f97' } })
    .jpeg().toFile(path.join(images, 'photo.jpg'));
  await sharp({ create: { width: 100, height: 60, channels: 4, background: { r: 200, g: 100, b: 0, alpha: 0.5 } } })
    .png().toFile(path.join(images, 'Tiny.png'));
  await fs.writeFile(path.join(images, 'drawing.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#fc0"/></svg>');
}, 30000);

afterAll(async () => { if (temporary) await fs.rm(temporary, { recursive: true, force: true }); });

function outputPath(item, base = temporary) { return path.join(base, item.url || item); }

async function expectMeasured(item, base) {
  const info = await sharp(outputPath(item, base)).metadata();
  expect({ width: item.width, height: item.height, type: item.type })
    .toEqual({ width: info.width, height: info.height, type: item.type && `image/${info.format}` });
}

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
  const images = createImageService({ inputDir, outputDir: temporary });
  const tiny = await images.get('/images/Tiny.png');
  expect(tiny.webp).toHaveLength(1);
  expect(tiny.fallback).toHaveLength(1);
  expect(tiny.fallback[0]).toMatchObject({ width: 100, height: 60, type: 'image/png' });
  expect((await sharp(outputPath(tiny.fallback[0])).metadata()).hasAlpha).toBe(true);
  expect(await images.imageThumbnail('/images/Tiny.png')).toEqual({
    src: tiny.fallback[0].url, srcset: `${tiny.fallback[0].url} 100w`, webpSrcset: `${tiny.webp[0].url} 100w`,
    sizes: SIZES.card, width: 100, height: 60,
  });
});

test('missing optional images render nothing; unsafe and missing references fail clearly', async () => {
  const images = createImageService({ inputDir, outputDir: temporary });
  expect(await images.shortcode(undefined)).toBe('');
  expect(await images.imageThumbnail('')).toBeNull();
  for (const unsafe of ['https://example.com/image.png', '/images/../../package.json', '/images/x.gif']) {
    await expect(images.get(unsafe)).rejects.toThrow('Expected a local /images/ raster or SVG path');
    await expect(images.socialImageMeta(unsafe)).rejects.toThrow('Expected a local /images/ raster or SVG path');
  }
  await expect(images.get('/images/missing.png')).rejects.toThrow(notFound('/images/missing.png'));
  await expect(images.socialImageMeta('/images/missing.png')).rejects.toThrow(notFound('/images/missing.png'));
  await expect(images.get('/images/photo.jpg/x.png')).rejects.toThrow(notFound('/images/photo.jpg/x.png'));
  await expect(images.get('/images/folder.png')).rejects.toThrow(notFound('/images/folder.png'));
  // Wrong letter case fails on case-insensitive local file systems as on CI/hosting.
  await expect(images.imageThumbnail('/images/tiny.png')).rejects.toThrow(notFound('/images/tiny.png'));
});

describe('self-contained SVG references', () => {
  let svgService;
  let svgInput;
  let sequence = 0;
  beforeAll(async () => {
    svgInput = path.join(temporary, 'svg-fixtures');
    await fs.mkdir(path.join(svgInput, 'images'), { recursive: true });
    svgService = createImageService({ inputDir: svgInput, outputDir: path.join(temporary, 'svg-output') });
  });
  async function generate(reference) {
    const svg = `/images/reference-${sequence++}.svg`;
    await fs.writeFile(path.join(svgInput, svg), `<svg xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="10">
      <defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient>
      <rect id="shape" width="20" height="10"/></defs>${reference}</svg>`);
    return svgService.get(svg);
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

describe('lazy social metadata and thumbnails', () => {
  let outputDir;
  let images;
  beforeAll(() => {
    outputDir = path.join(temporary, 'social-output');
    images = createImageService({ inputDir, outputDir });
  });

  test('default brand preview is a measured 1200x630 JPEG with logo alt unless alt is given', async () => {
    const fallback = await images.socialImageMeta();
    expect(fallback).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg', alt: 'Databearer-Logo' });
    expect(fallback.url).toMatch(/^\/assets\/images\/social-default-[a-f0-9]{16}-1200\.jpg$/);
    await expectMeasured(fallback, outputDir);
    expect(await images.socialImageMeta('', '  ')).toEqual(fallback);
    expect(await images.socialImageMeta(null, 'Eigene Beschreibung')).toEqual({ ...fallback, alt: 'Eigene Beschreibung' });
  });

  test('source previews use the largest fallback up to 1200w, measured, with explicit or empty alt', async () => {
    const photo = await images.socialImageMeta('/images/photo.jpg');
    expect(photo).toMatchObject({ width: 1200, height: 675, type: 'image/jpeg', alt: '' });
    await expectMeasured(photo, outputDir);
    expect(await images.socialImageMeta('/images/photo.jpg', 'Blaue Fläche')).toEqual({ ...photo, alt: 'Blaue Fläche' });
    const drawing = await images.socialImageMeta('/images/drawing.svg', 'Gelbe Fläche');
    expect(drawing).toMatchObject({ width: 960, height: 540, type: 'image/png', alt: 'Gelbe Fläche' });
    await expectMeasured(drawing, outputDir);
    expect(await images.socialImageMeta('/images/Tiny.png')).toMatchObject({ width: 100, height: 60, type: 'image/png' });
    // Social-only references generate exactly one file, no responsive set.
    const files = await fs.readdir(path.join(outputDir, 'assets/images'));
    expect(files.filter((name) => name.startsWith('drawing-'))).toEqual([path.basename(drawing.url)]);
  });

  test('imageThumbnail returns card candidates up to 720w with the smallest fallback as src', async () => {
    const thumb = await images.imageThumbnail('/images/photo.jpg');
    expect(Object.keys(thumb).sort()).toEqual(['height', 'sizes', 'src', 'srcset', 'webpSrcset', 'width']);
    expect(thumb.sizes).toBe(SIZES.card);
    await expectMeasured({ url: thumb.src, width: thumb.width, height: thumb.height }, outputDir);
    expect(thumb.width).toBe(360);
    for (const [set, format] of [[thumb.srcset, 'jpeg'], [thumb.webpSrcset, 'webp']]) {
      const candidates = set.split(', ').map((candidate) => candidate.split(' '));
      expect(candidates.map(([, width]) => width)).toEqual(['360w', '720w']);
      for (const [url, width] of candidates) {
        const info = await sharp(outputPath(url, outputDir)).metadata();
        expect([`${info.width}w`, info.format]).toEqual([width, format]);
      }
    }
    expect(thumb.srcset.split(', ')[0]).toBe(`${thumb.src} 360w`);
  });

  test('social URLs ignore encoder versions; responsive variant URLs include them', async () => {
    const make = (sharpVersions) => createImageService({ inputDir, outputDir, sharpVersions });
    const before = make({ sharp: '0.34.5', vips: '8.17.3' });
    const after = make({ sharp: '0.35.0', vips: '8.18.0' });
    const urls = (set) => [...set.webp, ...set.fallback].map((item) => item.url);
    const [old, upgraded] = [urls(await before.get('/images/Tiny.png')), urls(await after.get('/images/Tiny.png'))];
    expect(old.every((url, index) => url !== upgraded[index])).toBe(true);
    for (const reference of [undefined, '/images/photo.jpg', '/images/drawing.svg']) {
      const stable = await before.socialImageMeta(reference);
      expect(await after.socialImageMeta(reference)).toEqual(stable);
      expect(await images.socialImageMeta(reference)).toEqual(stable); // real sharp.versions
    }
  });
});

test('temporary files are unique per write and removed when a write fails', async () => {
  const outputDir = path.join(temporary, 'temporary-output');
  const rename = jest.spyOn(fs, 'rename');
  try {
    // Two builds racing on one output directory each write their own temporary files.
    const [first, second] = await Promise.all([1, 2].map(() => createImageService({ inputDir, outputDir })
      .get('/images/Tiny.png')));
    expect(first).toEqual(second);
    const temporaries = rename.mock.calls.map(([from]) => from);
    expect(temporaries.length).toBeGreaterThanOrEqual(2);
    for (const name of temporaries) {
      expect(name).toMatch(new RegExp(`\\.(png|webp)\\.${process.pid}\\.[0-9a-f]{8}-[0-9a-f-]{27}\\.tmp$`));
    }
    expect(new Set(temporaries).size).toBe(temporaries.length);
    rename.mockClear();
    rename.mockRejectedValueOnce(new Error('simulated rename failure'));
    await expect(createImageService({ inputDir, outputDir }).socialImageMeta('/images/photo.jpg'))
      .rejects.toThrow('simulated rename failure');
    await expect(fs.stat(rename.mock.calls[0][0])).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    rename.mockRestore();
  }
  expect((await fs.readdir(path.join(outputDir, 'assets/images'))).filter((name) => name.endsWith('.tmp'))).toEqual([]);
});

test('budget counts distinct referenced sources across helpers, not files on disk', async () => {
  expect(MAX_IMAGES).toBe(256);
  const images = createImageService({ inputDir, outputDir: path.join(temporary, 'budget-output') });
  const references = [];
  for (let index = 0; index < MAX_IMAGES; index++) {
    const missing = `/images/missing-${index}.png`;
    references.push(images.get(missing), images.imageThumbnail(missing), images.socialImageMeta(missing));
  }
  await expect(images.socialImageMeta('/images/photo.jpg')).rejects.toThrow('Responsive image budget exceeded: '
    + '257 referenced sources (limit 256). Raise MAX_IMAGES in lib/responsive-images.js if intended.');
  const failures = await Promise.allSettled(references);
  expect(failures.every((result) => result.status === 'rejected' && /Image not found/.test(result.reason.message))).toBe(true);
  // Each build gets a fresh service/budget; reset() models that.
  images.reset();
  await expect(images.socialImageMeta('/images/photo.jpg')).resolves.toMatchObject({ width: 1200 });
});

describe('real Eleventy fixture build', () => {
  let workspace;
  let report;
  const output = (url) => path.join(workspace, 'custom-output', url);
  beforeAll(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'databearer-image-build-'));
    execFileSync(process.execPath, [path.join(__dirname, 'fixtures/image-build.cjs'), workspace], {
      cwd: root, encoding: 'utf8', timeout: 30000, stdio: 'pipe',
    });
    report = JSON.parse(await fs.readFile(path.join(workspace, 'report.json'), 'utf8'));
  }, 30000);
  afterAll(async () => { if (workspace) await fs.rm(workspace, { recursive: true, force: true }); });

  test('unused invalid, oversized and unsupported files under images/ do not affect the build', async () => {
    expect(report.builds.success).toEqual({ ok: true });
    expect(report.builds.rebuild).toEqual({ ok: true });
    expect(report.unhandled).toEqual([]);
    const assets = await fs.readdir(output('assets/images'));
    expect(assets.filter((name) => /remote|giant|corrupt|animation|oversized/.test(name))).toEqual([]);
  });

  test('referenced missing and unsafe images fail the build with clear messages', () => {
    expect(report.builds.missing.ok).toBe(false);
    expect(report.builds.missing.message).toContain(notFound('/images/photos/missing.jpg'));
    expect(report.builds.invalid.ok).toBe(false);
    expect(report.builds.invalid.message).toContain('SVG must be self-contained: /images/unused/remote.svg');
  });

  test('Nunjucks social metadata and the hero match files recreated by the rebuild', async () => {
    document.documentElement.innerHTML = await fs.readFile(output('index.html'), 'utf8');
    const social = JSON.parse(document.getElementById('social').textContent);
    expect(social.fallback).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg', alt: 'Databearer-Logo' });
    expect(social.described).toMatchObject({ width: 1200, type: 'image/jpeg', alt: 'Blaue Testfläche' });
    expect(social.plain).toEqual({ ...social.described, alt: '' });
    for (const item of Object.values(social)) await expectMeasured(item, path.join(workspace, 'custom-output'));
    const img = document.querySelector('img');
    expect(img.getAttribute('loading')).toBe('eager');
    const urls = [img.getAttribute('src'), ...[...document.querySelectorAll('[srcset]')]
      .flatMap((node) => node.getAttribute('srcset').split(', ').map((item) => item.split(' ')[0]))];
    for (const url of urls) await expect(fs.stat(output(url))).resolves.toBeDefined();
  });

  test('JavaScript templates can await this.imageThumbnail and this.socialImageMeta', async () => {
    const result = JSON.parse(await fs.readFile(output('index.json'), 'utf8'));
    expect(result.none).toBeNull();
    expect(result.thumbnail).toMatchObject({ width: 360, height: 203, sizes: SIZES.card });
    await expectMeasured({ url: result.thumbnail.src, width: 360, height: 203 }, path.join(workspace, 'custom-output'));
    expect(result.thumbnail.webpSrcset).toMatch(/-360\.webp 360w, .+-720\.webp 720w$/);
    expect(result.social).toMatchObject({ width: 1200, height: 675, type: 'image/jpeg', alt: '' });
  });
});

// Exercise the real Nunjucks templates, async shortcode and filters, without a full site build.
function environment() {
  const env = new nunjucks.Environment(null, { autoescape: true });
  const config = {
    on: jest.fn(), addWatchTarget: jest.fn(), addAsyncFilter: jest.fn(),
    addNunjucksAsyncFilter: (name, filter) => env.addFilter(name, filter, true),
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
  expect(config.addAsyncFilter.mock.calls.map(([name]) => name)).toEqual(['socialImageMeta', 'imageThumbnail']);
  env.addFilter('localDate', () => '20. September 2026');
  env.addFilter('htmlDateString', () => '2026-09-20');
  env.addFilter('relatedPosts', (collections) => collections.post);
  return env;
}

function render(env, template, data = {}) {
  return new Promise((resolve, reject) => env.renderString(template, data,
    (error, html) => error ? reject(error) : resolve(html)));
}

async function renderTemplate(filename, data) {
  const template = matter(await fs.readFile(path.join(root, 'src/_includes', filename), 'utf8')).content;
  return render(environment(), template, data);
}

test('Nunjucks async filters resolve values and report failures to the render', async () => {
  const env = environment();
  expect(await render(env, "{% set s = '' | socialImageMeta %}{{ s.alt }} {{ s.width }}x{{ s.height }}"))
    .toBe('Databearer-Logo 1200x630');
  await expect(render(env, "{% set s = '/images/nope.png' | socialImageMeta %}{{ s.url }}"))
    .rejects.toThrow(notFound('/images/nope.png'));
});

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
