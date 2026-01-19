module.exports = [
  {
    type: "line",
    dataFile: "wind_energy_awarded.csv",
    outputFile: "zuschlagwert.js",
    containerId: "zuschlagwert_wind",
    title: "",
    xAxisLabel: "Datum",
    yAxisLabel: "Zuschlagswert in ct/kWh",
    xKey: "datum",
    yKey: "Durchschnittlicher Zuschlagswert in ct/kWh",
    smooth: true,
  },

  {
    type: "line",
    dataFile: "wind_energy_awarded.csv",
    outputFile: "zuschlagsmenge_in_kw.js",
    containerId: "zuschlagsmenge_in_kw",
    title: "",
    xAxisLabel: "Datum",
    yAxisLabel: "Menge in kW",
    xKey: "datum",
    seriesKeys: [
      "Zuschlagsmenge in kw",
      "Ausschreibungsvolumen in kw",
      "Gebotsmenge in kw",
    ],
    seriesNames: [
      "Zuschlagsmenge in kW",
      "Ausschreibungsvolumen in kW",
      "Gebotsmenge in kW",
    ],
    smooth: true,
  },

  {
    type: "bar",
    dataFile: "wind_energy_awarded_yearly.csv",
    outputFile: "zuschlagsmenge_in_kw_yearly.js",
    containerId: "zuschlagsmenge_in_kw_yearly",
    title: "",
    xAxisLabel: "Jahr",
    yAxisLabel: "Zuschlagsmenge in kW",
    xKey: "jahr",
    yKey: "Zuschlagsmenge in kw",
    smooth: true,
  },
];
