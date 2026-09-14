const { validateNetzeingriffe } = require('../utils/netzeingriffeValidation');

validateNetzeingriffe();

module.exports = [
  {
    type: 'bar',
    dataFile: '2026/netzeingriffe/netzeingriffe_jahre_2015_2025.csv',
    outputFile: 'massnahmenenergie.js',
    containerId: 'netzeingriffe-jahre-massnahmenenergie',
    title: '',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'GWh',
    xKey: 'jahr',
    seriesKeys: ['massnahmenenergie_gwh'],
    seriesNames: ['Maßnahmenenergie'],
    colors: ['#d5a62c'],
  },
  {
    type: 'line',
    dataFile: '2026/netzeingriffe/netzeingriffe_jahre_2015_2025.csv',
    outputFile: 'kosten.js',
    containerId: 'netzeingriffe-jahre-kosten',
    title: '',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'Mio. €',
    xKey: 'jahr',
    seriesKeys: ['kosten_mio_eur'],
    seriesNames: ['Nominale Kosten'],
    smooth: false,
    colors: ['#cb6573'],
  },
  {
    type: 'line',
    dataFile: '2026/netzeingriffe/netzeingriffe_monate_2022_2026.csv',
    outputFile: 'monate.js',
    containerId: 'netzeingriffe-monate',
    title: '',
    xAxisLabel: 'Monat',
    yAxisLabel: 'GWh',
    xKey: 'monat',
    seriesKeys: ['gesamt_gwh', 'redispatch_marktkraftwerke_gwh'],
    // Full definitions are immediately above the chart; these labels fit mobile widths.
    seriesNames: ['Gesamt', 'davon Markt-Redispatch'],
    colors: ['#5470c6', '#469c8a'],
    smooth: false,
  },
];
