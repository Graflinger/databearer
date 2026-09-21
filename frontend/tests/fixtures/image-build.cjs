// Real Eleventy directory overrides and lifecycle, isolated from the site build.
const fs = require('node:fs/promises');
const path = require('node:path');
const { register } = require('../../lib/responsive-images');

(async () => {
  const workspace = process.argv[2];
  const input = path.join(workspace, 'custom-input');
  const output = path.join(workspace, 'custom-output');
  process.chdir(workspace);
  await fs.mkdir(path.join(input, 'images'), { recursive: true });
  await fs.copyFile(path.join(__dirname, '../../src/images/logo_big.png'), path.join(input, 'images/logo_big.png'));
  await fs.writeFile(path.join(input, 'index.njk'), `{% set social = imageMetadata | socialImage %}
<meta property="og:image" content="{{ social.url }}">
<meta property="og:image:width" content="{{ social.width }}">
<meta property="og:image:height" content="{{ social.height }}">
{% responsiveImage '/images/logo_big.png', 'Databearer', 'hero', true %}`);
  const { default: Eleventy } = await import('@11ty/eleventy');
  const eleventy = new Eleventy('custom-input', 'custom-output', {
    configPath: false, quietMode: true,
    config(config) {
      register(config);
      // API input/output override these config defaults (as CLI flags do).
      return { dir: { input: 'unused-input', output: 'unused-output' } };
    },
  });
  await eleventy.write();
  // A second real build must recreate assets even if its output was removed.
  await fs.rm(path.join(output, 'assets'), { recursive: true });
  await eleventy.write();
})().catch((error) => { console.error(error); process.exitCode = 1; });
