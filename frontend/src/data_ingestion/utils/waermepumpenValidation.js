const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const HEADERS = {
  'anteil.csv': ['Jahr', 'Waermepumpen_Prozent', 'Erdgas_Prozent'],
  'neubau.csv': ['Jahr', 'Wohngebaeude_Insgesamt', 'Waermepumpen_Prozent', 'Waermepumpen_Gebaeude_Geschaetzt'],
  'genehmigungen.csv': ['Jahr', 'Wohngebaeude_Genehmigt', 'Waermepumpen_Prozent', 'Erdgas_Prozent'],
};
const YEARS = {
  'anteil.csv': Array.from({ length: 11 }, (_, i) => i + 2015),
  'neubau.csv': [2023, 2024, 2025],
  'genehmigungen.csv': [2024, 2025],
};
const SOURCE_IDS = {
  'anteil.csv': ['trend'],
  'neubau.csv': ['trend', 'press2024', 'press2026'],
  'genehmigungen.csv': ['press2025', 'press2026'],
};
const UNITS = {
  'anteil.csv': ['Jahr', 'Prozent', 'Prozent'],
  'neubau.csv': ['Jahr', 'Wohngebäude (gerundet)', 'Prozent', 'Wohngebäude (geschätzt, auf 100 gerundet)'],
  'genehmigungen.csv': ['Jahr', 'Wohngebäude (gerundet)', 'Prozent', 'Prozent'],
};
const BASE = 'https://www.destatis.de/';
const SOURCES = {
  trend: [BASE + 'DE/Presse/Pressemitteilungen/Grafiken/Newsroom/2026/Interaktiv/Daten/20260610-waermepumpen.csv?__blob=value&v=1', '2026-06-10'],
  press2024: [BASE + 'DE/Presse/Pressemitteilungen/2024/06/PD24_N025_31_51.html', '2024-06-04'],
  press2025: [BASE + 'DE/Presse/Pressemitteilungen/2025/06/PD25_N031_31_51.html', '2025-06-04'],
  press2026: [BASE + 'DE/Presse/Pressemitteilungen/2026/06/PD26_N038_31_51.html', '2026-06-10'],
  terms: [BASE + 'DE/Service/Impressum/copyright-allgemein.html', null],
};
// Independently reviewed publisher observations. A frozen source revision requires
// explicit review, not merely rewriting hashes alongside altered CSV values.
const EXPECTED = {
  'anteil.csv': YEARS['anteil.csv'].map((year, i) => [year,
    [31.4, 31.8, 37.2, 41.1, 42.7, 45.8, 50.6, 57, 64.6, 69.4, 73.6][i],
    [51.5, 52.9, 47.4, 43.1, 41.9, 39, 34.3, 28, 20.1, 15, 10.5][i]]),
  'neubau.csv': [[2023, 96800, 64.6, 62500], [2024, 76100, 69.4, 52800], [2025, 58900, 73.6, 43400]],
  'genehmigungen.csv': [[2024, 54800, 81, 3.7], [2025, 62100, 83, 2.2]],
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function check(condition, message) {
  if (!condition) throw new Error(`Waermepumpen validation: ${message}`);
}
function keys(value, expected, label) {
  check(object(value) && same(Object.keys(value).sort(), [...expected].sort()), `${label} keys mismatch`);
}
function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z');
}

