const { validateHaushaltsstrompreis, DIRECTORY } = require('../utils/haushaltsstrompreisValidation');

validateHaushaltsstrompreis();

module.exports = [
  {
    type: 'line',
    dataFile: `${DIRECTORY}/verlauf.csv`,
    outputFile: 'verlauf.js',
    containerId: 'haushaltsstrom-verlauf',
    xKey: 'Halbjahr',
    xAxisLabel: 'Halbjahr (S1 / S2)',
    yAxisLabel: 'ct/kWh',
    seriesKeys: ['Gesamt_ct_kWh', 'Ohne_Steuern_ct_kWh'],
    seriesNames: ['Mit Steuern und Abgaben', 'Ohne Steuern und Abgaben'],
    colors: ['#5470c6', '#3ba272'],
    smooth: false,
    narrowGridTop: '25%',
  },
  {
    type: 'bar',
    dataFile: `${DIRECTORY}/komponenten.csv`,
    outputFile: 'komponenten.js',
    containerId: 'haushaltsstrom-komponenten',
    xKey: 'Jahr',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'ct/kWh',
    seriesKeys: ['Energie_Vertrieb_ct_kWh', 'Netze_ct_kWh', 'Steuern_ct_kWh'],
    seriesNames: ['Energie & Vertrieb', 'Netze', 'Steuern & Abgaben'],
    colors: ['#5470c6', '#3ba272', '#e6a23c'],
    stacked: true,
    allXAxisLabels: true,
  },
  {
    type: 'bar',
    dataFile: `${DIRECTORY}/eu-auswahl.csv`,
    outputFile: 'eu-vergleich.js',
    containerId: 'haushaltsstrom-eu',
    xKey: 'Code',
    seriesKeys: ['Gesamt_ct_kWh'],
    seriesNames: ['Gesamtpreis inkl. Steuern'],
    yAxisLabel: 'ct/kWh (inkl. Steuern)',
    colors: ['#5470c6'],
    allXAxisLabels: true,
  },
];
