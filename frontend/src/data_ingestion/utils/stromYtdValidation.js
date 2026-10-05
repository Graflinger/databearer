const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse/sync');

const STROM_YTD_DIRECTORY = path.resolve(__dirname, '../data/2026/strom_ytd');
const STROM_YTD_COMMIT = '66035ab8b186fe975a55d065982a00963e3cee93';
const STROM_YTD_END = '09-30';
const QUARTER_COLUMNS = (year) => [`days_${year}`, `hours_${year}`, `price_hour_sum_${year}`, `price_${year}`, `wind_onshore_${year}`, `solar_${year}`];
const STROM_YTD_CONTRACTS = {
  'periods.csv': ['year', 'start', 'end', 'days', 'energy_days', 'price_days', 'hours', 'generation_twh', 'renewable_twh', 'renewable_share_pct', 'load_twh', 'price_hour_sum', 'price_eur_mwh', 'negative_mean_days'],
  'mix_by_year.csv': ['year', 'source', 'generation_twh'],
  'comparison.csv': ['year', 'wind_onshore_twh', 'solar_twh', 'other_twh'],
  'quarters.csv': ['quarter', ...QUARTER_COLUMNS(2025), ...QUARTER_COLUMNS(2026)],
};
const STROM_YTD_RENEWABLES = ['biomass', 'hydro', 'wind_offshore', 'wind_onshore', 'solar', 'other_renewables'];
const STROM_YTD_SOURCES = [...STROM_YTD_RENEWABLES, 'lignite', 'hard_coal', 'gas', 'other_conventional', 'pumped_storage', 'nuclear'];
const STROM_YTD_QUARTERS = [['Q1', 90, 91], ['Q2', 91, 91], ['Q3', 92, 92]];
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(`Strom YTD: ${message}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const close = (a, b, tolerance = 0.00002) => check(Math.abs(a - b) <= tolerance, 'unreconciled aggregates');
const leap = (year) => year % 4 === 0;

function validateStromYtd(directory = STROM_YTD_DIRECTORY) {
  check(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(), 'unsafe entity directory');
  const names = ['manifest.json', ...Object.keys(STROM_YTD_CONTRACTS)].sort();
  check(same(fs.readdirSync(directory).sort(), names), 'exact file allowlist mismatch');
  const read = (name) => {
    const filename = path.join(directory, name);
    check(fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), 'unsafe payload');
    return fs.readFileSync(filename);
  };
  const manifest = JSON.parse(read('manifest.json'));
  check(manifest.schema_version === 2 && manifest.entity === 'strom_ytd' && manifest.methodology_version === 'same-calendar-window-v2', 'manifest version');
  check(manifest.source_commit === STROM_YTD_COMMIT && manifest.source_commit_time === '2026-10-02T12:05:34Z', 'frozen source commit');
  check(manifest.source_last_date === '2026-10-01' && manifest.observation_cutoff === `2026-${STROM_YTD_END}`
    && manifest.prepared_on === '2026-10-03' && manifest.upstream_retrieved_at === null, 'provenance dates');
  check(manifest.timezone === 'Europe/Berlin' && manifest.price_zone === 'DE-LU', 'scope');
  check(manifest.source.url === 'https://www.smard.de/home/marktdaten' && manifest.source.license === 'CC BY 4.0', 'source/license');
  check(same(manifest.coverage, {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], start_month_day: '01-01', end_month_day: STROM_YTD_END,
    leap_day: 'included; 274 days in 2020/2024, otherwise 273',
    quarters: '2025 and 2026: Q1-Q3, calendar quarters, reconciled to the period totals',
    missing_energy_days: 0, missing_price_days: 0,
  }), 'coverage');
  check(same(manifest.units, { energy: 'TWh', source_energy: 'GWh', share: '% of public net generation', price: 'EUR/MWh, nominal', price_hour_sum: '(EUR/MWh)*h', hours: 'h' }), 'units');
  check(manifest.exporter === 'frontend/src/data_ingestion/freeze_strom_ytd.py', 'export identity');
  const editorialPaths = [
    '/wiki-article/446/384/so-funktioniert-der-strommarkt',
    '/topic-article/444/209624',
    '/topic-article/444/220298/nettoexport-von-strom-im-ersten-quartal',
    '/topic-article/444/221002/erzeugung-und-verbrauch-leicht-gestiegen',
  ];
  check(Array.isArray(manifest.editorial_sources) && manifest.editorial_sources.length === editorialPaths.length, 'editorial sources');
  manifest.editorial_sources.forEach((source, i) => {
    check(source.url === `https://www.smard.de/page/home${editorialPaths[i]}` && source.consulted_on === '2026-10-03' && typeof source.scope === 'string' && source.scope.length > 20, 'editorial provenance');
  });
  check(same(Object.keys(manifest.methodology).sort(), ['energy', 'limitations', 'missing', 'price', 'renewable', 'scope']), 'methodology fields');
  check(Object.values(manifest.methodology).every((v) => typeof v === 'string' && v.length > 40), 'methodology descriptions');
  check(manifest.source_files.length === 9, 'source inventory');
  manifest.source_files.forEach((source, index) => {
    const prefix = 'frontend/src/data-history/german-electricity/';
    const expected = index === 0 ? `${prefix}manifest.json` : `${prefix}${2018 + index}.${source.sha256}.json`;
    check(source.path === expected && /^[a-f0-9]{64}$/.test(source.sha256) && Number.isInteger(source.bytes) && source.bytes > 0, 'source path/hash');
  });
  check(same(Object.keys(manifest.payloads).sort(), Object.keys(STROM_YTD_CONTRACTS).sort()), 'payload allowlist');
  const tables = {};
  const counts = { 'periods.csv': 8, 'mix_by_year.csv': 96, 'comparison.csv': 2, 'quarters.csv': 3 };
  for (const [name, columns] of Object.entries(STROM_YTD_CONTRACTS)) {
    const raw = read(name);
    const meta = manifest.payloads[name];
    check(same(Object.keys(meta).sort(), ['bytes', 'columns', 'rows', 'sha256']), 'payload contract fields');
    check(sha256(raw) === meta.sha256 && raw.length === meta.bytes, `${name} hash/size mismatch`);
    check(same(meta.columns, columns) && meta.rows === counts[name], `${name} contract mismatch`);
    const records = parse(raw, { skip_empty_lines: false });
    check(same(records.shift(), columns) && records.length === meta.rows, `${name} headers/rows`);
    tables[name] = records.map((values) => Object.fromEntries(columns.map((column, i) => {
      const value = values[i];
      if (['start', 'end', 'source', 'quarter'].includes(column)) return [column, value];
      check(/^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)), `${name} non-finite/empty numeric value`);
      return [column, Number(value)];
    })));
  }
  const periods = tables['periods.csv'];
  periods.forEach((period, i) => {
    const year = 2019 + i;
    const days = leap(year) ? 274 : 273;
    check(period.year === year && period.start === `${year}-01-01` && period.end === `${year}-${STROM_YTD_END}`, 'calendar window/order');
    check(period.days === days && period.energy_days === days && period.price_days === days && period.hours === days * 24 - 1, 'days/hours/coverage');
    check(Number.isInteger(period.negative_mean_days) && period.negative_mean_days >= 0 && period.negative_mean_days <= days, 'negative daily means');
    check(period.generation_twh > 0 && period.load_twh > 0 && period.renewable_share_pct >= 0 && period.renewable_share_pct <= 100, 'energy bounds');
    close(period.price_eur_mwh, period.price_hour_sum / period.hours);
    const mix = tables['mix_by_year.csv'].slice(i * 12, (i + 1) * 12);
    check(same(mix.map((r) => r.source), STROM_YTD_SOURCES) && mix.every((r) => r.year === year && r.generation_twh >= 0), 'source keys/year/values');
    const sum = (rows) => rows.reduce((total, r) => total + r.generation_twh, 0);
    close(period.generation_twh, sum(mix));
    close(period.renewable_twh, sum(mix.slice(0, 6)));
    close(period.renewable_share_pct, 100 * period.renewable_twh / period.generation_twh);
    if (year >= 2024) check(mix[11].generation_twh === 0, 'post-nuclear generation');
    if (year >= 2025) {
      const comparison = tables['comparison.csv'][year - 2025];
      check(comparison.year === year, 'comparison year');
      close(comparison.wind_onshore_twh, mix[3].generation_twh);
      close(comparison.solar_twh, mix[4].generation_twh);
      close(comparison.other_twh, period.generation_twh - comparison.wind_onshore_twh - comparison.solar_twh);
      // Quarters partition the period exactly: days, hours, price numerator and energy.
      const quarters = tables['quarters.csv'];
      check(same(quarters.map((q) => q.quarter), STROM_YTD_QUARTERS.map(([label]) => label)), 'quarter labels/order');
      quarters.forEach((q, index) => {
        const expectedDays = STROM_YTD_QUARTERS[index][leap(year) ? 2 : 1];
        check(q[`days_${year}`] === expectedDays && q[`hours_${year}`] === expectedDays * 24 - (index === 0 ? 1 : 0), 'quarter days/hours');
        close(q[`price_${year}`], q[`price_hour_sum_${year}`] / q[`hours_${year}`]);
        check(q[`wind_onshore_${year}`] >= 0 && q[`solar_${year}`] >= 0, 'quarter energy bounds');
      });
      const total = (key) => quarters.reduce((acc, q) => acc + q[`${key}_${year}`], 0);
      check(total('days') === period.days && total('hours') === period.hours, 'quarters cover the period');
      close(total('price_hour_sum'), period.price_hour_sum, 0.00005);
      close(total('wind_onshore'), mix[3].generation_twh, 0.00005);
      close(total('solar'), mix[4].generation_twh, 0.00005);
    }
  });
  return { manifest, tables };
}

module.exports = { validateStromYtd, STROM_YTD_DIRECTORY, STROM_YTD_COMMIT };
