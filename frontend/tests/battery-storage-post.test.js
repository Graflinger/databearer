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

// Jest cannot load Eleventy's ESM entry that .eleventy.js requires; the draft
// policy is captured from the real production config with a recording config.
jest.mock('@11ty/eleventy', () => ({ HtmlBasePlugin() {} }));
const { productionPreprocessors } = require('./fixtures/seo-cleanup.cjs');

const root = path.resolve(__dirname, '..');
const dataPath = '2026/battery_storage';
const dataDirectory = path.join(root, 'src/data_ingestion/data', dataPath);
const post = matter(fs.readFileSync(path.join(root, 'src/posts/2026/batteriespeicher-wandel.md'), 'utf8'));
const route = '/posts/2026/batteriespeicher-wandel/';
const contracts = {
  'battery_storage_cohorts.csv': ['Jahr', 'Anzahl_Index', 'Energie_Index', 'Anzahl', 'Leistung_GW', 'Energie_GWh'],
  'battery_storage_segments.csv': ['Jahr', 'Klein_GWh', 'Mittel_GWh', 'Gross_GWh'],
  'battery_storage_duration.csv': ['Jahr', 'Median_Stunden'],
  'battery_storage_daily_profile.csv': ['Stunde', 'Preis_EUR_MWh', 'Solar_GW'],
  'battery_storage_trend.csv': ['Kohorte', 'Anzahl', 'Energie_GWh', 'Klein_GWh', 'Mittel_GWh', 'Gross_GWh', 'Gross_Anzahl', 'Median_Stunden'],
};

function optionFor(config, rows) {
  let option;
  const chartDocument = document.implementation.createHTMLDocument('Chart fixture');
  const chartContainer = chartDocument.createElement('div');
  chartContainer.id = config.containerId;
  chartDocument.body.appendChild(chartContainer);
  const builder = config.type === 'bar' ? buildBarChart : buildLineChart;
  vm.runInNewContext(builder(rows, config), {
    document: chartDocument,
    window: { addEventListener: () => {} },
    echarts: { init: () => ({ setOption: (value) => { option = value; } }) },
  });
  return option;
}

