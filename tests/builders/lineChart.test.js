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
});
