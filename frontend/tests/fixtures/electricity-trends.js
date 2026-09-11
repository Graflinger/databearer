const { createHash } = require('crypto');
const { advanceHistory, endExclusive } = require('./electricity-history');
const history = require('../../src/js/dashboards/electricity-history');
const { aggregate, verifyTrade } = require('../../src/data_ingestion/builders/electricityTrends');

const canonical = (value) => value && typeof value === 'object' ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
function encode(value, numericSpelling, numericKey = 'exports_gwh') {
  const { content_hash, ...semantic } = value;
  void content_hash;
  let body = canonical(semantic);
  if (numericSpelling) body = body.replace(`"${numericKey}":0`, `"${numericKey}":${numericSpelling}`);
  const hash = createHash('sha256').update(body).digest('hex');
  return Buffer.from(`{"content_hash":"${hash}",${body.slice(1)}`);
}
function shiftMonth(month, offset) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset, 1)).toISOString().slice(0, 7);
}
function monthCount(first, last) {
  return (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5)) - Number(first.slice(5)) + 1;
}
function clockAfter(historyData, snapshot, recent) {
  return Math.max(endExclusive(historyData.manifest), Date.parse(`${shiftMonth(snapshot.last_month, 1)}-01T12:00:00Z`), Date.parse(recent.snapshot_created_at), Date.parse(recent.data_through)) + 3600000;
}
function annualLabel(month) {
  const year = month.slice(0, 4);
  if (month.endsWith('-12')) return year;
  // Dashboard's explicit abbreviated labels (Intl varies: e.g. März / Sept.).
  const name = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(month.slice(5)) - 1];
  return `${year} (${month.endsWith('-01') ? 'Jan' : `Jan–${name}`})`;
}

// Extend cloned inputs only. Exercise December (no partial trade year) and the
// next January (a new partial trade year), even when checked-in data is stale.
function scenarios(input, snapshot, recent, annual = null) {
  const year = Math.max(Number(input.manifest.last_date.slice(0, 4)), Number(snapshot.last_month.slice(0, 4)));
  return [
    ['current snapshots', null],
    ['next completed month', shiftMonth(snapshot.last_month, 1)],
    ['year rollover: completed December', `${year}-12`],
    ['year rollover: next January', `${year + 1}-01`],
  ].map(([name, lastMonth]) => {
    let historyData = input;
    let trade = snapshot;
    if (lastMonth) {
      const lastDate = new Date(Date.parse(`${shiftMonth(lastMonth, 1)}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      const advanced = advanceHistory(input, (selected) => input.partitions.find((partition) => partition.year === selected), lastDate > input.manifest.last_date ? lastDate : input.manifest.last_date);
      historyData = { ...advanced.data, partitions: advanced.data.manifest.years.map(({ year }) => advanced.partition(year)),
        manifestHash: createHash('sha256').update(advanced.data.manifestJSON).digest('hex') };
      trade = JSON.parse(JSON.stringify(snapshot));
      for (let month = shiftMonth(trade.last_month, 1); month <= lastMonth; month = shiftMonth(month, 1)) {
        trade.rows.push({ month, imports_gwh: 1000, exports_gwh: 2000, net_exports_gwh: 1000, missing_series: [], structural_zero_series: [] });
      }
      trade.last_month = lastMonth;
    }
    const now = clockAfter(historyData, trade, recent);
    trade = verifyTrade(encode(trade), now);
    const summary = aggregate(historyData, trade, annual);
    return { name, historyData, snapshot: trade, annual, now, trends: { summary, json: history.safeJSON(summary), sources: history.SOURCES } };
  });
}
module.exports = { canonical, encode, monthCount, clockAfter, annualLabel, scenarios };
