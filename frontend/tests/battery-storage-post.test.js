const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHash } = require('crypto');
const matter = require('gray-matter');
const markdown = require('markdown-it')({ html: true });
const { parse } = require('csv-parse/sync');
const configs = require('../src/data_ingestion/charts/battery_storage');
const { buildLineChart } = require('../src/data_ingestion/builders/lineChart');
const { buildBarChart } = require('../src/data_ingestion/builders/barChart');
const { validateBatteryStorage } = require('../src/data_ingestion/utils/batteryStorageValidation');

const root = path.resolve(__dirname, '..');
const post = matter(fs.readFileSync(path.join(root, 'src/posts/2026/batteriespeicher-wandel.md'), 'utf8'));
const route = '/posts/2026/batteriespeicher-wandel/';
const contracts = {
  'battery_storage_cohorts.csv': ['Jahr', 'Anzahl_Index', 'Energie_Index', 'Anzahl', 'Leistung_GW', 'Energie_GWh'],
  'battery_storage_segments.csv': ['Jahr', 'Klein_GWh', 'Mittel_GWh', 'Gross_GWh'],
  'battery_storage_duration.csv': ['Jahr', 'Median_Stunden'],
  'battery_storage_daily_profile.csv': ['Stunde', 'Preis_EUR_MWh', 'Solar_GW'],
};

function optionFor(config, rows) {
  let option;
  const builder = config.type === 'bar' ? buildBarChart : buildLineChart;
  vm.runInNewContext(builder(rows, config), {
    document: { getElementById: () => ({}) },
    window: { addEventListener: () => {} },
    echarts: { init: () => ({ setOption: (value) => { option = value; } }) },
  });
  return option;
}

