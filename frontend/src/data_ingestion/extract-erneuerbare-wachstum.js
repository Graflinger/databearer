// Explicit offline freeze only; never invoked by a build or daily refresh.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readProgress } = require('./builders/electricityProgress');
const { aggregate, verifyTrade, verifyAnnual } = require('./builders/electricityTrends');
const { readHistory } = require('./builders/electricityHistory');
const { validateErneuerbareWachstum, summaryRows, DIRECTORY, REVISION, DATE, CONTRACTS, SOURCE_PATHS, PROVENANCE, COVERAGE, QUALITY, hash } = require('./utils/erneuerbareWachstumValidation');

const ROOT = path.resolve(__dirname, '../../..');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
function extract(output, sourceRoot = ROOT) {
  if (!output || fs.existsSync(output)) throw new Error('Supply a new staging directory; existing packages are never overwritten');
  if (!fs.statSync(path.dirname(output)).isDirectory()) throw new Error('Staging parent must exist');
  const inputs = SOURCE_PATHS.map((filename) => {
    const full = path.join(sourceRoot, filename);
    if (!fs.lstatSync(full).isFile()) throw new Error(`Unsafe source: ${filename}`);
    const bytes = fs.readFileSync(full);
    const pinned = execFileSync('git', ['show', `${REVISION}:${filename}`], { cwd: ROOT, maxBuffer: 2000000 });
    if (!bytes.equals(pinned)) throw new Error(`Source changed since pinned revision: ${filename}`);
    return { path: filename, sha256: hash(bytes), bytes: bytes.length,
      role: filename.includes('Trade') || filename.endsWith('/germanElectricity.json') || filename.includes('/2026.') ? 'validated_ancillary_not_charted' : 'evidence' };
  });
  const now = Date.parse(`${DATE}T12:00:00Z`);
  const data = path.join(sourceRoot, 'frontend/src/_data');
  const progress = readProgress(path.join(data, 'germanElectricityProgress.json'), now).snapshot;
  const trends = aggregate(
    readHistory(path.join(sourceRoot, 'frontend/src/data-history/german-electricity'), fs.readFileSync(path.join(data, 'germanElectricity.json'), 'utf8')),
    verifyTrade(fs.readFileSync(path.join(data, 'germanElectricityTrade.json')), now),
    verifyAnnual(fs.readFileSync(path.join(data, 'germanElectricityAnnual.json'))));
  const capacity = progress.capacity.rows.map(({ year, solar_gw, wind_onshore_gw, wind_offshore_gw }) => ({ year, solar_gw, wind_onshore_gw, wind_offshore_gw }));
  const generation = trends.energy.filter((row) => row.year <= 2025).map((row) => ({ year: row.year,
    solar_twh: row.mix_twh.solar, wind_onshore_twh: row.mix_twh.wind_onshore, wind_offshore_twh: row.mix_twh.wind_offshore,
    method: row.method, days: row.days, complete_days: row.complete_days }));
  const tables = { 'capacity.csv': capacity, 'generation.csv': generation, 'summary.csv': summaryRows(capacity, generation) };
  const payloads = { 'quality.json': Buffer.from(json(QUALITY)) };
  for (const [name, rows] of Object.entries(tables)) {
    const { columns } = CONTRACTS[name];
    if (rows.some((row) => columns.some((key) => row[key] === null || row[key] === undefined))) throw new Error(`Missing data: ${name}`);
    payloads[name] = Buffer.from(`${columns.join(',')}\n${rows.map((row) => columns.map((key) => row[key]).join(',')).join('\n')}\n`);
  }
  const metadata = { schema_version: 1, kind: 'frozen_erneuerbare_wachstum', frozen_on: DATE, source_revision: REVISION,
    methodology_version: 1, extractor: 'frontend/src/data_ingestion/extract-erneuerbare-wachstum.js',
    provenance: PROVENANCE, coverage: COVERAGE, inputs, files: {} };
  for (const name of Object.keys(CONTRACTS)) {
    metadata.files[name] = { sha256: hash(payloads[name]), bytes: payloads[name].length, ...(CONTRACTS[name] || {}) };
  }
  fs.mkdirSync(output);
  for (const [name, bytes] of Object.entries(payloads)) fs.writeFileSync(path.join(output, name), bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'metadata.json'), json(metadata), { flag: 'wx' });
  validateErneuerbareWachstum(output);
  return metadata;
}
if (require.main === module) {
  const [action, target] = process.argv.slice(2);
  if (action === 'extract' && target) extract(path.resolve(target));
  else if (action === 'promote' && target) {
    const staging = path.resolve(target);
    validateErneuerbareWachstum(staging);
    if (fs.existsSync(DIRECTORY)) throw new Error('Frozen entity already exists; review a refresh explicitly');
    fs.mkdirSync(path.dirname(DIRECTORY), { recursive: true });
    fs.renameSync(staging, DIRECTORY); // Complete validated directory, including manifest, promoted together.
    validateErneuerbareWachstum();
  } else throw new Error('Usage: node extract-erneuerbare-wachstum.js extract|promote NEW_STAGING_DIRECTORY');
}
module.exports = { extract };
