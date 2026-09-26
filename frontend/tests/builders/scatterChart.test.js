/** @jest-environment jsdom */
const vm = require('vm');
const { buildScatterChart, linearFit } = require('../../src/data_ingestion/builders/scatterChart');

const rows = [
  { month: '2019-01', period: 'A', x: 1, y: 3 },
  { month: '2019-02', period: 'A', x: 2, y: 5 },
  { month: '2019-03', period: 'A', x: 3, y: 7 },
  { month: '2020-01', period: 'B', x: 10, y: 1 },
  { month: '2020-02', period: 'B', x: 20, y: 0 },
  { month: '2020-03', period: 'B', x: 30, y: -1 },
];
const options = { containerId: 'chart', xKey: 'x', yKey: 'y', labelKey: 'month', groupKey: 'period', groupOrder: ['A', 'B'], trendLines: true, xAxisLabel: 'Anteil (%)', yAxisLabel: 'Preis' };

function run(code, attributes = '') {
  document.body.innerHTML = `<h3 id="heading">Diagramm</h3><div id="chart" ${attributes}></div>`;
  const setOption = [];
  const echarts = { init: jest.fn(() => ({ setOption: (option) => setOption.push(option), resize: jest.fn() })) };
  const window = { matchMedia: () => ({ matches: false, addEventListener: jest.fn() }), addEventListener: jest.fn() };
  vm.runInNewContext(code, { document, window, echarts });
  return { option: setOption[0], echarts };
}

describe('buildScatterChart', () => {
  test('validates required options and finite values', () => {
    expect(() => buildScatterChart(rows, { xKey: 'x', yKey: 'y' })).toThrow('containerId is required');
    expect(() => buildScatterChart(rows, { containerId: 'c', xKey: 'x' })).toThrow('xKey and yKey are required');
    expect(() => buildScatterChart([{ x: 1, y: null }], { containerId: 'c', xKey: 'x', yKey: 'y' })).toThrow('finite numbers');
    expect(() => buildScatterChart([{ x: '1', y: 2 }], { containerId: 'c', xKey: 'x', yKey: 'y' })).toThrow('finite numbers');
    expect(() => buildScatterChart(rows, { ...options, groupOrder: ['A'] })).toThrow('outside groupOrder');
    expect(() => buildScatterChart(rows, { ...options, groupOrder: ['A', 'B', 'C'] })).toThrow('has no rows');
  });

  test('one scatter series per group in the given order with labelled points', () => {
    const { option } = run(buildScatterChart(rows, options));
    const scatter = option.series.filter((series) => series.type === 'scatter');
    expect(scatter.map((series) => series.name)).toEqual(['A', 'B']);
    expect(scatter[0].data).toEqual([[1, 3, '2019-01'], [2, 5, '2019-02'], [3, 7, '2019-03']]);
    expect(option.legend.data).toEqual(['A', 'B']);
    expect(option.xAxis.type).toBe('value');
    expect(option.xAxis.name).toBe('Anteil (%)');
  });

  test('trend lines are least-squares segments over each group range', () => {
    const { option } = run(buildScatterChart(rows, options));
    const trends = option.series.filter((series) => series.type === 'line');
    expect(trends.map((series) => series.data)).toEqual([[[1, 3], [3, 7]], [[10, 1], [30, -1]]]);
    expect(trends.every((series) => series.silent && series.tooltip.show === false)).toBe(true);
    const { option: plain } = run(buildScatterChart(rows, { ...options, trendLines: false }));
    expect(plain.series.every((series) => series.type === 'scatter')).toBe(true);
    expect(linearFit([[0, 1], [1, 3], [2, 5]])).toEqual({ slope: 2, intercept: 1 });
    expect(() => linearFit([[1, 1], [1, 2], [1, 3]])).toThrow('varying x');
  });

  test('tooltip shows the point label, German decimals and units', () => {
    const { option } = run(buildScatterChart(rows, { ...options, xUnit: '%', yUnit: 'EUR/MWh', xDecimals: 1, yDecimals: 2 }));
    const text = option.tooltip.formatter({ seriesName: 'A', value: [44.5, 1234.5, '2019-01'] });
    expect(text).toBe('2019-01 (A)<br>Anteil (%): 44,5 %<br>Preis: 1.234,50 EUR/MWh');
  });

  test('keeps authored accessibility attributes and adds role only when missing', () => {
    const authored = 'role="img" aria-labelledby="heading" aria-describedby="summary"';
    const { option, echarts } = run(buildScatterChart(rows, options), authored);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(option.aria).toEqual({ enabled: true, label: { enabled: false } });
    expect(document.getElementById('chart').outerHTML).toBe(`<div id="chart" ${authored}></div>`);
    const { option: generated } = run(buildScatterChart(rows, options));
    expect(generated.aria.label.enabled).toBe(true);
    expect(document.getElementById('chart').getAttribute('role')).toBe('img');
  });
});
