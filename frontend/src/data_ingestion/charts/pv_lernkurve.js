const { validatePvLernkurve, DIRECTORY } = require('../utils/pvLernkurveValidation');

// Fails the chart build before generation if the frozen set is incomplete or edited.
validatePvLernkurve();

const ZUBAU = `${DIRECTORY}/pv_lernkurve_zubau.csv`;
const MODULPREIS = `${DIRECTORY}/pv_lernkurve_modulpreis.csv`;
const GERMANY = '#e6a23c';

module.exports = [
  {
    type: 'line',
    dataFile: ZUBAU,
    outputFile: 'anteil.js',
    containerId: 'pv-anteil-deutschland',
    xKey: 'Jahr',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'Anteil Deutschlands (%)',
    seriesKeys: ['Anteil_Zubau_Deutschland_Prozent', 'Anteil_Bestand_Deutschland_Prozent'],
    seriesNames: ['am weltweiten Zubau des Jahres', 'an der weltweit installierten Leistung'],
    colors: [GERMANY, '#5470c6'],
    smooth: false,
    narrowGridTop: '24%',
  },
  {
    type: 'line',
    dataFile: MODULPREIS,
    outputFile: 'modulpreis.js',
    containerId: 'pv-modulpreis',
    xKey: 'Jahr',
    yKey: 'Modulpreis_USD_W',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'US-Dollar je Watt (Preise von 2025)',
    smooth: false,
  },
  {
    type: 'bar',
    dataFile: ZUBAU,
    outputFile: 'zubau.js',
    containerId: 'pv-zubau-welt',
    xKey: 'Jahr',
    xAxisLabel: 'Jahr',
    yAxisLabel: 'Zubau (GW)',
    seriesKeys: ['Zubau_Deutschland_GW', 'Zubau_China_GW', 'Zubau_Uebrige_Welt_GW'],
    seriesNames: ['Deutschland', 'China', 'Übrige Welt'],
    colors: [GERMANY, '#d9534f', '#5470c6'],
    stacked: true,
  },
];