describe('battery storage static contract', () => {
  beforeEach(() => { document.body.innerHTML = markdown.render(post.content); });

  test('published post passes the production draft preprocessor and joins discovery', () => {
    expect(post.data.title).toBe('Große Speicher treiben den Batterieausbau');
    expect(post.data.eleventyExcludeFromCollections).toBeUndefined();
    expect(post.data.excludeFromSitemap).toBeUndefined();
    expect(post.data.permalink).toBe(route);
    expect(post.data.draft).toBeUndefined();
    expect(post.data.date).toEqual(new Date('2026-09-27'));
    // First publication: no separate "Aktualisiert" date.
    expect(post.data.lastUpdated).toBeUndefined();
    const inherited = require('../src/posts/posts.11tydata');
    const [[name, extensions, skip]] = productionPreprocessors();
    expect([name, extensions]).toEqual(['drafts', '*']);
    expect(skip({ ...inherited, ...post.data })).toBeUndefined();
    expect(post.data.excerpt).not.toMatch(/Rechercheentwurf|DRAFT/);
    expect(post.data.image).toBe('/images/blog_card_images/2026/batteriespeicher-wandel.png');
    expect(fs.existsSync(path.join(root, 'src', post.data.image))).toBe(true);
    expect(post.data.imageAlt).toBeTruthy();
    expect(post.content).not.toMatch(/Rechercheentwurf|DRAFT/);
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelectorAll('h2')).toHaveLength(7);
    // 2026 is integrated throughout, not a separate section.
    expect(document.getElementById('jahr-2026')).toBeNull();
    expect(inherited.layout).toBe('post.njk');
  });

  test('four evidence groups wire all five plots to supported CSV columns and accessible descriptions', () => {
    expect(configs).toHaveLength(5);
    expect(document.querySelectorAll('.chart-section')).toHaveLength(4);
    // Cohort charts read the trend file, which includes the incomplete year 2026*.
    expect(new Set(configs.map((config) => config.dataFile))).toEqual(new Set(['battery_storage_trend.csv', 'battery_storage_daily_profile.csv'].map((name) => `${dataPath}/${name}`)));
    expect(new Set(configs.map((config) => config.containerId)).size).toBe(5);
    expect(new Set(configs.map((config) => config.outputFile)).size).toBe(5);
    const scripts = [...document.querySelectorAll('script[src]')].map((node) => node.getAttribute('src'));
    expect(scripts).toEqual(['/js/lib/echarts.min.js', ...configs.map((config) => `/js/charts/battery_storage/${config.outputFile}`)]);
    for (const config of configs) {
      expect(['line', 'bar']).toContain(config.type);
      for (const key of [config.xKey, ...(config.seriesKeys || [config.yKey])]) {
        expect(contracts[path.basename(config.dataFile)]).toContain(key);
      }
      const node = document.getElementById(config.containerId);
      expect(node.getAttribute('role')).toBe('img');
      const heading = document.getElementById(node.getAttribute('aria-labelledby'));
      expect(heading.tagName).toMatch(/^H[34]$/);
      expect(heading.textContent.trim()).toBeTruthy();
      expect(document.getElementById(node.getAttribute('aria-describedby')).textContent).toBeTruthy();
      expect(node.closest('.chart-section').querySelector('.chart-sources a[href^="https://"]')).not.toBeNull();
    }
  });

  test('builders preserve indexed units, stacking, median and separate hourly scales in memory', () => {
    const rows = [{ Klein_GWh: 5.057128882, Mittel_GWh: 0.314970178, Gross_GWh: 0.827139801, Median_Stunden: 1.655172414,
      Stunde: 13, Preis_EUR_MWh: 39.05, Solar_GW: 40, Kohorte: '2026*', Energie_GWh: 7.9, Gross_Anzahl: 215 }];
    const [trend, segments, duration, price, solar] = configs.map((config) => optionFor(config, rows));
    // Trend: energy on the left axis, number of large plants on a right axis.
    expect(trend.xAxis.data).toEqual(['2026*']);
    expect(trend.yAxis.map((axis) => axis.name)).toEqual(['Speicherkapazität (GWh)', 'Große Speicher (Anzahl)']);
    expect(trend.series.map((series) => [series.name, series.yAxisIndex, series.data])).toEqual([
      ['Kapazität gesamt (GWh)', 0, [7.9]], ['Große Speicher (GWh)', 0, [0.827139801]], ['Große Speicher (Anzahl)', 1, [215]],
    ]);
    expect(duration.series.every((series) => series.yAxisIndex === undefined)).toBe(true);
    expect(segments.xAxis.data).toEqual(['2026*']);
    expect(segments.series.every((series) => series.stack === 'total')).toBe(true);
    expect(segments.series.map((series) => series.data)).toEqual([[5.057128882], [0.314970178], [0.827139801]]);
    expect(duration.series[0].data).toEqual([1.655172414]);
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
    expect(cells('#battery-stock-table')).toEqual([
      ['Klein', '2.740.190', '15,008', '23,710', '1,84'],
      ['Mittel', '28.178', '0,829', '1,774', '2,56'],
      ['Groß', '652', '4,384', '7,814', '2,00'],
      ['Gesamt', '2.769.020', '20,222', '33,299', '1,84'],
    ]);
    expect(cells('#battery-segments-table')).toEqual([
      ['Klein', '5,060', '4,591', '3,695'], ['Mittel', '0,316', '0,439', '0,440'], ['Groß', '0,827', '1,737', '3,768'],
      ['Gesamt', '6,203', '6,768', '7,902'], ['Anteil groß', '13 %', '26 %', '48 %'],
    ]);
    expect(document.querySelector('#battery-segments-table thead').textContent).toContain('2026*');
    // Standalone tables carry their source as a small table note right below them.
    for (const id of ['battery-stock-table', 'battery-segments-table']) {
      const note = document.getElementById(id).closest('.table-scroll').nextElementSibling;
      expect(note.matches('p.table-note')).toBe(true);
      expect(note.textContent).toMatch(/^Quelle: Bundesnetzagentur, Marktstammdatenregister/);
      expect(note.querySelector('a[href^="https://www.marktstammdatenregister.de/"]')).not.toBeNull();
    }
    expect([...document.querySelectorAll('.post-content > p, p')].some((node) => !node.classList.contains('table-note')
      && !node.closest('.chart-section') && /^Quelle:/.test(node.textContent.trim()))).toBe(false);
    for (const table of document.querySelectorAll('table')) {
      expect(table.querySelector('caption').textContent).toContain('26. September 2026');
      expect(table.querySelectorAll('thead th:not([scope="col"])')).toHaveLength(0);
      expect(table.querySelectorAll('tbody th:not([scope="row"])')).toHaveLength(0);
    }
  });

  test('copy keeps the key caveats short, in a one-author voice, without third-party methodology', () => {
    const text = document.body.textContent;
    for (const phrase of ['nicht dasselbe wie der tatsächliche Zubau', 'stillgelegte Anlagen fehlen',
      'spätere Erweiterungen', 'nicht die Streuung', 'unplausiblen oder fehlenden Angaben',
      'knapp vier Prozent der gemeldeten Kapazität', 'etwas zu niedrig',
      '2,02 Prozent sank', '9,11 Prozent mehr', '+110,04 Prozent', '13 Prozent', '26 Prozent', '48 Prozent',
      'Hochgerechnet wird nicht', 'erstmals seit 2016', 'bereits 215', '1,98 Stunden', '16,9 kWh',
      '2026* steht in diesem Beitrag für den 1. Januar bis 26. September 2026',
      '2.769.020 Batteriespeicher', '26. September 2026', '27. August bis 25. September 2026',
      '13 Uhr liegt der mittlere Day-Ahead-Preis bei 37,94 EUR/MWh', 'um 19 Uhr 248,93 EUR/MWh', 'kein Kausalnachweis',
      'noch kein Gewinn für einen Speicher', '„Duck Curve“', 'Residuallast', 'mehr als 200 EUR/MWh', 'Bundesnetzagentur | SMARD.de', 'Datenlizenz Deutschland']) {
      expect(text).toContain(phrase);
    }
    // One author: no team "wir"/"unser"; no named third-party methodology.
    expect(text).not.toMatch(/\b(?:[Ww]ir|[Uu]ns|[Uu]nser\w*)\b/);
    expect(text).not.toMatch(/Battery Charts|RWTH/i);
    expect(document.querySelector('a[href*="battery-charts"]')).toBeNull();
    const data = document.getElementById('daten');
    expect(data.tagName).toBe('H2');
    expect(document.querySelector('a[href="#daten"]')).not.toBeNull();
    // The data section stays short: no H3 subsections, at most a few paragraphs.
    const section = [];
    for (let node = data.nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) section.push(node);
    expect(section.filter((node) => node.tagName === 'H3')).toHaveLength(0);
    expect(section.filter((node) => node.tagName === 'P').length).toBeLessThanOrEqual(3);
    expect(document.querySelector('a[href^="/docs/"]')).toBeNull();
    expect(document.querySelector('a[href="/dashboards/strom/"]')).not.toBeNull();
    expect(document.querySelector('a[href="/posts/2025/Industriepolitik/"]')).not.toBeNull();
  });
});

