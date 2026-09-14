const { validateErneuerbareWachstum } = require('../utils/erneuerbareWachstumValidation');
validateErneuerbareWachstum();

module.exports = [
  { type: 'line', dataFile: '2026/erneuerbare_wachstum/capacity.csv', outputFile: 'leistung.js',
    containerId: 'erneuerbare-wachstum-leistung', title: '', xKey: 'year', xAxisLabel: 'Jahr', yAxisLabel: 'GW',
    seriesKeys: ['solar_gw', 'wind_onshore_gw', 'wind_offshore_gw'], seriesNames: ['Solar', 'Wind Land', 'Wind See'], smooth: false },
  { type: 'line', dataFile: '2026/erneuerbare_wachstum/generation.csv', outputFile: 'erzeugung.js',
    containerId: 'erneuerbare-wachstum-erzeugung', title: '', xKey: 'year', xAxisLabel: 'Jahr', yAxisLabel: 'TWh',
    seriesKeys: ['solar_twh', 'wind_onshore_twh', 'wind_offshore_twh'], seriesNames: ['Solar', 'Wind Land', 'Wind See'], smooth: false },
];
