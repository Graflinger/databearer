// Isolated cleanup lifecycle fixture, shared by real CLI and programmatic runs.
// No image/chart hooks: dry-run assertions concern the SEO cleanup itself.
const seo = require('../../src/seo');

module.exports = function (config) {
  seo.configure(config);
  config.addGlobalData('eleventyComputed', {
    permalink: (data) => data.draft ? false : data.permalink,
  });
  return { dir: { input: 'src', output: '_site' } };
};

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
