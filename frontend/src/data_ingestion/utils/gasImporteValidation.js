const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const CONTRACTS = {
  'dependency.csv': ['Jahr', 'Gas_DE_PC', 'Gas_EU_PC', 'Oel_DE_PC', 'Kohle_DE_PC', 'Gesamt_DE_PC'],
  'partners.csv': ['Jahr', 'TOTAL_TJ', 'RU_TJ', 'NO_TJ', 'NL_TJ', 'BE_TJ', 'US_TJ', 'FR_TJ', 'NSP_TJ', 'LNG_TJ', 'US_LNG_TJ'],
  'partner_comparison.csv': ['Partner', 'Jahr_2021_TWh', 'Jahr_2024_TWh'],
  'monthly.csv': ['Geo', 'Monat', 'IMP_TJ', 'EXP_TJ', 'IPRD_TJ', 'IC_OBS_TJ', 'IC_CAL_MG_TJ', 'STK_CHG_MG_TJ'],
  'balance_de.csv': ['Jahr', 'Import_TWh', 'Export_TWh', 'Netto_TWh', 'Foerderung_TWh', 'Verbrauch_TWh', 'Speicheraenderung_TWh'],
  'quality.json': null,
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const years = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => String(first + i));
const assert = (condition, message) => { if (!condition) throw new Error(`Gas imports validation: ${message}`); };
const near = (a, b, message, tolerance = 0.00001) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tolerance, message);
const keys = (object, expected, message) => assert(object && same(Object.keys(object).sort(), [...expected].sort()), message);

