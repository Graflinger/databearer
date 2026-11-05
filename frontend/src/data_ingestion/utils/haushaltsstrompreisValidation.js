const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const DIRECTORY = '2026/haushaltsstrompreis';
const CONTRACTS = {
  'verlauf.csv': ['Halbjahr', 'Gesamt_ct_kWh', 'Ohne_Steuern_ct_kWh', 'Ohne_MwSt_ct_kWh', 'Steuern_ct_kWh', 'Steueranteil_Prozent'],
  'komponenten.csv': ['Jahr', 'Energie_Vertrieb_ct_kWh', 'Netze_ct_kWh', 'Steuern_ct_kWh', 'Gesamt_ct_kWh'],
  'eu.csv': ['Code', 'Land', 'Halbjahr', 'Gesamt_ct_kWh', 'Ohne_Steuern_ct_kWh', 'Ohne_MwSt_ct_kWh', 'Steuern_ct_kWh', 'Steueranteil_Prozent'],
  'eu-auswahl.csv': ['Code', 'Land', 'Gesamt_ct_kWh'],
};
const COUNTRIES = 'AT BE BG CY CZ DE DK EE EL ES EU27_2020 FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' ');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const PERIODS = Array.from({ length: 37 }, (_, i) => `${2008 + Math.floor(i / 2)}-S${i % 2 + 1}`);
const TEXT = new Set(['Halbjahr', 'Jahr', 'Land', 'Code']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function valid(condition, message) {
  if (!condition) throw new Error(`Haushaltsstrompreis: ${message}`);
}

function validateHaushaltsstrompreis(directory = path.join(__dirname, '../data', DIRECTORY)) {
  valid(fs.lstatSync(directory).isDirectory(), 'unsafe package directory');
  const names = [...Object.keys(CONTRACTS), 'manifest.json'].sort();
  valid(same(fs.readdirSync(directory).sort(), names), 'file allowlist mismatch');
  const read = (name) => {
    valid(names.includes(name) && fs.lstatSync(path.join(directory, name)).isFile(), 'unsafe regular file');
    return fs.readFileSync(path.join(directory, name));
  };
  const manifest = JSON.parse(read('manifest.json'));
  valid(manifest.schema_version === 1 && manifest.kind === 'frozen_haushaltsstrompreis_article'
    && manifest.methodology_version === '1.0.0', 'manifest identity mismatch');
  const scope = manifest.scope;
  valid(scope?.band === 'KWH2500-4999' && scope.currency === 'EUR' && scope.unit === 'ct/kWh'
    && scope.first_semester === '2008-S1' && scope.last_semester === '2026-S1'
    && scope.eu_period === '2026-S1' && same(scope.component_years, YEARS), 'scope mismatch');
  valid(same(Object.keys(manifest.files).sort(), Object.keys(CONTRACTS).sort()), 'manifest allowlist mismatch');
  valid(same(Object.keys(manifest.sources).sort(), ['components', 'de', 'eu']), 'source allowlist mismatch');
  for (const [name, source] of Object.entries(manifest.sources)) {
    const dataset = name === 'components' ? 'nrg_pc_204_c' : 'nrg_pc_204';
    const url = new URL(source.url);
    valid(source.dataset === dataset && url.origin === 'https://ec.europa.eu'
      && url.pathname === `/eurostat/api/dissemination/statistics/1.0/data/${dataset}`
      && url.searchParams.get('currency') === 'EUR' && url.searchParams.get('nrg_cons') === scope.band, 'source query mismatch');
    valid(source.updated === '2026-10-19T23:00:00+0200'
      && /^2026-11-05T/.test(source.retrieved_at) && Number.isFinite(Date.parse(source.retrieved_at))
      && /^[a-f0-9]{64}$/.test(source.sha256) && source.bytes > 0 && source.bytes <= 2000000, 'source provenance mismatch');
  }
  const licenses = manifest.licenses;
  valid(licenses?.checked_on === '2026-11-05'
    && licenses.eurostat?.status === 'usable_with_conditions'
    && licenses.eurostat.license.includes('2011/833/EU')
    && licenses.eurostat.terms_url === 'https://ec.europa.eu/eurostat/web/main/help/copyright-notice'
    && licenses.eurostat.disclaimer === 'Eurostat ist für diese Bearbeitung nicht verantwortlich.'
    && licenses.smard?.status === 'not_used' && licenses.energy_charts?.status === 'not_used', 'licence gate mismatch');
  for (const key of ['eurostat', 'destatis_context', 'smard', 'energy_charts']) {
    for (const field of ['license', 'version', 'terms_url', 'modifications', 'public_git_redistribution', 'commercial_use', 'database_rights', 'third_party_exceptions']) {
      valid(typeof licenses[key]?.[field] === 'string' && licenses[key][field].length > 0, 'licence documentation incomplete');
    }
  }
  const expectedFlags = ['MT', 'PL'].flatMap((geo) => ['I_TAX', 'X_TAX', 'X_VAT'].map((tax) => ({ geo, time: '2026-S1', tax, flag: 'p' })));
  valid(manifest.quality?.missing_required_cells === 0 && manifest.quality.eu_members === 27
    && same(manifest.quality.source_flags, expectedFlags)
    && same(manifest.quality.subtax_reconciliation_skipped_missing_nuclear_tax, [2022, 2023]), 'quality mismatch');
  const tables = {};
  for (const [name, columns] of Object.entries(CONTRACTS)) {
    const bytes = read(name);
    const entry = manifest.files[name];
    valid(bytes.length === entry.bytes && hash(bytes) === entry.sha256, `${name} size/hash mismatch`);
    const records = parse(bytes, { skip_empty_lines: false });
    valid(same(entry.columns, columns) && same(records[0], columns) && records.length === entry.rows + 1, `${name} CSV contract mismatch`);
    tables[name] = records.slice(1).map((values) => Object.fromEntries(columns.map((column, i) => {
      valid(values.length === columns.length && values[i] !== '', `${name} missing value`);
      if (TEXT.has(column)) return [column, values[i]];
      valid(/^-?\d+\.\d{2}$/.test(values[i]) && Number.isFinite(Number(values[i])), `${name} nonnumeric value`);
      return [column, Number(values[i])];
    })));
  }
  const series = tables['verlauf.csv'];
  const components = tables['komponenten.csv'];
  const eu = tables['eu.csv'];
  valid(same(series.map((r) => r.Halbjahr), PERIODS), 'semester coverage mismatch');
  valid(same(components.map((r) => Number(r.Jahr)), YEARS), 'annual coverage mismatch');
  valid(same(eu.map((r) => r.Code), COUNTRIES) && eu.every((r) => r.Halbjahr === '2026-S1'), 'EU coverage mismatch');
  for (const row of [...series, ...eu]) {
    valid(row.Gesamt_ct_kWh > 0 && row.Gesamt_ct_kWh < 100 && row.Ohne_Steuern_ct_kWh > 0 && row.Ohne_MwSt_ct_kWh > 0, 'price bounds');
    valid(Math.abs(row.Gesamt_ct_kWh - row.Ohne_Steuern_ct_kWh - row.Steuern_ct_kWh) < 1e-8, 'tax residual mismatch');
    valid(Math.abs(row.Steuern_ct_kWh / row.Gesamt_ct_kWh * 100 - row.Steueranteil_Prozent) < 0.0051, 'tax share mismatch');
  }
  for (const row of components) {
    valid(row.Energie_Vertrieb_ct_kWh > 0 && row.Netze_ct_kWh > 0
      && Math.abs(row.Energie_Vertrieb_ct_kWh + row.Netze_ct_kWh + row.Steuern_ct_kWh - row.Gesamt_ct_kWh) < 1e-8, 'component sum mismatch');
    const halfYears = series.filter((r) => r.Halbjahr.startsWith(row.Jahr)).map((r) => r.Gesamt_ct_kWh);
    valid(row.Gesamt_ct_kWh >= Math.min(...halfYears) - 0.03 && row.Gesamt_ct_kWh <= Math.max(...halfYears) + 0.03, 'annual total outside semesters');
  }
  const de = eu.find((r) => r.Code === 'DE');
  valid(CONTRACTS['verlauf.csv'].every((key) => de[key] === series.at(-1)[key]), 'DE source reconciliation mismatch');
  const selected = ['IE', 'DE', 'BE', 'EU27_2020', 'MT', 'HU'].map((code) => {
    const r = eu.find((item) => item.Code === code);
    return { Code: code === 'EU27_2020' ? 'EU-27' : code, Land: r.Land, Gesamt_ct_kWh: r.Gesamt_ct_kWh };
  });
  valid(same(tables['eu-auswahl.csv'], selected), 'EU chart selection mismatch');
  const ranking = eu.filter((r) => r.Code !== 'EU27_2020').sort((a, b) => b.Gesamt_ct_kWh - a.Gesamt_ct_kWh);
  valid(same(ranking.slice(0, 3).map((r) => r.Code), ['IE', 'DE', 'BE'])
    && same(ranking.slice(-2).map((r) => r.Code), ['MT', 'HU']), 'ranking claim changed');
  return { manifest, tables, series, components, eu };
}

module.exports = { validateHaushaltsstrompreis, DIRECTORY, CONTRACTS };
