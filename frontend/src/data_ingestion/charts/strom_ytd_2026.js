const { validateStromYtd } = require('../utils/stromYtdValidation');

validateStromYtd();

module.exports = [
  {
    type: 'bar',
    dataFile: '2026/strom_ytd/comparison.csv',
    outputFile: 'mix.js',
    containerId: 'strom-ytd-2026-mix',
    title: '',
    xAxisLabel: 'Jeweils 1.1.–9.9.',
    yAxisLabel: 'TWh',
    xKey: 'year',
    seriesKeys: ['wind_onshore_twh', 'solar_twh'],
    seriesNames: ['Wind an Land', 'Solar'],
    colors: ['#3ba272', '#d5a62c'],
    stacked: false,
  },
  {
    type: 'line',
    dataFile: '2026/strom_ytd/periods.csv',
    outputFile: 'renewable-share.js',
    containerId: 'strom-ytd-2026-renewable-share',
    xKey: 'year',
    xAxisLabel: 'Jeweils 1.1.–9.9.',
    yAxisLabel: '%',
    seriesKeys: ['renewable_share_pct'],
    seriesNames: ['Erneuerbarenanteil'],
    colors: ['#3ba272'],
    smooth: false,
  },
  {
    type: 'line',
    dataFile: '2026/strom_ytd/periods.csv',
    outputFile: 'price.js',
    containerId: 'strom-ytd-2026-price',
    xKey: 'year',
    xAxisLabel: 'Jeweils 1.1.–9.9.',
    yAxisLabel: '€/MWh',
    seriesKeys: ['price_eur_mwh'],
    seriesNames: ['Day-Ahead-Preis'],
    colors: ['#d5a62c'],
    smooth: false,
  },
];
