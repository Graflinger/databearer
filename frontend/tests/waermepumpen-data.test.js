const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { validateWaermepumpen, HEADERS } = require('../src/data_ingestion/utils/waermepumpenValidation');

const SOURCE = path.resolve(__dirname, '../src/data_ingestion/data/2026/waermepumpen');
let temporary;
let directory;
beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'waermepumpen-test-'));
  directory = path.join(temporary, 'package');
  fs.cpSync(SOURCE, directory, { recursive: true });
});
afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

function manifestEdit(edit) {
  const filename = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  edit(manifest);
  fs.writeFileSync(filename, JSON.stringify(manifest));
}
function payloadEdit(name, edit, rehash = true) {
  const filename = path.join(directory, name);
  fs.writeFileSync(filename, edit(fs.readFileSync(filename, 'utf8')));
  if (rehash) {
    const bytes = fs.readFileSync(filename);
    manifestEdit((m) => {
      m.files[name].bytes = bytes.length;
      m.files[name].sha256 = createHash('sha256').update(bytes).digest('hex');
    });
  }
}

test('complete frozen evidence and both stable chart APIs validate', () => {
  const manifest = validateWaermepumpen(directory);
  expect(Object.keys(manifest.files)).toEqual(Object.keys(HEADERS));
  const configs = require('../src/data_ingestion/charts/waermepumpen');
  expect(configs.map((c) => [c.containerId, c.outputFile])).toEqual([
    ['waermepumpen-anteil', 'anteil.js'], ['waermepumpen-neubau', 'neubau.js'],
  ]);
  expect(configs[0].smooth).toBe(false);
  expect(configs[1].stacked).toBe(false);
  for (const config of configs) expect(fs.existsSync(path.resolve(SOURCE, '../..', config.dataFile))).toBe(true);
});

test.each(Object.keys(HEADERS))('missing %s fails, including supporting evidence', (name) => {
  fs.unlinkSync(path.join(directory, name));
  expect(() => validateWaermepumpen(directory)).toThrow(/allowlist/);
});
test('unexpected payload and unexpected manifest path fail', () => {
  fs.writeFileSync(path.join(directory, 'raw.csv'), 'raw');
  expect(() => validateWaermepumpen(directory)).toThrow(/allowlist/);
  fs.unlinkSync(path.join(directory, 'raw.csv'));
  manifestEdit((m) => { m.files['../outside.csv'] = m.files['anteil.csv']; });
  expect(() => validateWaermepumpen(directory)).toThrow(/allowlist/);
});
test('symlink payload and directory are rejected', () => {
  const filename = path.join(directory, 'anteil.csv');
  fs.unlinkSync(filename);
  fs.symlinkSync(path.join(SOURCE, 'anteil.csv'), filename);
  expect(() => validateWaermepumpen(directory)).toThrow(/regular file/);
  const link = path.join(temporary, 'link');
  fs.symlinkSync(SOURCE, link);
  expect(() => validateWaermepumpen(link)).toThrow(/directory/);
});
test('mixed or corrupted bytes fail before semantic interpretation', () => {
  payloadEdit('neubau.csv', (s) => s.replace('43400', '43500'), false);
  expect(() => validateWaermepumpen(directory)).toThrow(/hash mismatch/);
});

test.each([
  ['anteil.csv', '2015,', '2016,', /year keys/],
  ['anteil.csv', '31.4', 'NaN', /finite/],
  ['anteil.csv', '31.4', '', /finite/],
  ['anteil.csv', '31.4', 'Infinity', /finite/],
  ['anteil.csv', '31.4', '101.0', /percentage range/],
  ['anteil.csv', '31.4', '32.0', /source observations/],
  ['neubau.csv', '43400', '43500', /source observations/],
  ['neubau.csv', '58900', '58901', /rounded count/],
  ['genehmigungen.csv', '83.0', '84.0', /source observations/],
  ['genehmigungen.csv', '2024,', '2026,', /year keys/],
])('rehashing cannot hide semantic corruption: %s %s → %s', (name, from, to, error) => {
  payloadEdit(name, (s) => {
    expect(s).toContain(from);
    return s.replace(from, to);
  });
  expect(() => validateWaermepumpen(directory)).toThrow(error);
});

test.each([
  (m) => { m.snapshot_date = '2026-02-30'; },
  (m) => { m.observation_cutoff = '2026-12-31'; },
  (m) => { m.sources.press2024.publication_date = '2024-06-05'; },
  (m) => { m.sources.trend.retrieved_at = '2026-02-30T12:00:00Z'; },
  (m) => { m.sources.trend.retrieved_at = '2999-11-05T12:00:00Z'; },
  (m) => { m.sources.trend.sha256 = 'invalid'; },
  (m) => { m.contracts['anteil.csv'].years = [2025]; },
  (m) => { m.contracts['anteil.csv'].nullable[1] = true; },
  (m) => { m.contracts['neubau.csv'].units[1] = 'Geräte'; },
  (m) => { m.files['neubau.csv'].rows = 4; },
  (m) => { m.licenses[0].name = 'DL-DE-BY-2.0'; },
  (m) => { m.licenses[0].commercial_use = false; },
  (m) => { m.context_source_licenses = []; },
  (m) => { m.context_source_licenses[0].redistribution = true; },
  (m) => { m.context_source_licenses[1].database_rights = ''; },
  (m) => { m.excluded_sources[0].license_clearance = true; },
])('invalid dates, contracts or licensing fail (%#)', (edit) => {
  manifestEdit(edit);
  expect(() => validateWaermepumpen(directory)).toThrow(/Waermepumpen validation/);
});

test('duplicate headers and ragged records fail even with fresh hashes', () => {
  payloadEdit('anteil.csv', (s) => s.replace('Erdgas_Prozent', 'Waermepumpen_Prozent'));
  expect(() => validateWaermepumpen(directory)).toThrow(/headers/);
  fs.copyFileSync(path.join(SOURCE, 'anteil.csv'), path.join(directory, 'anteil.csv'));
  payloadEdit('anteil.csv', (s) => s.replace('2015,31.4,51.5', '2015,31.4'));
  expect(() => validateWaermepumpen(directory)).toThrow();
});
