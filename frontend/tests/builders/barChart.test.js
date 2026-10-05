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

describe('optional y-axis bounds', () => {
  const data = [{ x: 'A', y: -0.9 }, { x: 'B', y: 0.97 }];
  test('are emitted only when configured', () => {
    expect(buildBarChart(data, { containerId: 'c' })).not.toMatch(/\bmin: |\bmax: /);
    const code = buildBarChart(data, { containerId: 'c', yAxisMin: -1, yAxisMax: 1 });
    expect(code).toMatch(/type: 'value',\n\s+min: -1,\n\s+max: 1,/);
  });
  test('reject invalid bounds', () => {
    expect(() => buildBarChart(data, { containerId: 'c', yAxisMin: 1, yAxisMax: -1 })).toThrow('below');
    expect(() => buildBarChart(data, { containerId: 'c', yAxisMax: Number.NaN })).toThrow('finite');
  });
});

test('allXAxisLabels keeps every category label', () => {
  const data = [{ x: '2019–2025', y: 1 }, { x: '2019–2020', y: 2 }];
  expect(buildBarChart(data, { containerId: 'c' })).not.toContain('interval: 0');
  expect(buildBarChart(data, { containerId: 'c', allXAxisLabels: true })).toMatch(/interval: 0,\n\s+\.\.\.\(chartDom\.clientWidth < 600 \? \{\n\s+fontSize: 11,/);
});
