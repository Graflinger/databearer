const { createHash } = require('crypto');
const history = require('../../src/js/dashboards/electricity-history');

const HOUR = 3600000;
function nextDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 24 * HOUR).toISOString().slice(0, 10);
}
// At 00:00 UTC Berlin reads 01:00 (winter) or 02:00 (summer). DST switches
// later, so this gives the offset at that date's local midnight independently
// of the production helper. In particular, do not assume a 22:00 UTC boundary.
function midnight(date) {
  const utc = Date.parse(`${date}T00:00:00Z`);
  const offset = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23',
  }).format(utc));
  return utc - offset * HOUR;
}
function endExclusive(manifest) { return midnight(nextDate(manifest.last_date)); }

// Advance only in-memory test data. Preserve closed-year fixtures for gap/zone
// assertions, completing the last year before adding a new January partition.
function advanceHistory(input, readPartition, lastDate) {
  const manifest = JSON.parse(JSON.stringify(input.manifest));
  let latest = manifest.years.at(-1);
  let current = JSON.parse(JSON.stringify(readPartition(latest.year)));
  const changed = new Map([[current.year, current]]);
  for (let date = nextDate(manifest.last_date); date <= lastDate; date = nextDate(date)) {
    const year = Number(date.slice(0, 4));
    const previous = current.rows.at(-1);
    if (year !== current.year) {
      latest.frozen = true;
      current = { ...current, year, rows: [] };
      changed.set(year, current);
      latest = { year, first_date: date, frozen: false };
      manifest.years.push(latest);
    }
    current.rows.push({ ...previous, date, hours: (midnight(nextDate(date)) - midnight(date)) / HOUR,
      energy_gwh: { ...previous.energy_gwh } });
    latest.last_date = date;
    latest.days = current.rows.length;
  }
  manifest.last_date = lastDate;
  for (const item of manifest.years) {
    if (!changed.has(item.year)) continue;
    item.sha256 = createHash('sha256').update(JSON.stringify(changed.get(item.year))).digest('hex');
    item.url = `${history.PREFIX}${item.year}.${item.sha256}.json`;
    history.validatePartition(changed.get(item.year), item);
  }
  history.validateManifest(manifest);
  const summary = history.summarize(current);
  return { data: { manifest, manifestJSON: history.safeJSON(manifest), summary: { ...summary, text: history.presentation(summary) } },
    partition: (year) => changed.get(year) || readPartition(year) };
}

module.exports = { nextDate, midnight, endExclusive, advanceHistory };
