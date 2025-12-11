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

  // EV market share (multi-line)
  {
    type: "line",
    dataFile: "industriepolitik_ev_share.csv",
    outputFile: "industriepolitik_ev_market_share.js",
    containerId: "industriepolitik_ev_market_share",
    title: "",
    xAxisLabel: "Jahre",
    yAxisLabel: "Marktanteil in %",
    xKey: "jahr",
    seriesKeys: [
      "European Union (27)",
      "World",
      "China",
      "United States",
      "Norway",
      "Germany",
    ],
    seriesNames: ["EU", "Welt", "China", "USA", "Norwegen", "Deutschland"],
    smooth: true,
  },

  // Electrification rate (multi-line)
  {
    type: "line",
    dataFile: "industriepolitik_share_electricity.csv",
    outputFile: "industriepolitik_electrification_rate.js",
    containerId: "industriepolitik_electrification_rate",
    title: "",
    xAxisLabel: "Jahre",
    yAxisLabel: "Elektrifizierungsrate in %",
    xKey: "jahr",
    seriesKeys: [
      "European Union (27)",
      "China",
      "United States",
      "Norway",
      "Germany",
    ],
    seriesNames: ["EU", "China", "USA", "Norwegen", "Deutschland"],
    smooth: true,
  },

  // single line flops compute
  {
    type: "line",
    dataFile: "industriepolitik_battery_pv_flops.csv",
    outputFile: "industriepolitik_flops_compute.js",
    containerId: "industriepolitik_flops_compute",
    title: "",
    xAxisLabel: "Jahre",
    yAxisLabel: "gigaFLOPS",
    xKey: "jahr",
    yKey: "Rechenleistung in gigaFLOPS",
    smooth: true,
  },
];