describe('battery storage static contract', () => {
  beforeEach(() => { document.body.innerHTML = markdown.render(post.content); });

  test('draft is collection-excluded with a renderable preview permalink and no missing image', () => {
    expect(post.data.title).toBe('Weniger neue Batteriespeicher, mehr Speicherkapazität');
    expect(post.data.eleventyExcludeFromCollections).toBe(true);
    expect(post.data.excludeFromSitemap).toBe(true);
    expect(post.data.permalink).toBe(route);
    expect(post.data.image).toBeUndefined();
    expect(post.data.excerpt).toContain('Rechercheentwurf');
    expect(post.content).toContain('DRAFT – explorativer Rechercheentwurf');
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelectorAll('h2')).toHaveLength(6);
    const inherited = JSON.parse(fs.readFileSync(path.join(root, 'src/posts/posts.json'), 'utf8'));
    expect(inherited.layout).toBe('post.njk');
  });

  test('four evidence groups wire all five plots to supported CSV columns and accessible descriptions', () => {
    expect(configs).toHaveLength(5);
    expect(document.querySelectorAll('.chart-section')).toHaveLength(4);
    expect(new Set(configs.map((config) => config.dataFile))).toEqual(new Set(Object.keys(contracts)));
    expect(new Set(configs.map((config) => config.containerId)).size).toBe(5);
    expect(new Set(configs.map((config) => config.outputFile)).size).toBe(5);
    const scripts = [...document.querySelectorAll('script[src]')].map((node) => node.getAttribute('src'));
    expect(scripts).toEqual(['/js/lib/echarts.min.js', ...configs.map((config) => `/js/charts/battery_storage/${config.outputFile}`)]);
    for (const config of configs) {
      expect(['line', 'bar']).toContain(config.type);
      for (const key of [config.xKey, ...(config.seriesKeys || [config.yKey])]) {
        expect(contracts[config.dataFile]).toContain(key);
      }
      const node = document.getElementById(config.containerId);
      expect(node.getAttribute('role')).toBe('img');
      expect(node.getAttribute('aria-label')).toBeTruthy();
      expect(document.getElementById(node.getAttribute('aria-describedby')).textContent).toBeTruthy();
      expect(node.closest('.chart-section').querySelector('.chart-sources a[href^="https://"]')).not.toBeNull();
    }
  });

  test('builders preserve indexed units, stacking, median and separate hourly scales in memory', () => {
    const rows = [{ Jahr: 2024, Anzahl_Index: 100, Energie_Index: 100, Klein_GWh: 5.041173,
      Mittel_GWh: 0.313054, Gross_GWh: 0.824290, Median_Stunden: 1.6461,
      Stunde: 13, Preis_EUR_MWh: 39.05, Solar_GW: 40 }];
    const [cohorts, segments, duration, price, solar] = configs.map((config) => optionFor(config, rows));
    expect(cohorts.yAxis.name).toBe('Index (2024 = 100)');
    expect(cohorts.series.map((series) => series.data)).toEqual([[100], [100]]);
    expect(segments.series.every((series) => series.stack === 'total')).toBe(true);
    expect(segments.series.map((series) => series.data)).toEqual([[5.041173], [0.313054], [0.824290]]);
    expect(duration.series[0].data).toEqual([1.6461]);
    expect(duration.yAxis.name).toBe('Median E/P (Stunden)');
    expect(price.xAxis).toEqual(solar.xAxis);
    expect(price.yAxis.name).toContain('EUR/MWh');
    expect(solar.yAxis.name).toContain('GW');
    expect(price.series).toHaveLength(1);
    expect(solar.series).toHaveLength(1);
    expect(price.series[0].data).toEqual([39.05]);
    expect(solar.series[0].data).toEqual([40]);
  });

  test('static tables retain validated figures without executing chart scripts', () => {
    const cells = (selector) => [...document.querySelectorAll(`${selector} tbody tr`)]
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(cells('#battery-cohorts-table')).toEqual([
      ['2024', '573.235', '4,027772', '6,178516', '1,6461'],
      ['2025', '559.016', '3,935269', '6,714984', '1,9200'],
    ]);
    expect(cells('#battery-segments-table')).toEqual([
      ['Klein', '5,041173', '4,544400'], ['Mittel', '0,313054', '0,424486'], ['Groß', '0,824290', '1,746098'],
    ]);
    for (const table of document.querySelectorAll('table')) {
      expect(table.querySelector('caption').textContent).toContain('30. Juni 2026');
      expect(table.querySelectorAll('thead th:not([scope="col"])')).toHaveLength(0);
      expect(table.querySelectorAll('tbody th:not([scope="row"])')).toHaveLength(0);
    }
  });

  test('copy preserves snapshot, survivor, expansion, filtering and interpretation caveats', () => {
    const text = document.body.textContent;
    for (const phrase of ['keine historisch beobachteten jährlichen Neuinstallationen', 'Survivor-Effekt',
      'frühesten Inbetriebnahmedatums', 'späteren Erweiterungen', 'keine Verteilung',
      '0,4523 Prozent', '4,5745 Prozent', 'keine Betreibertyp-Korrektur und keine Imputation',
      'nicht die korrigierten RWTH-Gesamtsummen', '30. Juni 2026', '11. August bis 9. September 2026',
      '13 Uhr bei 39,05 EUR/MWh', '20 Uhr bei 209,61 EUR/MWh', 'kein Kausalnachweis',
      'kein erreichbarer Speichergewinn', 'kein aktueller Bestandsbericht für September 2026']) {
      expect(text).toContain(phrase);
    }
    expect(document.querySelector('a[href="#methodik"]')).not.toBeNull();
    expect(document.getElementById('methodik')).not.toBeNull();
    expect(document.querySelector('a[href^="/docs/"]')).toBeNull();
    expect(document.querySelector('a[href="/dashboards/strom/"]')).not.toBeNull();
    expect(document.querySelector('a[href="/posts/2025/Industriepolitik/"]')).not.toBeNull();
  });
});

