const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');
// Compare JSON values across Jest/native realms as well as ordinary Node builds.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const DIRECTORY = path.resolve(__dirname, '../data/2026/erneuerbare_wachstum');
const REVISION = '4be5f678d5d318056ac2f87b720549f75032c4a1';
const DATE = '2026-09-14';
const TECHNOLOGIES = ['solar', 'wind_onshore', 'wind_offshore'];
const CONTRACTS = {
  'capacity.csv': { columns: ['year', 'solar_gw', 'wind_onshore_gw', 'wind_offshore_gw'], rows: 15 },
  'generation.csv': { columns: ['year', 'solar_twh', 'wind_onshore_twh', 'wind_offshore_twh', 'method', 'days', 'complete_days'], rows: 11 },
  'summary.csv': { columns: ['technology', 'capacity_2020_gw', 'capacity_2024_gw', 'capacity_2025_gw', 'change_2025_gw', 'growth_2020_2025_pct', 'generation_2024_twh', 'generation_2025_twh', 'generation_change_pct'], rows: 3 },
  'quality.json': null,
};
const SOURCE_PATHS = [
  'frontend/src/_data/germanElectricityProgress.json',
  'frontend/src/_data/germanElectricityAnnual.json',
  'frontend/src/_data/germanElectricityTrade.json',
  'frontend/src/_data/germanElectricity.json',
  'frontend/src/data-history/german-electricity/manifest.json',
  ...[
    'a33a9c994295cc8ded4982c77fe99e954ec0c2aec80c6b25b45507973a8c24b1',
    'a10e4f13682ebe63177564a5631ca1685d1cc6b54efc18f8b1a8c8c1cb50de64',
    '7cc400862c9c477fe74577591dd681fc980198fd5918da5add6be88681d40772',
    'f5b6e0642d345797466cf12f278ed474e05504ae1fee39c140f6b61a2682367f',
    'd7211e250be153c9ff4dbc2bba8e52821204bce116c61a4cf6812316b28dd93f',
    'c2b5b0260c5f71cbd793997cc9ea8f9b5baa464d9f3db00c93341c2b7e5ab596',
    '79059405df894d3bc22ed07540c03e8db6f4fc004f51e5b601726ff1da371403',
    'a2500628fc9af0b9547661db3412ed69eed4464323199aac19cd9b504850a27b',
    '9ad85353750c74cb587e7208ca67c1410138e42e6616c7c75e7091c14f7e8ed7',
    '5aeca1c9781aba47045bcab7a25a7c25d974c93ef00859edcb68248f6ce59540',
    '7e70f946ebf15672021bf207ea2df167d7352b789159dbbb71852e85a4f0fc25',
    'a3835c5dc0dcfc1497fb608a55fa0c1195a7791c3f4c8f4a4787f8d50d275746',
  ].map((digest, i) => `frontend/src/data-history/german-electricity/${2015 + i}.${digest}.json`),
];
const PROVENANCE = {
  attribution: 'Bundesnetzagentur | SMARD.de',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  capacity_url: 'https://www.smard.de/page/home/topic-article/211972/212382/entwicklung-der-nettonennleistung',
  capacity_csv_url: 'https://www.smard.de/resource/blob/217306/-/data-csv-data.csv',
  capacity_license_evidence: 'https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf',
  generation_url: 'https://www.smard.de/home/downloadcenter/download-marktdaten/',
  generation_endpoint: 'https://www.smard.de/app/chart_data/{id}/DE/{id}_DE_{resolution}_{timestamp}.json',
  generation_ids: { solar: 4068, wind_onshore: 4067, wind_offshore: 1225 },
};
const COVERAGE = {
  timezone: 'Europe/Berlin',
  capacity: { first_year: 2011, last_year: 2025, reference: 'year_end', unit: 'GW', provisional: true,
    source_evaluated_on: '2026-06-26', source_evaluation_verified_on: DATE, source_retrieved_at: null,
    scope: 'Gemeldete Kraftwerksliste: Nettonennleistung am und außerhalb des Strommarktes; einschließlich ausländischer, in das deutsche Netz einspeisender Kraftwerke (Dänemark, Luxemburg, Österreich, Schweiz). Kein rein geografischer Deutschland-Gesamtbestand; keine Länderaufteilung im kompakten Export. Wind/PV und kleine Einheiten aggregiert; Kleinspeicher unter 13,2 kW und überwiegend nicht öffentlich einspeisende Notstromaggregate ausgeschlossen. Keine DC-Modulleistung.' },
  generation: { first_year: 2015, last_year: 2025, reference: 'calendar_year', unit: 'TWh', source_retrieved_at: null,
    daily_history_through: '2026-09-12', annual_supplement_years: [2016, 2018],
    scope: 'SMARD DE: Nettostromerzeugung im Netz der allgemeinen Versorgung. Ohne PV-Eigenverbrauch im Haushalt, Bahnnetz, Industrienetze und geschlossene Verteilnetze. Keine Bruttostromerzeugung und keine zu den Kapazitäten deckungsgleiche Anlagenpopulation.' },
  missing_values: 'Unknowns never become zero. Annual supplements replace complete annual mixes, never daily gaps. No capacity-utilization or target-attainment ratios.',
  transformation: 'Select three technologies. Capacity GW unchanged; generation GWh/1000 via validated trends, rounded to 8 decimals. Summary differences and percentages use unrounded source rows, round to 8 decimals.',
};
const QUALITY = {
  frozen_on: DATE, capacity_rows: 15, generation_rows: 11, summary_rows: 3,
  missing_selected_annual_values: 0, excluded_capacity_years: [2026], excluded_generation_years: [2026],
  annual_supplements: [
    { year: 2016, method: 'source_annual_aggregate', days: 366, complete_days: 365 },
    { year: 2018, method: 'source_annual_aggregate', days: 365, complete_days: 361 },
  ],
  preserved_daily_gaps: [
    { date: '2016-11-08', category: 'other_renewables' },
    ...['2018-01-21', '2018-08-02', '2018-08-03', '2018-08-23'].map((date) => ({ date, category: 'pumped_storage' })),
  ],
  note: 'complete_days refers to all twelve generation categories, not only the three charted series. Official annual aggregates do not certify complete hourly/daily observations. Capacity stock differences include additions, retirements and reporting revisions; not gross commissioning.',
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value) => Number(value.toFixed(8));
function assert(condition, message) { if (!condition) throw new Error(`Erneuerbare Wachstum: ${message}`); }
function fields(value, names, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...names].sort()), `${label}: fields`);
}
function summaryRows(capacity, generation) {
  return TECHNOLOGIES.map((technology) => {
    const c = (year) => Number(capacity.find((r) => Number(r.year) === year)[`${technology}_gw`]);
    const g = (year) => Number(generation.find((r) => Number(r.year) === year)[`${technology}_twh`]);
    return { technology, capacity_2020_gw: c(2020), capacity_2024_gw: c(2024), capacity_2025_gw: c(2025),
      change_2025_gw: round(c(2025) - c(2024)), growth_2020_2025_pct: round((c(2025) / c(2020) - 1) * 100),
      generation_2024_twh: g(2024), generation_2025_twh: g(2025), generation_change_pct: round((g(2025) / g(2024) - 1) * 100) };
  });
}
function validateErneuerbareWachstum(directory = DIRECTORY) {
  assert(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(), 'unsafe directory');
  assert(same(fs.readdirSync(directory).sort(), ['metadata.json', ...Object.keys(CONTRACTS)].sort()), 'directory allowlist');
  const read = (name) => {
    const filename = path.join(directory, name);
    const stat = fs.lstatSync(filename);
    assert(stat.isFile() && stat.size > 0 && stat.size <= 30000, `${name}: unsafe file/size`);
    return fs.readFileSync(filename);
  };
  const metadata = JSON.parse(read('metadata.json'));
  fields(metadata, ['schema_version', 'kind', 'frozen_on', 'source_revision', 'methodology_version', 'extractor', 'provenance', 'coverage', 'inputs', 'files'], 'metadata');
  assert(metadata.schema_version === 1 && metadata.kind === 'frozen_erneuerbare_wachstum' && metadata.methodology_version === 1, 'schema');
  assert(metadata.frozen_on === DATE && metadata.source_revision === REVISION, 'date/revision');
  assert(metadata.extractor === 'frontend/src/data_ingestion/extract-erneuerbare-wachstum.js', 'extractor');
  assert(same(metadata.provenance, PROVENANCE) && same(metadata.coverage, COVERAGE), 'source dates/scopes');
  assert(Array.isArray(metadata.inputs) && same(metadata.inputs.map((entry) => entry.path), SOURCE_PATHS), 'input allowlist');
  for (const entry of metadata.inputs) {
    fields(entry, ['path', 'sha256', 'bytes', 'role'], 'input');
    assert(/^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0, 'source hash/size');
    assert(entry.role === (entry.path.includes('Trade') || entry.path.endsWith('/germanElectricity.json') || entry.path.includes('/2026.') ? 'validated_ancillary_not_charted' : 'evidence'), 'input role');
  }
  fields(metadata.files, Object.keys(CONTRACTS), 'payload allowlist');
  const tables = {};
  for (const [name, contract] of Object.entries(CONTRACTS)) {
    const entry = metadata.files[name];
    fields(entry, contract ? ['sha256', 'bytes', 'columns', 'rows'] : ['sha256', 'bytes'], name);
    const bytes = read(name);
    assert(bytes.length === entry.bytes && hash(bytes) === entry.sha256, `${name}: hash/size`);
    if (!contract) {
      assert(same(JSON.parse(bytes), QUALITY), 'quality semantics');
      continue;
    }
    assert(same(entry.columns, contract.columns) && entry.rows === contract.rows, `${name}: contract`);
    const records = parse(bytes, { skip_empty_lines: false });
    assert(same(records.shift(), contract.columns) && records.length === contract.rows, `${name}: columns/rows`);
    tables[name] = records.map((values) => {
      assert(values.length === contract.columns.length && values.every((v) => v !== ''), `${name}: missing value`);
      return Object.fromEntries(contract.columns.map((column, i) => {
        if (['technology', 'method'].includes(column)) return [column, values[i]];
        assert(/^-?\d+(\.\d+)?$/.test(values[i]) && Number.isFinite(Number(values[i])), `${name}: numeric value`);
        const value = Number(values[i]);
        assert(value >= 0 || column === 'generation_change_pct', `${name}: negative value`);
        return [column, value];
      }));
    });
  }
  tables['capacity.csv'].forEach((row, i) => {
    assert(row.year === 2011 + i && TECHNOLOGIES.every((t) => row[`${t}_gw`] < 1000), 'capacity years/values');
  });
  tables['generation.csv'].forEach((row, i) => {
    const year = 2015 + i;
    const days = year % 4 === 0 ? 366 : 365;
    assert(row.year === year && row.days === days && row.complete_days === days - (year === 2016 ? 1 : year === 2018 ? 4 : 0), 'generation calendar/coverage');
    assert(row.method === ([2016, 2018].includes(year) ? 'source_annual_aggregate' : 'daily_sum'), 'annual method');
    assert(TECHNOLOGIES.every((t) => row[`${t}_twh`] > 0 && row[`${t}_twh`] < 1000), 'generation values');
  });
  assert(same(tables['summary.csv'], summaryRows(tables['capacity.csv'], tables['generation.csv'])), 'summary reconciliation');
  return { metadata, tables };
}
module.exports = { validateErneuerbareWachstum, summaryRows, DIRECTORY, REVISION, DATE, CONTRACTS, SOURCE_PATHS, PROVENANCE, COVERAGE, QUALITY, hash };
