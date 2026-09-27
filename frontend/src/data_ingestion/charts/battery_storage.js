const { validateBatteryStorage } = require('../utils/batteryStorageValidation');

// The loader propagates validation failures before any charts are generated.
validateBatteryStorage();

// Five evidence groups; the hourly group uses separate scales because the
// existing line builder has a single y-axis. Both plots read the same hours.
module.exports = [
  {
    type: 'line',
    dataFile: '2026/battery_storage/battery_storage_cohorts.csv',
    outputFile: 'cohorts.js',
    containerId: 'battery-storage-cohorts',
    xKey: 'Jahr',
    xAxisLabel: 'Inbetriebnahme-Kohorte',
    yAxisLabel: 'Index (2024 = 100)',
    seriesKeys: ['Anzahl_Index', 'Energie_Index'],
    seriesNames: ['Anlagenzahl', 'Speicherkapazität'],
    smooth: false,
  },
  {
    type: 'bar',
    dataFile: '2026/battery_storage/battery_storage_segments.csv',
    outputFile: 'segments.js',
    containerId: 'battery-storage-segments',
    xKey: 'Jahr',
    xAxisLabel: 'Inbetriebnahme-Kohorte',
    yAxisLabel: 'Speicherkapazität (GWh)',
    seriesKeys: ['Klein_GWh', 'Mittel_GWh', 'Gross_GWh'],
    seriesNames: ['Klein', 'Mittel', 'Groß'],
    stacked: true,
  },
  {
    type: 'line',
    dataFile: '2026/battery_storage/battery_storage_duration.csv',
    outputFile: 'duration.js',
    containerId: 'battery-storage-duration',
    xKey: 'Jahr',
    xAxisLabel: 'Inbetriebnahme-Kohorte',
    yAxisLabel: 'Median E/P (Stunden)',
    yKey: 'Median_Stunden',
    smooth: false,
  },
  {
    // Includes the incomplete snapshot year ('2026*'), a lower bound. Energy on
    // the left axis, the number of large plants on the right axis.
    type: 'line',
    dataFile: '2026/battery_storage/battery_storage_trend.csv',
    outputFile: 'trend.js',
    containerId: 'battery-storage-trend',
    xKey: 'Kohorte',
    xAxisLabel: 'Inbetriebnahme-Kohorte (2026* bis 26. September)',
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
