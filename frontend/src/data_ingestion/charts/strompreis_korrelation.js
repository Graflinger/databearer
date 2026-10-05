const { validateStrompreisKorrelation, DIRECTORY, PERIODS } = require('../utils/strompreisKorrelationValidation');

// Fails the chart build before generation if the frozen set is incomplete or edited.
validateStrompreisKorrelation();

const MONTHLY = `${DIRECTORY}/strompreis_korrelation_monthly.csv`;
const CORRELATIONS = `${DIRECTORY}/strompreis_korrelation_correlations.csv`;
const CURRENT = `${DIRECTORY}/strompreis_korrelation_2026.csv`;
// One color per period, reused in both scatterplots.
const PERIOD_COLORS = ['#3ba272', '#d9534f', '#5470c6'];

module.exports = [
  {
    type: 'line',
    dataFile: MONTHLY,
    outputFile: 'verlauf.js',
    containerId: 'strompreis-gaspreis-verlauf',
    xKey: 'Monat',
    xAxisLabel: 'Monat',
    yAxisLabel: 'EUR/MWh',
    seriesKeys: ['Strompreis_EUR_MWh', 'Gaspreis_EUR_MWh'],
    seriesNames: ['Strompreis Day-Ahead DE-LU', 'Gaspreis TTF (Monatsmittel)'],
    colors: ['#5470c6', '#e6a23c'],
    smooth: false,
  },
  {
    type: 'scatter',
    dataFile: MONTHLY,
    outputFile: 'streuung-gas.js',
    containerId: 'strompreis-streuung-gas',
    xKey: 'Gaspreis_EUR_MWh',
    yKey: 'Strompreis_EUR_MWh',
    labelKey: 'Monat',
    groupKey: 'Zeitraum',
    groupOrder: PERIODS,
    xAxisLabel: 'Gaspreis (EUR/MWh)',
    yAxisLabel: 'Strompreis (EUR/MWh)',
    xUnit: 'EUR/MWh',
    yUnit: 'EUR/MWh',
    xDecimals: 1,
    yDecimals: 1,
    trendLines: true,
    colors: PERIOD_COLORS,
  },
  {
    type: 'scatter',
    dataFile: MONTHLY,
    outputFile: 'streuung-erneuerbare.js',
    containerId: 'strompreis-streuung-erneuerbare',
    xKey: 'Erneuerbarenanteil_Prozent',
    yKey: 'Strompreis_EUR_MWh',
    labelKey: 'Monat',
    groupKey: 'Zeitraum',
    groupOrder: PERIODS,
    xAxisLabel: 'Erneuerbarenanteil (%)',
    yAxisLabel: 'Strompreis (EUR/MWh)',
    xUnit: '%',
    yUnit: 'EUR/MWh',
    xDecimals: 1,
    yDecimals: 1,
    trendLines: true,
    colors: PERIOD_COLORS,
  },
  {
    type: 'bar',
    dataFile: CORRELATIONS,
    outputFile: 'korrelationen.js',
    containerId: 'strompreis-korrelationen',
    xKey: 'Zeitraum',
    xAxisLabel: 'Zeitraum',
    yAxisLabel: 'Korrelation mit dem Strompreis',
    // Correlations are bounded by definition; avoid misleading ±1.2 ticks.
    yAxisMin: -1,
    yAxisMax: 1,
    allXAxisLabels: true,
    seriesKeys: ['Pearson_Erneuerbare', 'Pearson_Gas'],
    seriesNames: ['Erneuerbarenanteil', 'Gaspreis'],
    colors: ['#3ba272', '#e6a23c'],
  },
  {
    type: 'line',
    dataFile: CURRENT,
    outputFile: 'erwartung-2026.js',
    containerId: 'strompreis-erwartung-2026',
    xKey: 'Monat',
    xAxisLabel: 'Monat 2026',
    yAxisLabel: 'EUR/MWh',
    seriesKeys: ['Strompreis_EUR_MWh', 'Erwartet_EUR_MWh', 'Gaspreis_EUR_MWh'],
    seriesNames: ['Strompreis', 'Erwartet nach 2023–2025', 'Gaspreis TTF'],
    colors: ['#5470c6', '#9e9e9e', '#e6a23c'],
    smooth: false,
    narrowGridTop: '24%',
  },
];
