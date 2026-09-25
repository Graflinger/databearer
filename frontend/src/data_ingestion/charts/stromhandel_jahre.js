const { validateStromhandel } = require('../utils/stromhandelValidation');

validateStromhandel();

module.exports = [
  {
    type: 'bar',
    dataFile: '2026/stromhandel/stromhandel_jahre_2019_2025.csv',
    outputFile: 'importe_exporte.js',
    containerId: 'stromhandel-jahre-importe-exporte',
    title: '',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'TWh',
    xKey: 'jahr',
    seriesKeys: ['importe_twh', 'exporte_twh'],
    seriesNames: ['Importe', 'Exporte'],
    colors: ['#5470c6', '#d5a62c'],
    stacked: false,
  },
  {
    type: 'line',
    dataFile: '2026/stromhandel/stromhandel_jahre_2019_2025.csv',
    outputFile: 'nettoexport.js',
    containerId: 'stromhandel-jahre-nettoexport',
    title: '',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'TWh',
    xKey: 'jahr',
    seriesKeys: ['nettoexport_twh'],
    seriesNames: ['Nettoexport'],
    smooth: false,
    colors: ['#469c8a'],
  },
];
