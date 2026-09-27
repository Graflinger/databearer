const { validateBatteryStorage } = require('../utils/batteryStorageValidation');

// The loader propagates validation failures before any charts are generated.
validateBatteryStorage();

// Article charts in page order. The cohort charts read battery_storage_trend.csv:
// 2019–2025 plus the incomplete snapshot year '2026*' (a lower bound). The hourly
// group uses two plots because price and solar have different units.
const TREND = '2026/battery_storage/battery_storage_trend.csv';
const COHORT_AXIS = 'Inbetriebnahmejahr (2026* bis 26. September)';

module.exports = [
  {
    type: 'line',
    dataFile: TREND,
    outputFile: 'trend.js',
    containerId: 'battery-storage-trend',
    xKey: 'Kohorte',
    xAxisLabel: COHORT_AXIS,
    yAxisLabel: 'Speicherkapazität (GWh)',
    secondaryYAxisLabel: 'Große Speicher (Anzahl)',
    seriesKeys: ['Energie_GWh', 'Gross_GWh', 'Gross_Anzahl'],
    seriesNames: ['Kapazität gesamt (GWh)', 'Große Speicher (GWh)', 'Große Speicher (Anzahl)'],
    seriesYAxisIndex: [0, 0, 1],
    // The three-entry legend wraps to two or three lines on phones.
    narrowGridTop: '30%',
    narrowShortYearLabels: true,
    smooth: false,
  },
  {
    type: 'bar',
    dataFile: TREND,
    outputFile: 'segments.js',
    containerId: 'battery-storage-segments',
    xKey: 'Kohorte',
    xAxisLabel: COHORT_AXIS,
    yAxisLabel: 'Speicherkapazität (GWh)',
    seriesKeys: ['Klein_GWh', 'Mittel_GWh', 'Gross_GWh'],
    seriesNames: ['Klein', 'Mittel', 'Groß'],
    stacked: true,
    narrowShortYearLabels: true,
  },
  {
    type: 'line',
    dataFile: TREND,
    outputFile: 'duration.js',
    containerId: 'battery-storage-duration',
    xKey: 'Kohorte',
    xAxisLabel: COHORT_AXIS,
    yAxisLabel: 'Median E/P (Stunden)',
    yKey: 'Median_Stunden',
    narrowShortYearLabels: true,
    smooth: false,
  },
  {
    type: 'line',
    dataFile: '2026/battery_storage/battery_storage_daily_profile.csv',
    outputFile: 'daily-price.js',
    containerId: 'battery-storage-daily-price',
    xKey: 'Stunde',
    xAxisLabel: 'Stunde (Europe/Berlin)',
    yAxisLabel: 'Day-Ahead-Preis (EUR/MWh)',
    yKey: 'Preis_EUR_MWh',
    smooth: false,
  },
  {
    type: 'line',
    dataFile: '2026/battery_storage/battery_storage_daily_profile.csv',
    outputFile: 'daily-solar.js',
    containerId: 'battery-storage-daily-solar',
    xKey: 'Stunde',
    xAxisLabel: 'Stunde (Europe/Berlin)',
    yAxisLabel: 'Solarerzeugung (GW)',
    yKey: 'Solar_GW',
    smooth: false,
  },
];
