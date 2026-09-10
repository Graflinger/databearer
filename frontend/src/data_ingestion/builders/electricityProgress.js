const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { isDeepStrictEqual } = require('util');
const { SOURCE, dayKey } = require('../../js/dashboards/electricity-data');
const { parseCanonical } = require('../../js/dashboards/electricity-history');

const INPUT = path.resolve(__dirname, '../../_data/germanElectricityProgress.json');
const LIMIT = 150000;
// Independently pinned contract, not metadata imported from the unverified JSON.
const CSV = 'https://www.smard.de/resource/blob/217306/-/data-csv-data.csv';
const LICENSE = 'https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf';
const CAPACITY = 'https://www.smard.de/page/home/topic-article/211972/212382/entwicklung-der-nettonennleistung';
const EEG = 'https://www.gesetze-im-internet.de/eeg_2014/__4.html';
const WINDSEE = 'https://www.gesetze-im-internet.de/windseeg/__1.html';
const SCOPE = 'Gemeldete Kraftwerksliste: Nettonennleistung am und außerhalb des Strommarktes; kann ausländische, in das deutsche Netz einspeisende Kraftwerke umfassen. Kleinspeicher unter 13,2 kW sind ausgeschlossen; kein Gesamtbestand deutscher Batteriespeicher. Speicherleistung, keine Speicherkapazität in GWh.';
const CAPACITY_KEYS = ['solar_gw', 'wind_onshore_gw', 'wind_offshore_gw', 'battery_gw', 'pumped_storage_gw'];
const ENERGY_KEYS = ['energy_gwh', 'cost_million_eur'];
const target = (source_url, comparison, maintain_after_year, years, values) => ({ source_url, comparison, maintain_after_year, rows: years.map((year, i) => ({ year, capacity_gw: values[i] })) });
const TARGET_YEARS = [2024, 2026, 2028, 2030, 2035, 2040];
const TARGETS = {
  verified_on: '2026-09-10', unit: 'GW', kind: 'statutory_baseline',
  solar: target(EEG, 'target', 2040, TARGET_YEARS, [88, 128, 172, 215, 309, 400]),
  wind_onshore: target(EEG, 'target', 2040, TARGET_YEARS, [69, 84, 99, 115, 157, 160]),
  wind_offshore: target(WINDSEE, 'at_least', null, [2030, 2035, 2045], [30, 40, 70]),
};
function assert(condition, message) { if (!condition) throw new Error(`Stromausbau: ${message}`); }
function fields(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), 'Unbekannte oder fehlende Felder');
}
function monthIndex(value) {
  assert(typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value), 'Ungültiger Monat');
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
}
function rows(values, periodKey, keys, start, minimum, maximum, limit, ceiling) {
  assert(Array.isArray(values) && values.length > 0 && values.length <= limit, 'Ungültige Zeilenzahl');
  values.forEach((row, i) => {
    fields(row, [periodKey, ...keys]);
    const period = periodKey === 'year' ? row.year : monthIndex(row.month);
    assert(Number.isInteger(period) && period === start + i && period <= maximum, 'Lückenhafter, doppelter oder unvollständiger Zeitraum');
    keys.forEach((key) => assert(typeof row[key] === 'number' && Number.isFinite(row[key]) && row[key] >= 0 && row[key] <= ceiling, 'Ungültiger Zahlenwert'));
  });
  assert(start + values.length - 1 >= minimum, 'Verkürzte Mindestabdeckung');
}
function verifyProgress(bytes, now = Date.now()) {
  const { parsed: snapshot, semantic } = parseCanonical(bytes, LIMIT, ['content_hash']);
  fields(snapshot, ['schema_version', 'kind', 'source', 'source_csv', 'license_evidence', 'capacity', 'targets', 'congestion', 'content_hash']);
  assert(snapshot.schema_version === 1 && snapshot.kind === 'german-electricity-progress', 'Ungültiges Schema');
  assert(isDeepStrictEqual(snapshot.source, SOURCE) && snapshot.source_csv === CSV && snapshot.license_evidence === LICENSE, 'Ungültige Quelle oder Lizenz');
  assert(isDeepStrictEqual(snapshot.targets, TARGETS), 'Ungültige gesetzliche Ziele');
  // JS Number erases the distinction between Python integer and float tokens.
  // Years/schema and the frozen statutory baseline require integer spelling.
  for (const [, key, token] of semantic.matchAll(/"(year|schema_version|capacity_gw|maintain_after_year)":([^,}\]]+)/g)) {
    assert((key === 'maintain_after_year' && token === 'null') || /^(0|[1-9]\d*)$/.test(token), 'Ganzzahliges Metadaten-Token erwartet');
  }
  assert(typeof snapshot.content_hash === 'string' && /^[a-f0-9]{64}$/.test(snapshot.content_hash), 'Ungültiger content_hash');
  assert(createHash('sha256').update(semantic, 'utf8').digest('hex') === snapshot.content_hash, 'content_hash stimmt nicht mit dem Dateiinhalt überein');
  const today = dayKey(now);
  const year = Number(today.slice(0, 4));
  assert(snapshot.targets.verified_on <= today, 'Zielprüfung liegt in der Zukunft');
  const capacity = snapshot.capacity;
  fields(capacity, ['reference', 'unit', 'scope', 'source_url', 'provisional', 'data_through', 'rows']);
  assert(capacity.reference === 'year_end' && capacity.unit === 'GW' && capacity.scope === SCOPE && capacity.source_url === CAPACITY && capacity.provisional === true, 'Ungültige Leistungsmetadaten');
  rows(capacity.rows, 'year', CAPACITY_KEYS, 2011, 2025, Math.min(2025, year - 1), 15, 1000);
  assert(capacity.data_through === `${capacity.rows.at(-1).year}-12-31`, 'Ungültiger Leistungsdatenstand');
  const congestion = snapshot.congestion;
  fields(congestion, ['units', 'annual', 'monthly', 'annual_through', 'monthly_through']);
  assert(isDeepStrictEqual(congestion.units, { energy: 'GWh', cost: 'million EUR' }), 'Ungültige Engpasseinheiten');
  rows(congestion.annual, 'year', ENERGY_KEYS, 2015, 2025, Math.min(year - 1, 2100), 100, 1000000);
  rows(congestion.monthly, 'month', [...ENERGY_KEYS, 'redispatch_energy_gwh', 'redispatch_cost_million_eur'], monthIndex('2022-07'), monthIndex('2026-05'), monthIndex(today.slice(0, 7)) - 1, 600, 1000000);
  assert(congestion.annual_through === `${congestion.annual.at(-1).year}-12-31` && congestion.monthly_through === congestion.monthly.at(-1).month, 'Ungültiger Engpassdatenstand');
  return snapshot;
}
// Escape script boundaries without changing Python's numeric tokens (e.g. 0.0).
function safeRawJSON(raw) {
  return raw.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
const dateLabel = (date) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const monthLabel = (month) => new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
function view(snapshot, raw) {
  return { snapshot, raw, json: safeRawJSON(raw),
    capacityLatest: snapshot.capacity.rows.at(-1), annualLatest: snapshot.congestion.annual.at(-1), monthlyLatest: snapshot.congestion.monthly.at(-1),
    capacityDate: dateLabel(snapshot.capacity.data_through), annualDate: dateLabel(snapshot.congestion.annual_through), monthlyDate: monthLabel(snapshot.congestion.monthly_through), targetDate: dateLabel(snapshot.targets.verified_on),
    targetCards: [['solar', 'Photovoltaik'], ['wind_onshore', 'Wind an Land'], ['wind_offshore', 'Wind auf See']].map(([key, label]) => ({ label, ...snapshot.targets[key], rows: snapshot.targets[key].rows.filter((row) => row.year >= 2030) })) };
}
function readProgress(input = INPUT, now) {
  const stat = fs.lstatSync(input);
  assert(stat.isFile() && stat.size > 0 && stat.size <= LIMIT, 'Ungültige Quelldatei');
  const bytes = fs.readFileSync(input);
  return view(verifyProgress(bytes, now), bytes.toString('utf8'));
}
function verifyPublishedProgress(outputDirectory) {
  const validated = readProgress();
  const raw = fs.readFileSync(path.join(outputDirectory, 'data/german-electricity-progress.json'), 'utf8');
  assert(raw === validated.raw, 'Veröffentlichter Download weicht von geprüfter Quelle ab');
  const html = fs.readFileSync(path.join(outputDirectory, 'dashboards/strom/index.html'), 'utf8');
  assert(html.includes(`<script type="application/json" id="electricity-progress-data">${validated.json}</script>`), 'HTML und geprüfte Quelle weichen ab');
}
module.exports = { verifyProgress, readProgress, verifyPublishedProgress, view, safeRawJSON };
