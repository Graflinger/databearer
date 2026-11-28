const { validateEnergieintensiveIndustrie, DIRECTORY } = require('../utils/energieintensiveIndustrieValidation');

validateEnergieintensiveIndustrie();

module.exports = [
  {
    type: 'line',
    dataFile: `${DIRECTORY}/production.csv`,
    outputFile: 'produktion.js',
    containerId: 'energieintensive-produktion',
    xKey: 'Monat',
    xAxisLabel: 'Monat',
    yAxisLabel: 'Index (2021 = 100)',
    seriesKeys: ['Industrie', 'Energieintensiv'],
    seriesNames: ['Industrie insgesamt', 'Energieintensive Zweige'],
    colors: ['#5470c6', '#d9534f'],
    smooth: false,
    narrowGridTop: '23%',
  },
  {
    type: 'line',
    dataFile: `${DIRECTORY}/electricity_prices.csv`,
    outputFile: 'strompreise.js',
    containerId: 'industrie-strompreise',
    xKey: 'Halbjahr',
    xAxisLabel: 'Halbjahr (S1 / S2)',
    yAxisLabel: 'ct/kWh',
    seriesKeys: ['Deutschland_ct_kWh', 'EU27_ct_kWh'],
    seriesNames: ['Deutschland', 'EU-27'],
    colors: ['#5470c6', '#3ba272'],
    smooth: false,
  },
];