// Run this group after the exporter supplies the four frozen CSVs. Missing
// inputs must fail the full suite; static-only work can select the group above.
describe('battery storage CSV contract', () => {
  function rowsFor(filename) {
    const directory = path.join(root, 'src/data_ingestion/data');
    const bytes = fs.readFileSync(path.join(directory, filename));
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'battery_storage_metadata.json'), 'utf8'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(metadata.files[filename].sha256);
    const rows = parse(bytes, {
      columns: true, cast: true, skip_empty_lines: true, trim: true,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toEqual(contracts[filename]);
    for (const row of rows) {
      expect(Object.entries(row).filter(([key]) => key !== 'Stunde')
        .every(([, value]) => typeof value === 'number' && Number.isFinite(value))).toBe(true);
    }
    return rows;
  }

  test.each(Object.keys(contracts))('%s matches headers, finite values and the complete axis', (filename) => {
    const rows = rowsFor(filename);
    const hourly = filename === 'battery_storage_daily_profile.csv';
    expect(rows.map((row) => row[hourly ? 'Stunde' : 'Jahr']))
      .toEqual(Array.from({ length: hourly ? 24 : 7 }, (_, index) => hourly ? `${String(index).padStart(2, '0')}:00` : index + 2019));
    for (const config of configs.filter((item) => item.dataFile === filename)) {
      const option = optionFor(config, rows);
      expect(option.series.every((series) => series.data.every(Number.isFinite))).toBe(true);
    }
  });

  test('exported values reconcile with the frozen article evidence', () => {
    const cohorts = rowsFor('battery_storage_cohorts.csv');
    expect(cohorts.find((row) => row.Jahr === 2024)).toMatchObject({ Jahr: 2024, Anzahl_Index: 100, Energie_Index: 100 });
    for (const [year, count, power, energy] of [[2024, 573235, 4.027772, 6.178516], [2025, 559016, 3.935269, 6.714984]]) {
      const row = cohorts.find((item) => item.Jahr === year);
      expect(row.Anzahl).toBe(count);
      expect(row.Leistung_GW).toBeCloseTo(power, 6);
      expect(row.Energie_GWh).toBeCloseTo(energy, 6);
    }
    const next = cohorts.find((row) => row.Jahr === 2025);
    expect(next.Anzahl_Index).toBeCloseTo(559016 / 573235 * 100, 2);
    expect(next.Energie_Index).toBeCloseTo(6.714984 / 6.178516 * 100, 2);
    const segments = rowsFor('battery_storage_segments.csv');
    for (const [year, expected] of [[2024, [5.041173, 0.313054, 0.824290]], [2025, [4.544400, 0.424486, 1.746098]]]) {
      const row = segments.find((item) => item.Jahr === year);
      ['Klein_GWh', 'Mittel_GWh', 'Gross_GWh'].forEach((key, index) => expect(row[key]).toBeCloseTo(expected[index], 6));
    }
    const durations = rowsFor('battery_storage_duration.csv');
    expect(durations.find((row) => row.Jahr === 2024).Median_Stunden).toBeCloseTo(1.6461, 4);
    expect(durations.find((row) => row.Jahr === 2025).Median_Stunden).toBeCloseTo(1.92, 4);
    expect(durations.every((row) => row.Median_Stunden >= 0.1 && row.Median_Stunden <= 12)).toBe(true);
    const profile = rowsFor('battery_storage_daily_profile.csv');
    expect(profile.find((row) => row.Stunde === '13:00').Preis_EUR_MWh).toBeCloseTo(39.05, 2);
    expect(profile.find((row) => row.Stunde === '20:00').Preis_EUR_MWh).toBeCloseTo(209.61, 2);
    expect(profile.every((row) => row.Solar_GW >= 0)).toBe(true);
  });
});

describe('battery storage build-time manifest gate', () => {
  const directory = path.join(root, 'src/data_ingestion/data');
  const manifestName = 'battery_storage_metadata.json';
  const originalManifest = fs.readFileSync(path.join(directory, manifestName));
  const sourceMetadata = JSON.parse(originalManifest);
  const originals = Object.fromEntries([manifestName, ...Object.keys(sourceMetadata.files)]
    .map((name) => [name, fs.readFileSync(path.join(directory, name))]));
  const qualityName = 'battery_storage_quality.json';
  let files, metadata, readSpy;
  const setJSON = (name, value) => { files[name] = Buffer.from(JSON.stringify(value)); };
  const reseal = (name) => {
    metadata.files[name].bytes = files[name].length;
    metadata.files[name].sha256 = createHash('sha256').update(files[name]).digest('hex');
  };
  beforeEach(() => {
    files = { ...originals };
    metadata = JSON.parse(originalManifest);
    const originalRead = fs.readFileSync;
    readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filename, options) => {
      if (path.dirname(String(filename)) !== directory) return originalRead(filename, options);
      const name = path.basename(filename);
      if (!files[name]) throw new Error(`Missing fixture: ${name}`);
      return options === 'utf8' ? files[name].toString('utf8') : files[name];
    });
  });
  afterEach(() => { jest.restoreAllMocks(); jest.dontMock('../src/data_ingestion/builders/utils'); });

  test('accepts all ten frozen exports against their manifest without writing', () => {
    expect(Object.keys(validateBatteryStorage().files)).toHaveLength(10);
  });

  const failures = [
    ['mutated chart CSV', () => { files['battery_storage_cohorts.csv'] = Buffer.from(files['battery_storage_cohorts.csv'].toString().replace('573235', '573236')); }],
    ['mutated nonchart export', () => { files['battery_storage_by_state.csv'] = Buffer.concat([files['battery_storage_by_state.csv'], Buffer.from('\n')]); }],
    ['missing chart CSV', () => { delete files['battery_storage_segments.csv']; }],
    ['missing nonchart CSV', () => { delete files['battery_storage_monthly.csv']; }],
    ['missing quality JSON', () => { delete files[qualityName]; }],
    ['missing metadata', () => { delete files[manifestName]; }],
    ['invalid metadata JSON', () => { files[manifestName] = Buffer.from('{'); }],
    ['nonobject metadata', () => { files[manifestName] = Buffer.from('[]'); }],
    ['missing manifest entry', () => { delete metadata.files['battery_storage_summary.csv']; }],
    ['extra manifest path', () => { metadata.files['../../outside.csv'] = metadata.files['battery_storage_summary.csv']; }],
    ['invalid hash', () => { metadata.files['battery_storage_segments.csv'].sha256 = 'not-a-hash'; }],
    ['wrong byte count', () => { metadata.files['battery_storage_segments.csv'].bytes++; }],
    ['wrong row count', () => { metadata.files['battery_storage_yearly.csv'].rows++; }],
    ['wrong manifest headers', () => { metadata.files['battery_storage_monthly.csv'].columns[1] = 'other'; }],
    ['wrong actual headers with matching hash', () => {
      const name = 'battery_storage_by_state.csv';
      files[name] = Buffer.from(files[name].toString().replace('state,', 'region,')); reseal(name);
    }],
    ['ragged CSV with matching hash', () => {
      const name = 'battery_storage_duration.csv';
      files[name] = Buffer.from(files[name].toString().replace('2019,', '2019,extra,')); reseal(name);
    }],
    ['invalid quality JSON with matching hash', () => { files[qualityName] = Buffer.from('{'); reseal(qualityName); }],
    ['wrong quality scope with matching hash', () => {
      const quality = JSON.parse(files[qualityName]); quality.scope = 'all source records'; setJSON(qualityName, quality); reseal(qualityName);
    }],
    ['wrong quality date with matching hash', () => {
      const quality = JSON.parse(files[qualityName]); quality.snapshot_date = '2026-09-11'; setJSON(qualityName, quality); reseal(qualityName);
    }],
    ['invalid quality measures with matching hash', () => {
      const quality = JSON.parse(files[qualityName]); quality.before_quality_filters.selected_operating_unit_count = null;
      setJSON(qualityName, quality); reseal(qualityName);
    }],
    ['wrong schema', () => { metadata.schema_version = 2; }],
    ['wrong kind', () => { metadata.kind = 'live_battery_dashboard'; }],
    ['wrong register date', () => { metadata.mastr.snapshot_date = '2026-09-11'; }],
    ['wrong stock date', () => { metadata.operating_stock.snapshot_date = '2026-09-11'; }],
    ['wrong index base', () => { metadata.methodology.index_base_year = 2025; }],
    ['wrong chart years', () => { metadata.methodology.chart_years.push(2026); }],
    ['wrong electricity dates', () => { metadata.electricity_profile.first_local_date = '2026-08-12'; }],
    ['wrong electricity timezone', () => { metadata.electricity_profile.timezone = 'UTC'; }],
    ['wrong nonchart snapshot with matching hash', () => {
      const name = 'battery_storage_summary.csv';
      files[name] = Buffer.from(files[name].toString().replaceAll('2026-06-30', '2026-09-11')); reseal(name);
    }],
  ];
  test.each(failures)('%s stops the real generator before data loading or chart writes', (_, mutate) => {
    mutate();
    if (files[manifestName] === originals[manifestName]) setJSON(manifestName, metadata);
    expect(() => validateBatteryStorage()).toThrow();
    const loadData = jest.fn();
    const saveChart = jest.fn();
    jest.doMock('../src/data_ingestion/builders/utils', () => ({ loadData, saveChart }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const argv = process.argv;
    process.argv = [argv[0], 'generate-charts.js', 'battery_storage.js'];
    try {
      jest.isolateModules(() => {
        expect(() => require('../src/data_ingestion/generate-charts')).toThrow(/Error loading battery_storage\.js/);
      });
    } finally {
      process.argv = argv;
    }
    expect(loadData).not.toHaveBeenCalled();
    expect(saveChart).not.toHaveBeenCalled();
    expect(readSpy.mock.calls.some(([filename]) => String(filename).includes('outside.csv'))).toBe(false);
  });

  test('rejects symlink payloads before reading a target outside the data directory', () => {
    const originalStat = fs.lstatSync;
    jest.spyOn(fs, 'lstatSync').mockImplementation((filename) => path.basename(filename) === qualityName
      ? { isFile: () => false } : originalStat(filename));
    expect(() => validateBatteryStorage()).toThrow(/not a symlink/);
    expect(readSpy.mock.calls.some(([filename]) => path.basename(filename) === qualityName)).toBe(false);
  });
});

// Opt in only AFTER the main agent's build; this suite never generates files.
const builtTest = process.env.BATTERY_STORAGE_BUILD_CHECK === '1' ? test : test.skip;
builtTest('battery storage built preview has chart assets and stays out of discovery', () => {
  const site = path.join(root, '_site');
  document.body.innerHTML = fs.readFileSync(path.join(site, route, 'index.html'), 'utf8');
  expect(document.querySelectorAll('article.post-content h1')).toHaveLength(1);
  expect(document.body.textContent).toContain('DRAFT – explorativer Rechercheentwurf');
  expect(document.querySelectorAll('article.post-content table')).toHaveLength(2);
  const scripts = [...document.querySelectorAll('article.post-content script[src]')]
    .map((node) => node.getAttribute('src'));
  expect(scripts).toEqual(['/js/lib/echarts.min.js', ...configs.map((config) => `/js/charts/battery_storage/${config.outputFile}`)]);
  const echartsAsset = fs.readFileSync(path.join(site, 'js/lib/echarts.min.js'), 'utf8');
  expect(echartsAsset.length).toBeGreaterThan(0);
  expect(() => new vm.Script(echartsAsset)).not.toThrow();
  for (const config of configs) {
    expect(document.getElementById(config.containerId)).not.toBeNull();
    const script = fs.readFileSync(path.join(site, 'js/charts/battery_storage', config.outputFile), 'utf8');
    expect(script).toContain(`document.getElementById('${config.containerId}')`);
    expect(() => new vm.Script(script)).not.toThrow();
  }
  for (const filename of ['index.html', 'feed.json', 'feed.xml', 'search.json', 'sitemap.xml',
    'themen/energie/index.html', 'themen/wirtschaft/index.html']) {
    expect(fs.readFileSync(path.join(site, filename), 'utf8')).not.toContain(route);
  }
});
