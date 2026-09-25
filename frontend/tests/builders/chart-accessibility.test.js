/** @jest-environment jsdom */
const vm = require('vm');
const { buildLineChart } = require('../../src/data_ingestion/builders/lineChart');
const { buildBarChart } = require('../../src/data_ingestion/builders/barChart');

describe.each([['line', buildLineChart], ['bar', buildBarChart]])('%s chart accessibility', (_type, build) => {
  test.each([
    ['', true],
    ['role="img" aria-label="Autorentext" aria-describedby="summary"', false],
    ['role="group" aria-labelledby="heading" aria-describedby="summary"', false],
  ])('preserves existing semantics and enables ARIA (%s)', (attributes, generateLabel) => {
    document.body.innerHTML = `<h3 id="heading">Diagramm</h3><p id="summary">Zusammenfassung</p><div id="chart" ${attributes}></div>`;
    const container = document.getElementById('chart');
    const original = container.outerHTML;
    const options = [];
    const echarts = { init: jest.fn(() => ({ setOption: (option) => {
      options.push(option);
      if (option.aria.label.enabled) container.setAttribute('aria-label', 'Generated chart description');
    } })) };
    const listeners = {};
    const window = {
      matchMedia: () => ({ matches: false, addEventListener: (event, callback) => { listeners[event] = callback; } }),
      addEventListener: jest.fn(),
    };
    vm.runInNewContext(build([{ x: 2024, y: 0 }, { x: 2025, y: null }], { containerId: 'chart', yAxisLabel: 'kW' }), { document, window, echarts });
    expect(echarts.init).toHaveBeenCalledWith(container);
    expect(options[0].aria.enabled).toBe(true);
    expect(options[0].aria.label.enabled).toBe(generateLabel);
    expect(options[0].series[0].name).toBe('kW');
    expect(options[0].series[0].data).toEqual([0, null]);
    if (attributes) expect(container.outerHTML).toBe(original);
    else expect(container.getAttribute('role')).toBe('img');
    listeners.change();
    expect(options[1].aria.label.enabled).toBe(generateLabel);
    expect(document.querySelector('table')).toBeNull();
  });

  test('lazy initialization waits for visibility and retains article description', () => {
    document.body.innerHTML = '<p id="summary">Statische Zusammenfassung</p><div id="chart" role="img" aria-label="Windenergie" aria-describedby="summary"></div>';
    let onIntersection;
    const observer = { observe: jest.fn(), unobserve: jest.fn() };
    function IntersectionObserver(callback) { onIntersection = callback; return observer; }
    const chart = { setOption: jest.fn() };
    const echarts = { init: jest.fn(() => chart) };
    const window = { IntersectionObserver, addEventListener: jest.fn() };
    vm.runInNewContext(build([], { containerId: 'chart' }), { document, window, echarts, IntersectionObserver });
    expect(echarts.init).not.toHaveBeenCalled();
    onIntersection([{ isIntersecting: false }]);
    expect(echarts.init).not.toHaveBeenCalled();
    onIntersection([{ isIntersecting: true }]);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(chart.setOption.mock.calls[0][0].series[0].data).toEqual([]);
    expect(document.getElementById('chart').getAttribute('aria-describedby')).toBe('summary');
    expect(observer.unobserve).toHaveBeenCalledWith(document.getElementById('chart'));
    expect(document.querySelector('table')).toBeNull();
  });
});