// Actual frozen September 26 evidence; missing inputs must fail the full suite.
describe('battery storage CSV contract', () => {
  function rowsFor(filename) {
    const directory = dataDirectory;
    const bytes = fs.readFileSync(path.join(directory, filename));
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'battery_storage_metadata.json'), 'utf8'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(metadata.files[filename].sha256);
    const rows = parse(bytes, {
      columns: true, cast: true, skip_empty_lines: true, trim: true,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toEqual(contracts[filename]);
    for (const row of rows) {
      expect(Object.entries(row).filter(([key]) => key !== 'Stunde' && key !== 'Kohorte')
        .every(([, value]) => typeof value === 'number' && Number.isFinite(value))).toBe(true);
    }
    return rows;
  }

  test.each(Object.keys(contracts))('%s matches headers, finite values and the complete axis', (filename) => {
    const rows = rowsFor(filename);
    const hourly = filename === 'battery_storage_daily_profile.csv';
    if (filename === 'battery_storage_trend.csv') {
      expect(rows.map((row) => row.Kohorte)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, '2026*']);
    } else {
      expect(rows.map((row) => row[hourly ? 'Stunde' : 'Jahr']))
        .toEqual(Array.from({ length: hourly ? 24 : 7 }, (_, index) => hourly ? `${String(index).padStart(2, '0')}:00` : index + 2019));
    }
    for (const config of configs.filter((item) => item.dataFile === `${dataPath}/${filename}`)) {
      const option = optionFor(config, rows);
      expect(option.series.every((series) => series.data.every(Number.isFinite))).toBe(true);
    }
  });

  test('exported values reconcile with the frozen article evidence', () => {
    const cohorts = rowsFor('battery_storage_cohorts.csv');
    expect(cohorts.find((row) => row.Jahr === 2024)).toMatchObject({ Jahr: 2024, Anzahl_Index: 100, Energie_Index: 100 });
    for (const [year, count, power, energy] of [[2024, 574051, 4.028811855, 6.202971356], [2025, 562472, 3.964645995, 6.768137764]]) {
      const row = cohorts.find((item) => item.Jahr === year);
      expect(row.Anzahl).toBe(count);
      expect(row.Leistung_GW).toBe(power);
      expect(row.Energie_GWh).toBe(energy);
    }
    const next = cohorts.find((row) => row.Jahr === 2025);
    expect(next.Anzahl_Index).toBeCloseTo(562472 / 574051 * 100, 8);
    expect(next.Energie_Index).toBeCloseTo(6.768137764 / 6.202971356 * 100, 8);
    expect(100 - next.Anzahl_Index).toBeCloseTo(2.0171, 4);
    expect(next.Energie_Index - 100).toBeCloseTo(9.1112, 4);
    const segments = rowsFor('battery_storage_segments.csv');
    for (const [year, expected] of [[2024, [5.060271857, 0.315559698, 0.827139801]], [2025, [4.591402349, 0.439436825, 1.73729859]]]) {
      const row = segments.find((item) => item.Jahr === year);
      ['Klein_GWh', 'Mittel_GWh', 'Gross_GWh'].forEach((key, index) => expect(row[key]).toBe(expected[index]));
    }
    expect((segments.find((row) => row.Jahr === 2025).Gross_GWh
      / segments.find((row) => row.Jahr === 2024).Gross_GWh - 1) * 100).toBeCloseTo(110.0369, 4);
    const durations = rowsFor('battery_storage_duration.csv');
    expect(durations.find((row) => row.Jahr === 2024).Median_Stunden).toBe(1.655172414);
    expect(durations.find((row) => row.Jahr === 2025).Median_Stunden).toBeCloseTo(1.92, 4);
    expect(durations.every((row) => row.Median_Stunden >= 0.1 && row.Median_Stunden <= 12)).toBe(true);
    const trend = rowsFor('battery_storage_trend.csv');
    const yearlyRows = parse(fs.readFileSync(path.join(dataDirectory, 'battery_storage_yearly.csv')), { columns: true, cast: true });
    for (const row of trend) {
      const year = Number(String(row.Kohorte).replace('*', ''));
      const pick = (segment) => yearlyRows.find((item) => item.commissioning_year === year && item.size_segment === segment);
      expect(row.Energie_GWh).toBe(pick('overall').energy_gwh);
      expect(row.Gross_Anzahl).toBe(pick('large') ? pick('large').plant_count : 0);
      expect(row.Gross_GWh).toBe(pick('large') ? pick('large').energy_gwh : 0);
      expect(row.Klein_GWh).toBe(pick('small').energy_gwh);
      expect(row.Mittel_GWh).toBe(pick('medium').energy_gwh);
      expect(row.Anzahl).toBe(pick('overall').plant_count);
      expect(row.Median_Stunden).toBe(pick('overall').median_duration_hours);
    }
    expect(trend.at(-1)).toEqual({ Kohorte: '2026*', Anzahl: 466762, Energie_GWh: 7.902219936, Klein_GWh: 3.694521683,
      Mittel_GWh: 0.439540803, Gross_GWh: 3.76815745, Gross_Anzahl: 215, Median_Stunden: 1.98 });
    // Large-plant shares quoted in the text: 13 % (2024), 26 % (2025), 48 % (2026*).
    expect(trend.slice(-3).map((row) => Math.round(row.Gross_GWh / row.Energie_GWh * 100))).toEqual([13, 26, 48]);
    // Mean capacity per plant: 10,8 / 12,0 / 16,9 kWh.
    expect(trend.slice(-3).map((row) => (row.Energie_GWh * 1e6 / row.Anzahl).toFixed(1))).toEqual(['10.8', '12.0', '16.9']);
    const profile = rowsFor('battery_storage_daily_profile.csv');
    expect(profile.find((row) => row.Stunde === '13:00').Preis_EUR_MWh).toBeCloseTo(37.94, 2);
    expect(profile.find((row) => row.Stunde === '19:00').Preis_EUR_MWh).toBeCloseTo(248.93, 2);
    const prices = profile.map((row) => row.Preis_EUR_MWh);
    expect(Math.min(...prices)).toBe(profile.find((row) => row.Stunde === '13:00').Preis_EUR_MWh);
    expect(Math.max(...prices)).toBe(profile.find((row) => row.Stunde === '19:00').Preis_EUR_MWh);
    expect(profile.every((row) => row.Solar_GW >= 0)).toBe(true);
  });
});