function validateGasImporte(directory = path.join(__dirname, '../data/2026/gas_importe')) {
  assert(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(), 'unsafe data directory');
  const read = (name) => {
    const filename = path.join(directory, name);
    assert(fs.lstatSync(filename).isFile(), `${name} must be a regular file`);
    return fs.readFileSync(filename);
  };
  assert(same(fs.readdirSync(directory).sort(), [...Object.keys(CONTRACTS), 'manifest.json'].sort()), 'package allowlist mismatch');
  const manifest = JSON.parse(read('manifest.json'));
  assert(manifest.schema_version === 1 && manifest.kind === 'frozen_gas_importe_article' && manifest.methodology_version === 1, 'manifest schema');
  assert(manifest.created_at?.startsWith('2026-11-05T') && Number.isFinite(Date.parse(manifest.created_at)), 'snapshot date');
  assert(same(manifest.coverage?.dependency, [1990, 2024]) && same(manifest.coverage?.partners, [2021, 2024])
    && same(manifest.coverage?.monthly, ['2024-01', '2025-12']) && same(manifest.coverage?.reporting_geographies, ['DE', 'EU27_2020']), 'coverage');
  keys(manifest.sources, ['dependency', 'partners', 'monthly'], 'source allowlist');
  const expectedSources = { dependency: ['nrg_ind_id', '2026-07-16'], partners: ['nrg_ti_gas', '2026-10-09'], monthly: ['nrg_cb_gasm', '2026-11-03'] };
  for (const [id, [code, updated]] of Object.entries(expectedSources)) {
    const source = manifest.sources[id];
    assert(source.dataset === code && source.source_updated_at.startsWith(updated) && Number.isFinite(Date.parse(source.source_updated_at)), 'source update date');
    assert(source.retrieved_at.startsWith('2026-11-05T') && Date.parse(source.retrieved_at) <= Date.parse(manifest.created_at), 'retrieval date');
    assert(/^[a-f0-9]{64}$/.test(source.sha256) && Number.isSafeInteger(source.bytes) && source.bytes > 0, 'raw fingerprint');
    const url = new URL(source.url);
    assert(url.origin === 'https://ec.europa.eu' && url.pathname.endsWith(`/data/${code}`)
      && url.searchParams.getAll('geo').every((geo) => ['DE', 'EU27_2020'].includes(geo)), 'source URL/scope');
    assert(source.license_id === 'eurostat-data-reuse-2011-833' && source.attribution.includes(code), 'source licence/credit');
  }
  const license = manifest.licenses?.['eurostat-data-reuse-2011-833'];
  assert(license?.checked_on === '2026-11-05' && license.commercial_reuse === true && license.public_repository_derived_data === true
    && license.terms_url === 'https://ec.europa.eu/eurostat/web/main/help/copyright-notice'
    && license.modification_notice.includes('nicht verantwortlich'), 'licence gate');
  keys(manifest.files, Object.keys(CONTRACTS), 'manifest file allowlist');
  const tables = {};
  for (const [name, columns] of Object.entries(CONTRACTS)) {
    const entry = manifest.files[name];
    keys(entry, columns ? ['sha256', 'bytes', 'columns', 'rows'] : ['sha256', 'bytes'], `${name} contract`);
    const bytes = read(name);
    assert(entry.bytes === bytes.length && entry.sha256 === createHash('sha256').update(bytes).digest('hex'), `${name} hash/size`);
    if (!columns) { tables[name] = JSON.parse(bytes); continue; }
    const records = parse(bytes, { skip_empty_lines: false });
    assert(same(entry.columns, columns) && same(records[0], columns) && records.length === entry.rows + 1, `${name} headers/rows`);
    tables[name] = records.slice(1).map((values) => {
      assert(values.length === columns.length && values.every((v) => v !== ''), `${name} missing cell`);
      return Object.fromEntries(columns.map((column, i) => {
        if (['Jahr', 'Geo', 'Monat', 'Partner'].includes(column)) return [column, values[i]];
        assert(/^-?\d+(\.\d+)?$/.test(values[i]) && Number.isFinite(Number(values[i])), `${name} nonnumeric cell`);
        return [column, Number(values[i])];
      }));
    });
  }
  const dependency = tables['dependency.csv'];
  assert(same(dependency.map((r) => r.Jahr), years(1990, 2024)), 'dependency years/duplicates');
  for (const row of dependency) for (const column of CONTRACTS['dependency.csv'].slice(1)) assert(row[column] >= 0 && row[column] <= 150, 'dependency range');
  const partners = tables['partners.csv'];
  assert(same(partners.map((r) => r.Jahr), years(2021, 2024)), 'partner years');
  const countries = ['RU', 'NO', 'NL', 'BE', 'US', 'FR', 'NSP'];
  for (const row of partners) {
    near(countries.reduce((sum, code) => sum + row[`${code}_TJ`], 0), row.TOTAL_TJ, 'partner sum', 0.01);
    assert(CONTRACTS['partners.csv'].slice(1).every((column) => row[column] >= 0) && row.US_LNG_TJ <= row.LNG_TJ && row.LNG_TJ <= row.TOTAL_TJ, 'LNG/partner range');
  }
  const compare = tables['partner_comparison.csv'];
  assert(same(compare.map((r) => r.Partner), ['Russland', 'Norwegen', 'Niederlande', 'Belgien', 'USA', 'Rest / unbestimmt']), 'partner labels');
  for (const year of ['2021', '2024']) {
    const row = partners.find((r) => r.Jahr === year);
    compare.forEach((r, i) => near(r[`Jahr_${year}_TWh`], (i < 5 ? row[`${countries[i]}_TJ`] : row.FR_TJ + row.NSP_TJ) / 3600, 'partner conversion'));
  }
  const monthly = tables['monthly.csv'];
  const expectedKeys = ['DE', 'EU27_2020'].flatMap((geo) => years(2024, 2025).flatMap((year) => Array.from({ length: 12 }, (_, i) => `${geo}/${year}-${String(i + 1).padStart(2, '0')}`)));
  assert(same(monthly.map((r) => `${r.Geo}/${r.Monat}`), expectedKeys), 'monthly coverage/duplicates');
  for (const row of monthly) assert(CONTRACTS['monthly.csv'].slice(2, -1).every((column) => row[column] >= 0), 'monthly negative quantity');
  const quality = tables['quality.json'];
  keys(quality, ['schema_version', 'complete_months_per_geo_year', 'summaries', 'source_flags', 'partner_sums_reconciled', 'missing_values_imputed', 'caveat'], 'quality structure');
  assert(quality.schema_version === 1 && quality.complete_months_per_geo_year === 12 && quality.missing_values_imputed === 0
    && quality.partner_sums_reconciled === true && same(quality.source_flags, []), 'quality status/flags changed: review required');
  keys(quality.summaries, ['DE', 'EU27_2020'], 'quality geographies');
  const annual = tables['balance_de.csv'];
  assert(same(annual.map((r) => r.Jahr), ['2024', '2025']), 'annual flow years');
  for (const geo of ['DE', 'EU27_2020']) {
    keys(quality.summaries[geo], ['2024', '2025'], 'quality years');
    for (const year of ['2024', '2025']) {
      const rows = monthly.filter((r) => r.Geo === geo && r.Monat.startsWith(year));
      const summary = quality.summaries[geo][year];
      keys(summary, ['IMP', 'EXP', 'IPRD', 'IC_OBS', 'IC_CAL_MG', 'STK_CHG_MG', 'NET_TJ', 'NET_OBS_PC'], 'summary keys');
      for (const column of CONTRACTS['monthly.csv'].slice(2)) near(rows.reduce((sum, r) => sum + r[column], 0), summary[column.slice(0, -3)], 'monthly sum', 0.01);
      near(summary.IMP - summary.EXP, summary.NET_TJ, 'net balance', 0.01);
      near(summary.NET_TJ / summary.IC_OBS * 100, summary.NET_OBS_PC, 'monthly rate denominator');
      if (geo === 'DE') {
        const row = annual.find((r) => r.Jahr === year);
        const mapping = { Import_TWh: 'IMP', Export_TWh: 'EXP', Netto_TWh: 'NET_TJ', Foerderung_TWh: 'IPRD', Verbrauch_TWh: 'IC_OBS', Speicheraenderung_TWh: 'STK_CHG_MG' };
        for (const [column, key] of Object.entries(mapping)) near(row[column], summary[key] / 3600, 'annual unit conversion');
        near(summary.IPRD + summary.NET_TJ - summary.STK_CHG_MG, summary.IC_CAL_MG, 'German balance reconciliation', 0.01);
      }
    }
  }
  return { manifest, tables };
}

module.exports = { validateGasImporte };
