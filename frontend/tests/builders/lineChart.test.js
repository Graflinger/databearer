const { buildLineChart } = require('../../src/data_ingestion/builders/lineChart');

describe('buildLineChart', () => {
  it('requires a containerId', () => {
    expect(() => buildLineChart([], {})).toThrow('containerId is required');
  });

  it('builds single-series chart output', () => {
    const data = [
      { x: 'Jan', y: 10 },
      { x: 'Feb', y: 20 },
    ];

    const result = buildLineChart(data, {
      containerId: 'chart-1',
      title: 'Sales',
      xAxisLabel: 'Month',
      yAxisLabel: 'Revenue',
    });

    expect(result).toContain("document.getElementById('chart-1')");
    expect(result).toContain('text: "Sales"');
    expect(result).toContain('name: "Month"');
    expect(result).toContain('name: "Revenue"');
    expect(result).toContain("type: 'line'");
  });

  it('builds multi-series chart output', () => {
    const data = [
      { x: 'Jan', sales: 10, expenses: 5 },
      { x: 'Feb', sales: 12, expenses: 6 },
    ];

    const result = buildLineChart(data, {
      containerId: 'chart-2',
      xKey: 'x',
      seriesKeys: ['sales', 'expenses'],
      seriesNames: ['Sales', 'Expenses'],
      colors: ['#111111', '#222222'],
    });

    expect(result).toContain("document.getElementById('chart-2')");
    expect(result).toContain('Sales');
    expect(result).toContain('Expenses');
    expect(result).toContain('#111111');
  });

  it('adds an optional right-hand axis without changing default output', () => {
    const data = [{ x: '2025', a: 1, b: 100 }, { x: '2026*', a: 2, b: 200 }];
    const base = { containerId: 'dual', xKey: 'x', seriesKeys: ['a', 'b'], yAxisLabel: 'GWh' };
    expect(buildLineChart(data, base)).not.toContain('yAxisIndex');
    expect(buildLineChart(data, base)).not.toContain('clientWidth');
    const dual = buildLineChart(data, { ...base, secondaryYAxisLabel: 'Anzahl', seriesYAxisIndex: [0, 1] });
    expect(dual).toContain('yAxis: [{');
    expect(dual).toContain('name: "Anzahl"');
    expect(dual).toContain('yAxisIndex: series.yAxisIndex');
    expect(dual).toContain('"yAxisIndex":1');
    expect(() => buildLineChart(data, { ...base, secondaryYAxisLabel: 'Anzahl' })).toThrow('seriesYAxisIndex');
    expect(() => buildLineChart(data, { ...base, secondaryYAxisLabel: 'Anzahl', seriesYAxisIndex: [0, 2] })).toThrow('seriesYAxisIndex');
    const narrow = buildLineChart(data, { ...base, narrowGridTop: '30%', narrowShortYearLabels: true });
    expect(narrow).toContain('chartDom.clientWidth < 600 ? "30%"');
    expect(narrow).toContain('interval: 0');
  });
});
