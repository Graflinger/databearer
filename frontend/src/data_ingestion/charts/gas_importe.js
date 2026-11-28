const { validateGasImporte } = require('../utils/gasImporteValidation');

validateGasImporte();

module.exports = [
  {
    type: 'line', dataFile: '2026/gas_importe/dependency.csv',
    outputFile: 'abhaengigkeit.js', containerId: 'gas-abhaengigkeit',
    xKey: 'Jahr', xAxisLabel: 'Jahr', yAxisLabel: 'Importabhängigkeit (%)',
    seriesKeys: ['Gas_DE_PC', 'Gas_EU_PC'], seriesNames: ['Deutschland', 'EU-27'], smooth: false,
  },
  {
    type: 'line', dataFile: '2026/gas_importe/dependency.csv',
    outputFile: 'energietraeger.js', containerId: 'gas-energietraeger',
    xKey: 'Jahr', xAxisLabel: 'Jahr', yAxisLabel: 'Importabhängigkeit (%)',
    seriesKeys: ['Oel_DE_PC', 'Gas_DE_PC', 'Kohle_DE_PC'],
    seriesNames: ['Öl / Ölprodukte', 'Erdgas', 'Feste fossile Brennstoffe'], smooth: false, narrowGridTop: '24%',
  },
  {
    type: 'bar', dataFile: '2026/gas_importe/partner_comparison.csv',
    outputFile: 'partner.js', containerId: 'gas-partner',
    xKey: 'Partner', yAxisLabel: 'Gasimporte (TWh, Brennwert)',
    seriesKeys: ['Jahr_2021_TWh', 'Jahr_2024_TWh'], seriesNames: ['2021', '2024'], stacked: false, rotateXAxisLabels: true,
  },
  {
    type: 'bar', dataFile: '2026/gas_importe/balance_de.csv',
    outputFile: 'importe-exporte.js', containerId: 'gas-importe-exporte',
    xKey: 'Jahr', xAxisLabel: 'Jahr', yAxisLabel: 'TWh (Brennwert)',
    seriesKeys: ['Import_TWh', 'Export_TWh', 'Netto_TWh'], seriesNames: ['Importe', 'Exporte', 'Nettoimporte'], stacked: false,
  },
];
