// Isolated cleanup lifecycle fixture, shared by real CLI and programmatic runs.
// No image/chart hooks: dry-run assertions concern the SEO cleanup itself.
const path = require('path');
const seo = require('../../src/seo');

// Capture the preprocessors (the strict `drafts` policy) registered by the real
// production config. Every other registration is recorded as a no-op, so no
// chart generation, dashboard verification, passthrough or image hook runs.
function productionPreprocessors() {
  const preprocessors = [];
  const recorder = new Proxy({}, {
    get(target, key) {
      if (key === 'addPreprocessor') return (...args) => preprocessors.push(args);
      if (key === 'ignores' || key === 'watchIgnores') return new Set();
      return () => {};
    },
  });
  require(path.join(__dirname, '../../.eleventy.js'))(recorder);
  return preprocessors;
}

module.exports = function (config) {
  seo.configure(config);
  for (const args of productionPreprocessors()) config.addPreprocessor(...args);
  return { dir: { input: 'src', output: '_site' } };
};
module.exports.productionPreprocessors = productionPreprocessors;

if (require.main === module) {
  (async () => {
    const { default: Eleventy } = await import('@11ty/eleventy');
    const output = process.argv[3] || '_site';
    const eleventy = new Eleventy('src', output, {
      configPath: false, quietMode: true, dryRun: process.argv[2] === 'dryrun',
      config(config) {
        module.exports(config);
        return { dir: { input: 'src', output } };
      },
    });
    await eleventy.write();
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
