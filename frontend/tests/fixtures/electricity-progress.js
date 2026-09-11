const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const sourceBytes = () => fs.readFileSync(path.join(__dirname, '../../src/_data/germanElectricityProgress.json'));
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
function encode(value) {
  const rest = { ...value };
  delete rest.content_hash;
  return Buffer.from(canonical({ ...rest, content_hash: createHash('sha256').update(canonical(rest)).digest('hex') }));
}
// Fixed coverage, mutable observations: producer refreshes cannot invalidate fixtures.
function fixture() {
  const value = JSON.parse(sourceBytes());
  value.congestion.annual = value.congestion.annual.filter((row) => row.year <= 2025);
  value.congestion.annual_through = '2025-12-31';
  value.congestion.monthly = value.congestion.monthly.filter((row) => row.month <= '2026-05');
  value.congestion.monthly_through = '2026-05';
  return value;
}
function rollover() {
  const value = fixture();
  value.congestion.annual.push({ year: 2026, energy_gwh: 31000, cost_million_eur: 2900 });
  value.congestion.annual_through = '2026-12-31';
  for (let month = 6; month <= 12; month++) value.congestion.monthly.push({ month: `2026-${String(month).padStart(2, '0')}`, energy_gwh: 1000, cost_million_eur: 100, redispatch_energy_gwh: 700, redispatch_cost_million_eur: 40 });
  value.congestion.monthly_through = '2026-12';
  return value;
}
module.exports = { sourceBytes, encode, fixture, rollover };
