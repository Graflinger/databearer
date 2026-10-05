const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildComparisonChart, renderComparisonChart } = require('../src/data_ingestion/builders/comparisonChart');
const { comparisonEmbed } = require('../src/data_ingestion/builders/comparisonEmbed');
const { loadData } = require('../src/data_ingestion/builders/utils');

const data = [{ year: 2025, value: 40 }, { year: 2026, value: 50 }];
const options = { xKey: 'year', baseline: 2025, current: 2026, containerId: 'comparison', label: 'Test comparison',
  metrics: [{ key: 'value', label: 'Generation', unit: 'TWh' }] };

test('semantic output preserves absolute values and distinguishes percent from percentage points', () => {
  document.body.innerHTML = renderComparisonChart(data, options);
  expect(document.querySelector('dl').getAttribute('aria-label')).toBe('Test comparison');
  expect(document.querySelector('dt').textContent).toBe('Generation');
  expect([...document.querySelectorAll('.comparison-chart__value')].map((n) => n.textContent)).toEqual(['2025 40,0 TWh', '2026 50,0 TWh']);
  expect(document.querySelector('.comparison-chart__delta').textContent).toBe('+25,0 % gegenüber 2025');
  document.body.innerHTML = renderComparisonChart(data, { ...options, metrics: [{ key: 'value', label: 'Share', unit: '%', delta: 'percentagePoints' }] });
  expect(document.querySelector('.comparison-chart__delta').textContent).toBe('+10,0 Prozentpunkte gegenüber 2025');
  expect(document.querySelector('canvas, svg, [role="img"]')).toBeNull();
});

test.each([0, -40])('zero/negative baselines retain values without a misleading relative delta: %s', (baseline) => {
  document.body.innerHTML = renderComparisonChart([{ year: 2025, value: baseline }, data[1]], options);
  expect(document.querySelector('.comparison-chart__delta').textContent).toContain('Relative Änderung nicht definiert');
  expect(document.querySelectorAll('.comparison-chart__value')).toHaveLength(2);
});

test('declines and unchanged values have neutral signed text, including rounded zero', () => {
  expect(renderComparisonChart([{ year: 2025, value: 50 }, { year: 2026, value: 40 }], options)).toContain('-20,0 %');
  expect(renderComparisonChart([{ year: 2025, value: 50 }, { year: 2026, value: 49.999 }], options)).toContain('0,0 %');
});

test.each([null, '', NaN, Infinity, '50'])('missing/invalid metric fails closed: %s', (value) => {
  expect(() => renderComparisonChart([data[0], { year: 2026, value }], options)).toThrow(/comparison value/);
});

test('missing/duplicate periods and inappropriate units fail closed', () => {
  expect(() => renderComparisonChart([data[0]], options)).toThrow(/exactly one row/);
  expect(() => renderComparisonChart([...data, data[1]], options)).toThrow(/exactly one row/);
  expect(() => renderComparisonChart(data, { ...options, metrics: [{ ...options.metrics[0], delta: 'percentagePoints' }] })).toThrow(/metric\/unit/);
});

test('generated scripts escape text and are idempotent with static, empty and absent containers', () => {
  const special = { ...options, label: '<img src=x onerror=alert(1)>', metrics: [{ ...options.metrics[0], label: '</script><script>bad()</script>' }] };
  document.body.innerHTML = '<div id="comparison"></div>';
  const script = buildComparisonChart(data, special);
  vm.runInNewContext(script, { document });
  expect(document.querySelector('img, script')).toBeNull();
  expect(document.querySelector('dt').textContent).toBe(special.metrics[0].label);
  const original = document.querySelector('dl');
  vm.runInNewContext(script, { document });
  expect(document.querySelector('dl')).toBe(original);
  expect(document.querySelectorAll('dl')).toHaveLength(1);
  document.body.innerHTML = '';
  expect(() => vm.runInNewContext(script, { document })).not.toThrow();
});

test('frozen post shortcode and generated JS share precisely the same semantic evidence', () => {
  const config = require('../src/data_ingestion/charts/strom_ytd_2026')[0];
  const rows = loadData(path.resolve(__dirname, '../src/data_ingestion/data', config.dataFile));
  const script = buildComparisonChart(rows, config);
  document.body.innerHTML = comparisonEmbed('strom_ytd_2026', config.containerId);
  const staticChart = document.querySelector('dl');
  expect(staticChart.outerHTML).toBe(renderComparisonChart(rows, config));
  vm.runInNewContext(script, { document });
  expect(document.querySelector('dl')).toBe(staticChart);
  expect(document.querySelector('script').getAttribute('src')).toBe('/js/charts/strom_ytd_2026/comparison.js');
  const generated = fs.readFileSync(path.resolve(__dirname, '../src/js/charts/strom_ytd_2026/comparison.js'), 'utf8');
  expect(generated).toBe(script);
  expect(() => comparisonEmbed('../strom_ytd_2026', config.containerId)).toThrow(/name/);
  expect(() => comparisonEmbed('strom_ytd_2026', 'missing')).toThrow(/matching config/);
});
