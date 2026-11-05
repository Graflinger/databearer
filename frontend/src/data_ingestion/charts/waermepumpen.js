const { validateWaermepumpen } = require('../utils/waermepumpenValidation');

validateWaermepumpen();

module.exports = [
  {
    type: 'line',
    dataFile: '2026/waermepumpen/anteil.csv',
    outputFile: 'anteil.js',
    containerId: 'waermepumpen-anteil',
    xKey: 'Jahr',
    xAxisLabel: 'Fertigstellungsjahr',
    yAxisLabel: 'Anteil neuer Wohngebäude (%)',
    seriesKeys: ['Waermepumpen_Prozent', 'Erdgas_Prozent'],
    seriesNames: ['Wärmepumpe (Hauptheizung)', 'Erdgas (Hauptheizung)'],
    colors: ['#91cc75', '#9aa0a6'],
    smooth: false,
  },
  {
    type: 'bar',
    dataFile: '2026/waermepumpen/neubau.csv',
    outputFile: 'neubau.js',
    containerId: 'waermepumpen-neubau',
    xKey: 'Jahr',
    xAxisLabel: 'Fertigstellungsjahr',
    yAxisLabel: 'Neue Wohngebäude (Anzahl)',
    seriesKeys: ['Wohngebaeude_Insgesamt', 'Waermepumpen_Gebaeude_Geschaetzt'],
    seriesNames: ['Insgesamt (gerundet)', 'Mit Wärmepumpe (geschätzt)'],
    colors: ['#9aa0a6', '#91cc75'],
    stacked: false,
    yAxisMin: 0,
  },
];
