const path = require('path');
const { loadData } = require('./utils');
const { renderComparisonChart } = require('./comparisonChart');

function comparisonEmbed(configName, containerId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(configName) || !/^[a-zA-Z0-9_-]+$/.test(containerId)) {
    throw new Error('Invalid comparison embed name');
  }
  const configs = require(`../charts/${configName}.js`);
  const matches = configs.filter((config) => config.type === 'comparison' && config.containerId === containerId);
  if (matches.length !== 1) throw new Error('Comparison embed requires exactly one matching config');
  const config = matches[0];
  const dataRoot = path.resolve(__dirname, '../data');
  const dataPath = path.resolve(dataRoot, config.dataFile);
  if (!dataPath.startsWith(`${dataRoot}${path.sep}`) || !/^[a-zA-Z0-9_-]+\.js$/.test(config.outputFile)) {
    throw new Error('Invalid comparison asset path');
  }
  return `<div id="${containerId}">${renderComparisonChart(loadData(dataPath), config)}</div>`
    + `\n<script src="/js/charts/${configName}/${config.outputFile}"></script>`;
}

module.exports = { comparisonEmbed };
