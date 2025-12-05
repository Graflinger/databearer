/**
 * Industriepolitik Post Charts
 *
 * Charts demonstrating technology trends and industrial policy impacts.
 * Using example data to demonstrate the chart system.
 */

module.exports = [
  // Battery and PV price (multi-line)
  {
    type: "line",
    dataFile: "industriepolitik_battery_pv.csv",
    outputFile: "industriepolitik_battery_pv.js",
    containerId: "industriepolitik_battery_pv",
    title: "",
    xAxisLabel: "Jahre",
    yAxisLabel: "Preis is USD",
    xKey: "jahr",
    seriesKeys: [
      "Solar Modul Kosten in USD pro kWh",
      "Batterie Preis in USD pro kW",
    ],
    seriesNames: ["PV USD/kW", "Akku USD/kWh"],
    smooth: true,
  },
];
