# Chart Configurations Directory

This directory contains modular chart configuration files. Each file exports an array of chart configurations that will be automatically discovered and generated.

## 📝 File Organization

Organize your chart configs by blog post or topic:

```
charts/
├── examples.js           # Example/demo charts
├── multi-series.js      # Multi-series examples
├── industriepolitik.js  # Charts for Industriepolitik post
├── energy-data.js       # Energy-related charts
└── economics.js         # Economics charts
```

## 🎯 Configuration Format

Each `.js` file should export an array of chart configurations:

```javascript
module.exports = [
  {
    // Required fields
    type: 'line', // 'line' or 'bar'
    dataFile: 'my-data.json', // File in data/ directory
    outputFile: 'my-chart.js', // Output filename
    containerId: 'my-chart', // HTML element ID

    // Chart options (optional)
    title: 'Chart Title',
    xAxisLabel: 'X Axis',
    yAxisLabel: 'Y Axis',
    xKey: 'x',
    yKey: 'y',

    // Line chart specific
    smooth: true,

    // Bar chart specific
    color: '#5470c6',
    stacked: false,

    // Multi-series (both line and bar)
    seriesKeys: ['sales', 'expenses', 'profit'],
    seriesNames: ['Sales', 'Expenses', 'Profit'],
    colors: ['#5470c6', '#91cc75', '#fac858'],
  },
];
```

## 🔄 Workflow

1. **Add data file** to `data/` directory
2. **Create config file** in `charts/` directory
3. **Run** `npm run build:charts`
4. **Use chart** in your blog post

## 📊 Examples

### Single Line Chart

```javascript
module.exports = [
  {
    type: 'line',
    dataFile: 'solar-prices.json',
    outputFile: 'solar-prices-chart.js',
    containerId: 'solar-prices-chart',
    title: 'Solar PV Price Decline',
    xAxisLabel: 'Year',
    yAxisLabel: 'Price ($/Watt)',
    xKey: 'year',
    yKey: 'price',
    smooth: true,
  },
];
```

### Multi-Series Line Chart

```javascript
module.exports = [
  {
    type: 'line',
    dataFile: 'quarterly-results.json',
    outputFile: 'quarterly-chart.js',
    containerId: 'quarterly-chart',
    title: 'Quarterly Performance',
    xAxisLabel: 'Quarter',
    yAxisLabel: 'Revenue ($M)',
    xKey: 'quarter',
    seriesKeys: ['revenue', 'costs', 'profit'],
    seriesNames: ['Revenue', 'Costs', 'Profit'],
    smooth: false,
  },
];
```

### Grouped Bar Chart

```javascript
module.exports = [
  {
    type: 'bar',
    dataFile: 'energy-mix.json',
    outputFile: 'energy-mix-chart.js',
    containerId: 'energy-mix-chart',
    title: 'Energy Mix by Country',
    xAxisLabel: 'Country',
    yAxisLabel: 'TWh',
    xKey: 'country',
    seriesKeys: ['solar', 'wind', 'hydro'],
    seriesNames: ['Solar', 'Wind', 'Hydro'],
    stacked: false,
  },
];
```

### Stacked Bar Chart

```javascript
module.exports = [
  {
    type: 'bar',
    dataFile: 'emissions.json',
    outputFile: 'emissions-chart.js',
    containerId: 'emissions-chart',
    title: 'CO2 Emissions by Sector',
    xAxisLabel: 'Year',
    yAxisLabel: 'MtCO2',
    xKey: 'year',
    seriesKeys: ['transport', 'industry', 'buildings'],
    seriesNames: ['Transport', 'Industry', 'Buildings'],
    stacked: true,
  },
];
```

## 💡 Tips

- **One file per topic**: Keep related charts together
- **Descriptive names**: Use meaningful file and chart names
- **Consistent IDs**: Use unique container IDs for each chart
- **Comments**: Add comments to explain complex configurations
- **Test incrementally**: Generate and test charts one at a time

## 🚨 Common Issues

**Charts not generating?**

- Check that your file exports an array
- Verify all required fields are present
- Check data file exists in `data/` directory

**Empty file?**

- Export an empty array: `module.exports = [];`
- Add configurations as you create them
