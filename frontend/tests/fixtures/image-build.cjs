// Real Eleventy builds for the lazy image service, isolated in a temporary
// workspace: custom input/output overrides, a rebuild after removed assets,
// Nunjucks and JavaScript template filters, unused invalid sources that must be
// ignored, and referenced failures. Writes <workspace>/report.json.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { register } = require('../../lib/responsive-images');

const workspace = path.resolve(process.argv[2]);
const report = { builds: {}, unhandled: [] };
// The Nunjucks filter override must turn failures into render errors, never
// unhandled rejections (which would crash or hang instead of failing cleanly).
process.on('unhandledRejection', (error) => { report.unhandled.push(String(error && error.stack || error)); });

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

function messages(error) {
  const parts = [];
  for (let current = error; current && parts.length < 10; current = current.originalError || current.cause) {
    parts.push(String(current.message));
  }
  return parts.join('\n');
}

async function eleventy(input, output) {
  const { default: Eleventy } = await import('@11ty/eleventy');
  return new Eleventy(input, output, {
    configPath: false, quietMode: true,
    config(config) {
      register(config);
      // API input/output override these config defaults (as CLI flags do).
      return { dir: { input: 'unused-input', output: 'unused-output' } };
    },
  });
}

async function build(name, instance) {
  try {
    await instance.write();
    report.builds[name] = { ok: true };
  } catch (error) {
    report.builds[name] = { ok: false, message: messages(error) };
  }
}

const socialPage = `{%- set fallback = '' | socialImageMeta -%}
{%- set described = '/images/photos/wide.jpg' | socialImageMeta('Blaue Testfläche') -%}
{%- set plain = '/images/photos/wide.jpg' | socialImageMeta -%}
<script type="application/json" id="social">{{ {fallback: fallback, described: described, plain: plain} | dump | safe }}</script>
{% responsiveImage '/images/photos/wide.jpg', 'Foto', 'hero', true %}`;

const indexTemplate = `module.exports = class {
  data() { return { permalink: '/index.json' }; }
  async render() {
    return JSON.stringify({
      thumbnail: await this.imageThumbnail('/images/photos/wide.jpg'),
      none: await this.imageThumbnail(''),
      social: await this.socialImageMeta('/images/photos/wide.jpg'),
    });
  }
};
`;

(async () => {
  process.chdir(workspace);
  const images = path.join(workspace, 'custom-input/images');
  await fs.mkdir(path.join(images, 'photos'), { recursive: true });
  await fs.copyFile(path.join(__dirname, '../../src/images/logo_big.png'), path.join(images, 'logo_big.png'));
  await sharp({ create: { width: 1500, height: 844, channels: 3, background: '#2a6f97' } })
    .jpeg().toFile(path.join(images, 'photos/wide.jpg'));
  // Unused files that a whole-folder scan would reject or choke on.
  await write(path.join(images, 'unused/remote.svg'), '<svg xmlns="http://www.w3.org/2000/svg" '
    + 'width="10" height="10"><image href="data:image/png;base64,AAAA" width="10" height="10"/></svg>');
  await write(path.join(images, 'unused/giant.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"/>');
  await write(path.join(images, 'unused/corrupt.png'), 'not a png');
  await write(path.join(images, 'unused/animation.gif'), 'GIF89a');
  const oversized = await fs.open(path.join(images, 'unused/oversized.jpg'), 'w');
  await oversized.truncate(21 * 1024 * 1024); // sparse, beyond the 20 MiB source budget
  await oversized.close();
  await write(path.join(workspace, 'custom-input/index.njk'), socialPage);
  await write(path.join(workspace, 'custom-input/thumbnails.11ty.js'), indexTemplate);

  const site = await eleventy('custom-input', 'custom-output');
  await build('success', site);
  // A second real build must recreate assets even if its output was removed.
  await fs.rm(path.join(workspace, 'custom-output/assets'), { recursive: true, force: true });
  await build('rebuild', site);

  // Referenced failures: a missing file through the Nunjucks filter, and an
  // unsafe SVG through a JavaScript template.
  await write(path.join(workspace, 'missing-input/index.njk'),
    "{%- set social = '/images/photos/missing.jpg' | socialImageMeta -%}{{ social.url }}");
  await fs.mkdir(path.join(workspace, 'missing-input/images'), { recursive: true });
  await build('missing', await eleventy('missing-input', 'missing-output'));
  await fs.cp(path.join(images, 'unused'), path.join(workspace, 'invalid-input/images/unused'), { recursive: true });
  await write(path.join(workspace, 'invalid-input/index.11ty.js'),
    "module.exports = async function () { return JSON.stringify(await this.imageThumbnail('/images/unused/remote.svg')); };\n");
  await build('invalid', await eleventy('invalid-input', 'invalid-output'));

  await fs.writeFile(path.join(workspace, 'report.json'), JSON.stringify(report, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
