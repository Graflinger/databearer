const { buildBarChart } = require('../../src/data_ingestion/builders/barChart');

describe('buildBarChart', () => {
  it('requires a containerId', () => {
    expect(() => buildBarChart([], {})).toThrow('containerId is required');
  });

  it('builds single-series chart output', () => {
    const data = [
      { x: 'Jan', y: 3 },
      { x: 'Feb', y: 7 },
    ];

    const result = buildBarChart(data, {
      containerId: 'bar-1',
      title: 'Totals',
      xAxisLabel: 'Month',
      yAxisLabel: 'Count',
      color: '#333333',
    });

    expect(result).toContain("document.getElementById('bar-1')");
    expect(result).toContain('text: "Totals"');
    expect(result).toContain('name: "Month"');
    expect(result).toContain('name: "Count"');
    expect(result).toContain("type: 'bar'");
  });

  it('supports stacked charts', () => {
    const data = [
      { x: 'Jan', sales: 10, expenses: 4 },
      { x: 'Feb', sales: 8, expenses: 3 },
    ];

    const result = buildBarChart(data, {
      containerId: 'bar-2',
      xKey: 'x',
      seriesKeys: ['sales', 'expenses'],
      stacked: true,
    });

    expect(result).toContain('const stacked = true');
  });
});