function validateWaermepumpen(dataDir = path.join(__dirname, '../data/2026/waermepumpen')) {
  // Reject symlink directory components as well as symlink payloads. Only fixed
  // local basenames are read; manifest filenames never become filesystem paths.
  for (let dir = path.resolve(dataDir); ; dir = path.dirname(dir)) {
    check(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink(), 'unsafe package directory');
    if (dir === path.dirname(dir)) break;
  }
  check(same(fs.readdirSync(dataDir).sort(), [...Object.keys(HEADERS), 'manifest.json'].sort()), 'directory allowlist mismatch');
  const read = (name) => {
    const file = path.join(dataDir, name);
    const stat = fs.lstatSync(file);
    check(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 200000, `${name} unsafe regular file/size`);
    return fs.readFileSync(file);
  };
  const manifest = JSON.parse(read('manifest.json').toString('utf8'));
  check(object(manifest) && manifest.schema_version === 1 && manifest.kind === 'frozen_waermepumpen_article'
    && manifest.methodology_version === '1.0.0', 'manifest identity');
  check(manifest.snapshot_date === '2026-11-05' && manifest.observation_cutoff === '2025-12-31'
    && manifest.geography === 'Deutschland' && manifest.timezone === 'Europe/Berlin', 'dates/geography/timezone');
  check(manifest.scope === 'Neue Wohngebäude, hauptsächliche Heizenergie; Gebäude, keine Geräteabsätze oder Wohnungen'
    && manifest.missing_values === 'Keine fehlenden Werte zulässig; leere Felder sind Fehler, niemals Null oder null.', 'scope/missing values');
  check(manifest.exporter === 'pipeline/src/data_pipelines/export_data/2026/waermepumpen/export.py', 'exporter identity');
  check(manifest.methodology?.estimate_formula === 'round_half_up(total_buildings * heatpump_percent / 100 / 100) * 100'
    && manifest.methodology?.estimate_unit === UNITS['neubau.csv'][3]
    && typeof manifest.methodology?.rounding === 'string' && manifest.methodology.rounding.includes('Näherungen')
    && typeof manifest.methodology?.permits === 'string' && manifest.methodology.permits.includes('keine Fertigstellungen'), 'methodology');
  keys(manifest.sources, Object.keys(SOURCES), 'sources');
  for (const [id, [url, date]] of Object.entries(SOURCES)) {
    const source = manifest.sources[id];
    keys(source, ['url', 'publication_date', 'retrieved_at', 'sha256', 'bytes', 'publisher', 'license_id'], id);
    check(source.url === url && source.publication_date === date && validTimestamp(source.retrieved_at)
      && Date.parse(source.retrieved_at) >= Date.parse('2026-11-05T00:00:00Z') && Date.parse(source.retrieved_at) <= Date.now()
      && /^[a-f0-9]{64}$/.test(source.sha256) && Number.isSafeInteger(source.bytes) && source.bytes > 0 && source.bytes <= 2000000
      && source.publisher === 'Statistisches Bundesamt (Destatis)' && source.license_id === 'destatis-copyright-allgemein', `${id} source provenance`);
  }
  check(Array.isArray(manifest.licenses) && manifest.licenses.length === 1, 'core license');
  const license = manifest.licenses[0];
  check(license.id === 'destatis-copyright-allgemein' && license.name === 'Destatis Copyright allgemein'
    && license.version === 'unversioned' && license.url === SOURCES.terms[0] && license.date_checked === '2026-11-05'
    && license.commercial_use === true && license.public_repository_redistribution === true
    && ['basis', 'third_party_caveat', 'database_rights'].every((key) => typeof license[key] === 'string' && license[key].length > 50), 'license terms');
  check(Array.isArray(license.attributions) && license.attributions.length === 4, 'attributions');
  for (const id of ['trend', 'press2024', 'press2025', 'press2026']) {
    const source = manifest.sources[id];
    check(license.attributions.some((a) => typeof a === 'string' && a.includes(source.url)
      && a.includes('Statistisches Bundesamt (Destatis)') && a.includes(source.publication_date)
      && a.includes(source.retrieved_at.slice(0, 10)) && a.includes('eigene Darstellung / eigene Berechnung')), `${id} attribution`);
  }
  // Context facts do not inherit the Destatis data redistribution permission.
  check(Array.isArray(manifest.context_source_licenses)
    && same(manifest.context_source_licenses.map((record) => record.id), ['bwp', 'bdh', 'gmodg', 'beg-em', 'bundesregierung']), 'context licenses');
  for (const record of manifest.context_source_licenses) {
    check(record.redistribution === false && record.date_checked === '2026-11-05' && record.retrieved_date === '2026-11-05'
      && ['publisher', 'usage', 'name', 'version', 'commercial_use', 'attribution', 'modification_notice', 'database_rights', 'third_party_rights']
        .every((key) => typeof record[key] === 'string' && record[key].length > 10)
      && /^https:\/\//.test(record.terms_url) && Array.isArray(record.source_urls) && record.source_urls.length > 0
      && record.source_urls.every((url) => /^https:\/\//.test(url)), 'context license restrictions');
  }
  check(Array.isArray(manifest.excluded_sources) && manifest.excluded_sources.length === 4
    && manifest.excluded_sources.every((record) => record.license_clearance === false && typeof record.status === 'string'), 'excluded sources');
  keys(manifest.files, Object.keys(HEADERS), 'file allowlist');
  keys(manifest.contracts, Object.keys(HEADERS), 'contracts');
  const tables = {};
  for (const [name, headers] of Object.entries(HEADERS)) {
    const entry = manifest.files[name];
    keys(entry, ['sha256', 'bytes', 'headers', 'rows'], name);
    const bytes = read(name);
    check(/^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes)
      && bytes.length === entry.bytes && hash(bytes) === entry.sha256, `${name} size/hash mismatch`);
    check(same(entry.headers, headers) && entry.rows === YEARS[name].length, `${name} header/row contract`);
    const contract = manifest.contracts[name];
    keys(contract, ['grain', 'key', 'years', 'units', 'nullable', 'source_ids'], `${name} contract`);
    check(contract.grain === `Jahr × Deutschland × ${name === 'genehmigungen.csv' ? 'genehmigte' : 'fertiggestellte'} neue Wohngebäude`
      && same(contract.key, ['Jahr']) && same(contract.years, YEARS[name]) && same(contract.units, UNITS[name])
      && same(contract.nullable, headers.map(() => false)) && same(contract.source_ids, SOURCE_IDS[name]), `${name} semantic contract`);
    const records = parse(bytes, { skip_empty_lines: false });
    check(same(records.shift(), headers) && records.length === entry.rows, `${name} headers/rows`);
    const numeric = records.map((row) => {
      check(row.length === headers.length && row.every((v) => /^\d+(?:\.\d)?$/.test(v) && Number.isFinite(Number(v))), `${name} finite non-null values`);
      return row.map(Number);
    });
    check(same(numeric.map((r) => r[0]), YEARS[name]), `${name} unique ordered year keys`);
    for (const row of numeric) {
      headers.forEach((header, i) => {
        if (header.endsWith('_Prozent')) check(row[i] >= 0 && row[i] <= 100, `${name} percentage range`);
        if (header.startsWith('Wohngebaeude_') || header.endsWith('_Geschaetzt')) check(Number.isSafeInteger(row[i]) && row[i] > 0 && row[i] % 100 === 0, `${name} rounded count`);
      });
      if (name !== 'neubau.csv') check(row[row.length - 1] + row[row.length - 2] <= 100, `${name} disjoint heating shares`);
    }
    check(same(numeric, EXPECTED[name]), `${name} frozen source observations mismatch`);
    tables[name] = numeric;
  }
  for (const [year, total, share, estimated] of tables['neubau.csv']) {
    check(share === tables['anteil.csv'].find((row) => row[0] === year)[1]
      && estimated === Math.round(total * share / 10000) * 100 && estimated <= total, 'count/share estimate consistency');
  }
  return manifest;
}

module.exports = { validateWaermepumpen, HEADERS, YEARS };
if (require.main === module) {
  validateWaermepumpen(process.argv[2]);
  console.log('Waermepumpen package validated');
}
