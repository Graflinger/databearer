#!/usr/bin/env node

/**
 * Chart Generation Script
 *
 * This script automatically discovers and generates all charts defined
 * in the charts/ configuration directory.
 *
 * Usage: node "src/data_ingestion/generate-charts.js"
 *
 * To add new charts:
 * 1. Create CSV data files in src/data_ingestion/data/
 * 2. Create a new .js file in src/data_ingestion/charts/
 * 3. Export an array of chart configurations referencing your CSV files
 * 4. Run: npm run build:charts
 */

const path = require('path');
const { buildLineChart } = require('./builders/lineChart');
const { buildBarChart } = require('./builders/barChart');
const { loadData, saveChart } = require('./builders/utils');
const { loadChartConfigs } = require('./builders/chartConfigLoader');

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_DIR = path.join(__dirname, '../js/charts');
const CHARTS_DIR = path.join(__dirname, 'charts');

console.log('🎨 Generating charts...\n');

// Load all chart configurations
const chartConfigs = loadChartConfigs(CHARTS_DIR);

if (chartConfigs.length === 0) {
  console.log('⚠ No chart configurations found in charts/ directory');
  console.log('  Create .js files in src/data_ingestion/charts/ to define your charts');
  process.exit(0);
}

console.log(`\nFound ${chartConfigs.length} chart(s) to generate\n`);

// Generate each chart
let successCount = 0;
let errorCount = 0;

for (const config of chartConfigs) {
  try {
    // Validate config
    if (!config.type) {
      throw new Error('Chart config must specify "type" (line or bar)');
    }
    if (!config.dataFile) {
      throw new Error('Chart config must specify "dataFile"');
    }
    if (!config.outputFile) {
      throw new Error('Chart config must specify "outputFile"');
    }
    if (!config.containerId) {
      throw new Error('Chart config must specify "containerId"');
    }

    // Load data
    const dataPath = path.join(DATA_DIR, config.dataFile);
    const data = loadData(dataPath);

    // Select builder based on type
    let buildFn;
    if (config.type === 'line') {
      buildFn = buildLineChart;
    } else if (config.type === 'bar') {
      buildFn = buildBarChart;
    } else {
      throw new Error(`Unknown chart type: ${config.type}. Use 'line' or 'bar'`);
    }

    // Build chart configuration (remove metadata fields)
    const { outputFile, _sourceFile, ...chartOptions } = config;

    // Generate chart JavaScript
    const chartJS = buildFn(data, chartOptions);

    // Save chart with subdirectory based on source file
    const outputSubDir = _sourceFile || 'default';
    const outputPath = path.join(OUTPUT_DIR, outputSubDir, outputFile);
    saveChart(chartJS, outputPath);

    successCount++;
  } catch (error) {
    console.error(`✗ Failed to generate ${config.outputFile || 'chart'}:`, error.message);
    errorCount++;
  }
}

// Summary
console.log(`\n✨ Chart generation complete!`);
console.log(`   ✓ ${successCount} chart(s) generated successfully`);
if (errorCount > 0) {
  console.log(`   ✗ ${errorCount} chart(s) failed`);
}
