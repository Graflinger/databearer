// Code-defined structured data for dashboard pages. The Dataset entity (see `dataset`
// in src/seo.js) repeats only what the dashboard visibly states: title and summary,
// SMARD as source, the CC BY 4.0 reuse note, the covered period, the measured series
// and the download links in "Quelle & Weiterverwendung".
function electricityDataset(data) {
  const snapshot = data.germanElectricity;
  const source = snapshot?.source;
  if (!source?.name || !source.url) return undefined;
  const manifest = data.germanElectricityHistory?.manifest;
  const distribution = [{
    name: 'Vorbereiteter 30-Tage-Datensatz (stündlich, JSON)',
    contentUrl: '/data/german-electricity.json', encodingFormat: 'application/json',
  }];
  if (manifest) {
    distribution.push({
      name: 'Historienmanifest der täglichen Jahresdateien (JSON, Dateiliste mit SHA-256)',
      contentUrl: '/data/history/german-electricity/manifest.json', encodingFormat: 'application/json',
    });
  }
  return {
    name: 'Strom in Deutschland – Strommix, Netzlast und Börsenpreise',
    description: data.description,
    license: source.license_url,
    creditText: `Daten: ${source.name}`,
    isBasedOn: { name: source.name, url: source.url },
    spatialCoverage: 'Deutschland',
    temporalCoverage: manifest?.first_date && manifest?.last_date ? `${manifest.first_date}/${manifest.last_date}` : undefined,
    variableMeasured: ['Stromerzeugung nach Energieträger', 'Erneuerbarenanteil', 'Netzlast', 'Day-Ahead-Börsenpreis'],
    dateModified: snapshot.snapshot_created_at,
    distribution,
  };
}

const DATASETS = { '/dashboards/strom/': electricityDataset };

module.exports = {
  eleventyComputed: {
    dataset: (data) => DATASETS[data.page?.url]?.(data),
    // Sitemap lastmod for data pages: creation date of the published data snapshot.
    dataModified: (data) => DATASETS[data.page?.url]?.(data)?.dateModified,
  },
};
module.exports.electricityDataset = electricityDataset;
module.exports.DATASETS = DATASETS;
