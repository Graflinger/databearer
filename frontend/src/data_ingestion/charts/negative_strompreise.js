const { validateNegativeStrompreise, DIRECTORY } = require('../utils/negativeStrompreiseValidation');

// A missing, mixed or invalid supporting export also stops chart generation.
validateNegativeStrompreise();

module.exports = [
  {
    type: 'bar',
    dataFile: `${DIRECTORY}/annual.csv`,
    outputFile: 'annual.js',
    containerId: 'negative-preise-jahre',
    xKey: 'Zeitraum',
    yKey: 'Negative_Stunden',
    xAxisLabel: 'Vollständiges Kalenderjahr',
    yAxisLabel: 'Stundenäquivalente',
  },
  {
    type: 'bar',
    dataFile: `${DIRECTORY}/quarterly.csv`,
    outputFile: 'quarters.js',
    containerId: 'negative-preise-quartale',
    xKey: 'Zeitraum',
    yKey: 'Negative_Stunden',
    xAxisLabel: 'Quartal (jeweils Q1–Q3)',
    yAxisLabel: 'Stundenäquivalente',
  },
  {
    type: 'line',
    dataFile: `${DIRECTORY}/midday.csv`,
    outputFile: 'midday.js',
    containerId: 'negative-preise-tageszeit',
    xKey: 'Stunde',
    seriesKeys: ['Anteil_2024_Prozent', 'Anteil_2025_Prozent', 'Anteil_2026_Prozent'],
    seriesNames: ['Q2 2024', 'Q2 2025', 'Q2 2026'],
    xAxisLabel: 'Uhrzeit (Europe/Berlin)',
    yAxisLabel: 'Negative Zeit (%)',
    smooth: false,
  },
  {
    type: 'bar',
    dataFile: `${DIRECTORY}/battery.csv`,
    outputFile: 'batteries.js',
    containerId: 'negative-preise-batterien',
    xKey: 'Jahr',
    yKey: 'Energie_GWh',
    xAxisLabel: 'Inbetriebnahmejahr',
    yAxisLabel: 'Kapazität (GWh)',
  },
];
