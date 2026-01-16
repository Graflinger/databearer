const fs = require('fs');
const path = require('path');

/**
 * Load all chart configuration files from the charts directory
 * @param {string} chartsDir - Path to the charts directory
 * @param {string} [specificFile] - Optional specific file to load (e.g., "industriepolitik.js")
 * @returns {Array} Array of chart configurations with source file metadata
 */
function loadChartConfigs(chartsDir, specificFile = null) {
  const configs = [];

  if (!fs.existsSync(chartsDir)) {
    console.warn(`Charts directory not found: ${chartsDir}`);
    return configs;
  }

  let files;
  if (specificFile) {
    // Load only the specific file
    files = [specificFile];
    console.log(`Loading specific file: ${specificFile}`);
  } else {
    // Load all .js files in the directory
    files = fs.readdirSync(chartsDir);
  }

  for (const file of files) {
    // Only load .js files
    if (!file.endsWith('.js')) {
      continue;
    }

    const filePath = path.join(chartsDir, file);
    // Get filename without extension for subdirectory name
    const sourceFileName = path.basename(file, '.js');

    try {
      const configModule = require(filePath);

      // Support both default export and named exports
      const chartConfigs = configModule.default || configModule.charts || configModule;

      if (Array.isArray(chartConfigs)) {
        // Add source file metadata to each config
        const configsWithMetadata = chartConfigs.map(config => ({
          ...config,
          _sourceFile: sourceFileName
        }));
        configs.push(...configsWithMetadata);
        console.log(`✓ Loaded ${chartConfigs.length} chart(s) from ${file}`);
      } else {
        console.warn(`⚠ Skipping ${file}: does not export an array of charts`);
      }
    } catch (error) {
      console.error(`✗ Error loading ${file}:`, error.message);
    }
  }

  return configs;
}

/**
 * Process a single chart configuration
 * @param {Object} config - Chart configuration object
 * @param {Function} buildFn - Chart builder function (buildLineChart or buildBarChart)
 * @param {Object} data - Chart data
 * @returns {string} Generated chart JavaScript
 */
function processChartConfig(config, buildFn, data) {
  if (!config.containerId) {
    throw new Error('Chart config must include containerId');
  }

  return buildFn(data, config);
}

module.exports = {
  loadChartConfigs,
  processChartConfig
};
