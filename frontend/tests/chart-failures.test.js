/** @jest-environment node */
const path = require('path');
const { spawnSync } = require('child_process');

describe('chart config loading fails closed without changing discovery', () => {
  let fs;
  let load;
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('fs', () => ({ existsSync: jest.fn(() => true), readdirSync: jest.fn(() => ['2026', 'README.md']) }));
    fs = require('fs');
    load = require('../src/data_ingestion/builders/chartConfigLoader').loadChartConfigs;
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.dontMock('fs'); });
  test('does not recurse into year directories', () => {
    expect(load('/charts')).toEqual([]);
    expect(fs.readdirSync).toHaveBeenCalledTimes(1);
  });
  test('missing directory throws', () => {
    fs.existsSync.mockReturnValue(false);
    expect(() => load('/missing')).toThrow('directory not found');
  });
  test('missing explicitly selected config throws', () => {
    expect(() => load('/charts', 'missing.js')).toThrow('Error loading missing.js');
  });
  test.each([{}, [], [null]])('invalid module export %j throws', (exported) => {
    jest.doMock('/virtual/invalid.js', () => exported, { virtual: true });
    expect(() => load('/virtual', 'invalid.js')).toThrow();
  });
  test('explicit nested configs retain basename output grouping', () => {
    jest.doMock('/virtual/2026/valid.js', () => [{ type: 'line' }], { virtual: true });
    expect(load('/virtual', '2026/valid.js')).toEqual([{ type: 'line', _sourceFile: 'valid' }]);
  });
});

describe('generator exit status', () => {
  const generator = path.resolve(__dirname, '../src/data_ingestion/generate-charts.js');
  // Exercise the actual CLI in a child process, substituting only its input and IO.
  function run(failure) {
    const script = `
      const generator = ${JSON.stringify(generator)};
      const directory = require('path').dirname(generator);
      const mock = (relative, exports) => { const id = require.resolve(directory + relative); require.cache[id] = { id, filename: id, loaded: true, exports }; };
      mock('/builders/chartConfigLoader', { loadChartConfigs: () => [{ type: 'line', dataFile: 'test.csv', outputFile: 'test.js', containerId: 'test' }] });
      mock('/builders/lineChart', { buildLineChart: () => ${failure === 'builder' ? "{ throw new Error('builder failed'); }" : "'chart code'"} });
      mock('/builders/utils', {
        loadData: () => ${failure === 'data' ? "{ throw new Error('missing CSV'); }" : failure === 'empty' ? '[]' : '[{ x: 1, y: 2 }]'},
        saveChart: () => { ${failure === 'write' ? "throw new Error('write failed');" : ''} }
      });
      require(generator);
    `;
    return spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  }
  test.each(['builder', 'data', 'empty', 'write'])('%s failure exits nonzero', (failure) => {
    const result = run(failure);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Failed to generate');
  });
  test('success exits zero', () => { expect(run('none').status).toBe(0); });
  test('missing selected config exits nonzero', () => {
    expect(spawnSync(process.execPath, [generator, 'missing-dashboard-test.js']).status).toBe(1);
  });
});

test('Eleventy before hook rejects when chart generation fails', async () => {
  jest.resetModules();
  jest.doMock('@11ty/eleventy', () => ({ HtmlBasePlugin: {} }));
  jest.doMock('child_process', () => ({ execSync: () => { throw new Error('chart command failed'); } }));
  const hooks = {};
  const config = { on: (name, fn) => { hooks[name] = fn; }, ignores: { add: jest.fn() },
    watchIgnores: { add: jest.fn() }, addFilter: jest.fn(), addPassthroughCopy: jest.fn(),
    addPlugin: jest.fn(), addGlobalData: jest.fn(), addCollection: jest.fn() };
  require('../.eleventy.js')(config);
  await expect(hooks['eleventy.before']()).rejects.toThrow('chart command failed');
});
