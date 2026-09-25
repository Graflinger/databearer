// Offline packaging only: retrieve the exact reviewed Git blob, never live data.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIRECTORY, CSV, SOURCE, MANIFEST, PROVENANCE, annualCSV, checkSource, makeManifest, validateStromhandel } = require('../src/data_ingestion/utils/stromhandelValidation');

const root = path.resolve(__dirname, '../..');
const source = execFileSync('git', ['show', `${PROVENANCE.source_commit}:${PROVENANCE.source_path}`], { cwd: root });
const snapshot = checkSource(source);
const csv = fs.readFileSync(path.join(DIRECTORY, CSV));
if (csv.toString('utf8') !== annualCSV(snapshot)) throw new Error('Existing reviewed CSV differs; refusing to replace it');
const manifest = Buffer.from(`${JSON.stringify(makeManifest(source, csv), null, 2)}\n`);
// Validate the complete candidate before promotion. The manifest is promoted last.
const staging = fs.mkdtempSync(path.join(__dirname, '.stromhandel-'));
try {
  for (const [name, bytes] of [[CSV, csv], [SOURCE, source], [MANIFEST, manifest]]) fs.writeFileSync(path.join(staging, name), bytes);
  validateStromhandel(staging);
  fs.renameSync(path.join(staging, SOURCE), path.join(DIRECTORY, SOURCE));
  fs.renameSync(path.join(staging, MANIFEST), path.join(DIRECTORY, MANIFEST));
  validateStromhandel();
  console.log('Frozen Stromhandel: original CSV preserved, 84 months reconciled; no source requests.');
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
