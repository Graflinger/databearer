const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

/**
 * Load data from a CSV file
 * @param {string} filePath - Path to the CSV file
 * @returns {Array} Parsed CSV data as array of objects
 */
function loadData(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse CSV with headers
    const records = parse(fileContent, {
      columns: true,        // Use first row as headers
      skip_empty_lines: true,
      cast: true,           // Automatically convert numbers
      trim: true            // Trim whitespace
    });

    return records;
  } catch (error) {
    console.error(`Error loading data from ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Save generated chart JavaScript to a file
 * @param {string} chartJS - Generated JavaScript code
 * @param {string} outputPath - Output file path
 */
function saveChart(chartJS, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, chartJS, 'utf8');
    console.log(`✓ Generated chart: ${outputPath}`);
  } catch (error) {
    console.error(`Error saving chart to ${outputPath}:`, error.message);
    throw error;
  }
}

/**
 * Transform data by mapping keys
 * @param {Array} data - Array of objects
 * @param {Object} keyMap - Key mapping (e.g., {x: 'date', y: 'value'})
 * @returns {Array} Transformed data
 */
function transformData(data, keyMap) {
  return data.map(item => {
    const transformed = {};
    for (const [newKey, oldKey] of Object.entries(keyMap)) {
      transformed[newKey] = item[oldKey];
    }
    return transformed;
  });
}

module.exports = {
  loadData,
  saveChart,
  transformData
};