describe('battery storage build-time manifest gate', () => {
  const directory = dataDirectory;
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

  test('accepts all eleven frozen exports against their manifest without writing', () => {
    const validated = validateBatteryStorage();
    expect(Object.keys(validated.files)).toHaveLength(11);
    expect(validated.mastr.snapshot_date).toBe('2026-09-26');
    expect(validated.operating_stock).toMatchObject({
      snapshot_date: '2026-09-26', plant_count: 2769020, unit_count: 2769021,
      power_gw: 20.221522359, energy_gwh: 33.299118225,
    });
    const quality = JSON.parse(files[qualityName]);
    const before = quality.before_quality_filters;
    const excluded = quality.excluded_by_quality_filters;
    expect(before.relation_count).toBe(2781755);
    expect(excluded.relation_count).toBe(12735);
    expect(before.selected_operating_unit_count).toBe(2781756);
    expect(excluded.selected_operating_unit_count).toBe(12735);
    expect(excluded.selected_operating_unit_count / before.selected_operating_unit_count * 100).toBeCloseTo(0.4578, 4);
    expect(excluded.known_power_gw / before.known_power_gw * 100).toBeCloseTo(0.1917, 4);
    expect(excluded.known_energy_gwh / before.known_energy_gwh * 100).toBeCloseTo(3.6821, 4);
  });

  test('full stock and partial 2026 exports reconcile with static evidence', () => {
    const summary = parse(files['battery_storage_summary.csv'], { columns: true, cast: true });
    expect(summary.every((row) => row.operating_status === 'operating' && row.snapshot_date === '2026-09-26')).toBe(true);
    for (const [segment, count, power, energy, median] of [
      ['small', 2740190, 15.008280735, 23.71040408, 1.84],
      ['medium', 28178, 0.829080754, 1.774300432, 2.56],
      ['large', 652, 4.38416087, 7.814413713, 2],
      ['overall', 2769020, 20.221522359, 33.299118225, 1.84],
    ]) {
      expect(summary.find((row) => row.size_segment === segment)).toMatchObject({
        plant_count: count, power_gw: power, energy_gwh: energy, median_duration_hours: median,
      });
    }
    const yearly = parse(files['battery_storage_yearly.csv'], { columns: true, cast: true });
    expect(yearly.find((row) => row.commissioning_year === 2026 && row.size_segment === 'overall')).toMatchObject({
      plant_count: 466762, energy_gwh: 7.902219936, period_complete: 'false',
    });
    expect(yearly.filter((row) => row.commissioning_year < 2026).every((row) => row.period_complete === 'true')).toBe(true);
  });

  test('generator resolves nested data paths and preserves chart output identifiers and manifest basenames', () => {
    const realLoadData = jest.requireActual('../src/data_ingestion/builders/utils').loadData;
    const loadData = jest.fn(realLoadData);
    const saveChart = jest.fn();
    jest.doMock('../src/data_ingestion/builders/utils', () => ({ loadData, saveChart }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const argv = process.argv;
    process.argv = [argv[0], 'generate-charts.js', 'battery_storage.js'];
    try {
      jest.isolateModules(() => { require('../src/data_ingestion/generate-charts'); });
    } finally {
      process.argv = argv;
    }
    const outputs = ['trend', 'segments', 'duration', 'daily-price', 'daily-solar'];
    expect(loadData.mock.calls.map(([filename]) => filename)).toEqual(configs.map((config) =>
      path.join(root, 'src/data_ingestion/data', config.dataFile)));
    expect(saveChart.mock.calls.map(([, filename]) => filename)).toEqual(outputs.map((name) =>
      path.join(root, 'src/js/charts/battery_storage', `${name}.js`)));
    expect(configs.map((config) => config.containerId)).toEqual(outputs.map((name) => `battery-storage-${name}`));
    for (const [script] of saveChart.mock.calls) expect(() => new vm.Script(script)).not.toThrow();
    expect(Object.keys(files)).toEqual(Object.keys(originals));
    for (const [name, bytes] of Object.entries(originals)) {
      expect(path.basename(name)).toBe(name);
      expect(files[name]).toEqual(bytes);
      expect(fs.existsSync(path.join(root, 'src/data_ingestion/data', name))).toBe(false);
    }
  });

  const failures = [
    ['mutated chart CSV', () => { files['battery_storage_cohorts.csv'] = Buffer.from(files['battery_storage_cohorts.csv'].toString().replace('574051', '574052')); }],
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
      const quality = JSON.parse(files[qualityName]); quality.snapshot_date = '2026-06-30'; setJSON(qualityName, quality); reseal(qualityName);
    }],
    ['invalid quality measures with matching hash', () => {
      const quality = JSON.parse(files[qualityName]); quality.before_quality_filters.selected_operating_unit_count = null;
      setJSON(qualityName, quality); reseal(qualityName);
    }],
    ['wrong schema', () => { metadata.schema_version = 2; }],
    ['wrong kind', () => { metadata.kind = 'live_battery_dashboard'; }],
    ['wrong register date', () => { metadata.mastr.snapshot_date = '2026-06-30'; }],
    ['wrong stock date', () => { metadata.operating_stock.snapshot_date = '2026-06-30'; }],
    ['wrong index base', () => { metadata.methodology.index_base_year = 2025; }],
    ['wrong chart years', () => { metadata.methodology.chart_years.push(2026); }],
    ['wrong electricity dates', () => { metadata.electricity_profile.first_local_date = '2026-08-28'; }],
    ['wrong electricity timezone', () => { metadata.electricity_profile.timezone = 'UTC'; }],
    ['wrong nonchart snapshot with matching hash', () => {
      const name = 'battery_storage_summary.csv';
      files[name] = Buffer.from(files[name].toString().replaceAll('2026-09-26', '2026-06-30')); reseal(name);
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
builtTest('battery storage post is built with chart assets and joins discovery', () => {
  const site = path.join(root, '_site');
  document.body.innerHTML = fs.readFileSync(path.join(site, route, 'index.html'), 'utf8');
  expect(document.querySelectorAll('article.post-content h1')).toHaveLength(1);
  expect(document.querySelectorAll('article.post-content table')).toHaveLength(2);
  const scripts = [...document.querySelectorAll('article.post-content script[src]')]
    .map((node) => node.getAttribute('src'));
  expect(scripts).toEqual(['/js/lib/echarts.min.js', ...configs.map((config) => `/js/charts/battery_storage/${config.outputFile}`)]);
  const echartsAsset = fs.readFileSync(path.join(site, 'js/lib/echarts.min.js'), 'utf8');
  expect(echartsAsset.length).toBeGreaterThan(0);
  expect(() => new vm.Script(echartsAsset)).not.toThrow();
  for (const config of configs) {
    const script = fs.readFileSync(path.join(site, 'js/charts/battery_storage', config.outputFile), 'utf8');
    expect(script).toContain(`document.getElementById('${config.containerId}')`);
    expect(() => new vm.Script(script)).not.toThrow();
  }
  for (const filename of ['index.html', 'feed.json', 'feed.xml', 'search.json', 'sitemap.xml',
    'themen/energie/index.html', 'themen/wirtschaft/index.html']) {
    expect(fs.readFileSync(path.join(site, filename), 'utf8')).toContain(route);
  }
});
