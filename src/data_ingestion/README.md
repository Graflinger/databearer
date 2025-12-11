# Chart Generation System

This directory contains the chart generation system for creating interactive Apache ECharts visualizations for blog posts.

## 📁 Directory Structure

```
src/data_ingestion/
├── data/                    # JSON data files (add your data here)
│   ├── example-data.json    # Example data file
│   └── multi-series-data.json
├── charts/                  # Chart configuration files (NEW!)
│   ├── examples.js          # Example chart configs
│   ├── multi-series.js      # Multi-series chart configs
│   └── industriepolitik.js  # Post-specific configs
├── builders/                # Reusable chart builder modules
│   ├── lineChart.js         # Line chart builder
│   ├── barChart.js          # Bar chart builder
│   ├── chartConfigLoader.js # Config file loader
│   └── utils.js             # Utility functions
├── generate-charts.js       # Main chart generation script
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Add Your Data

Place your JSON data files in the `data/` directory:

```json
[
  {"date": "2024-01", "value": 120},
  {"date": "2024-02", "value": 150},
  {"date": "2024-03", "value": 180}
]
```

### 2. Create Chart Configuration

Create a new `.js` file in `charts/` directory (e.g., `charts/my-charts.js`):

```javascript
module.exports = [
  {
    type: 'line',
    dataFile: 'my-data.json',
    outputFile: 'my-chart.js',
    containerId: 'my-chart',
    title: 'My Chart Title',
    xAxisLabel: 'Time',
    yAxisLabel: 'Value',
    xKey: 'date',
    yKey: 'value',
    smooth: true
  }
];
```

**Benefits of this approach:**
- One file per blog post or topic
- Easy to organize and find charts
- No need to modify `generate-charts.js`
- Automatic discovery of all chart configs

### 3. Run Chart Generation

Charts are generated automatically when you run:
- `npm start` (development server)
- `npm run build` (production build)
- `npm run build-ghpages` (GitHub Pages build)

Or manually with:
```bash
npm run build:charts
```

### 4. Use in Blog Posts

In your markdown or HTML files:

```html
<!-- Load ECharts library (once per page) -->
<script src="/js/lib/echarts.min.js"></script>

<!-- Chart container -->
<div id="my-chart" style="width: 100%; height: 400px;"></div>

<!-- Load your generated chart -->
<script src="/js/charts/my-chart.js"></script>
```

## 📊 Available Chart Types

### Line Chart

```javascript
const { buildLineChart } = require('./builders/lineChart');

buildLineChart(data, {
  containerId: 'my-line-chart',     // Required: DOM element ID
  title: 'Chart Title',             // Optional
  xAxisLabel: 'X Axis',             // Optional
  yAxisLabel: 'Y Axis',             // Optional
  xKey: 'x',                        // Default: 'x'
  yKey: 'y',                        // Default: 'y'
  smooth: false                     // Default: false
});
```

### Bar Chart

```javascript
const { buildBarChart } = require('./builders/barChart');

buildBarChart(data, {
  containerId: 'my-bar-chart',      // Required: DOM element ID
  title: 'Chart Title',             // Optional
  xAxisLabel: 'Category',           // Optional
  yAxisLabel: 'Value',              // Optional
  xKey: 'x',                        // Default: 'x'
  yKey: 'y',                        // Default: 'y'
  color: '#5470c6'                  // Optional: bar color
});
```

## 🛠️ Utility Functions

### Load Data
```javascript
const { loadData } = require('./builders/utils');
const data = loadData('path/to/data.json');
```

### Save Chart
```javascript
const { saveChart } = require('./builders/utils');
saveChart(chartJS, 'path/to/output.js');
```

### Transform Data
```javascript
const { transformData } = require('./builders/utils');
const transformed = transformData(data, {
  x: 'originalXKey',
  y: 'originalYKey'
});
```

## 📝 Example Workflow

1. **Export data from DuckDB:**
   ```sql
   COPY (SELECT date, value FROM my_table)
   TO 'src/data_ingestion/data/my-data.csv'
   (HEADER, DELIMITER ',');
   ```

2. **Generate chart in `generate-charts.js`:**
   ```javascript
   const data = loadData(path.join(DATA_DIR, 'my-data.json'));
   const chartJS = buildLineChart(data, {
     containerId: 'growth-chart',
     title: 'Growth Over Time',
     xKey: 'date',
     yKey: 'value'
   });
   saveChart(chartJS, path.join(OUTPUT_DIR, 'growth-chart.js'));
   ```

3. **Use in blog post:**
   ```html
   <script src="/js/lib/echarts.min.js"></script>
   <div id="growth-chart" style="width: 100%; height: 400px;"></div>
   <script src="/js/charts/growth-chart.js"></script>
   ```

## 🎨 Creating Custom Chart Builders

To create a new chart type:

1. Create a new file in `builders/` (e.g., `scatterChart.js`)
2. Export a builder function that returns JavaScript code
3. Use the same pattern as `lineChart.js` or `barChart.js`
4. Import and use in `generate-charts.js`

## 📚 Resources

- [Apache ECharts Documentation](https://echarts.apache.org/en/index.html)
- [ECharts Examples](https://echarts.apache.org/examples/en/index.html)
- [ECharts API Reference](https://echarts.apache.org/en/api.html)

## 🔧 Troubleshooting

### Charts not appearing?
- Check browser console for errors
- Verify the container ID matches
- Ensure ECharts library is loaded before your chart script
- Check that chart generation completed successfully

### Charts not updating?
- Run `npm run build:charts` manually
- Check `src/js/charts/` for generated files
- Clear browser cache

### Data format issues?
- Ensure JSON is valid (use a JSON validator)
- Check that xKey and yKey match your data structure
- Use the `transformData` utility if needed
