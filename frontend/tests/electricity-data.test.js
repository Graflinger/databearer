const data = require('../src/js/dashboards/electricity-data');
const realSnapshot = require('../src/_data/germanElectricity.json');

// Synthetic data exists only in tests. The published page always uses the pipeline snapshot.
function fixture(start = '2026-08-09T22:00:00Z', end = '2026-09-08T22:00:00Z') {
  const rows = [];
  for (let time = Date.parse(start); time < Date.parse(end); time += data.HOUR) {
    rows.push([time, ...Array(11).fill(1), 15, rows.length % 2 ? 30 : -10]);
  }
  return { schema_version: 1, source: { ...data.SOURCE }, timezone: data.TIMEZONE,
    window_start: start, window_end: end, data_through: end,
    snapshot_created_at: new Date(Date.parse(end) + data.HOUR).toISOString().replace('.000Z', 'Z'),
    content_hash: 'a'.repeat(64), columns: [...data.COLUMNS], rows,
    units: { power: 'GW', price: 'EUR/MWh' }, expected_update: 'daily', stale_after_hours: 96 };
}
const now = Date.parse('2026-12-01T00:00:00Z');

describe('electricity snapshot and periods', () => {
  test('accepts the real pipeline snapshot without changing it', () => {
    expect(data.validateSnapshot(realSnapshot, Math.max(now, Date.parse(realSnapshot.snapshot_created_at)))).toBe(realSnapshot);
    expect(data.summarize(realSnapshot).rows.length).toBeGreaterThanOrEqual(23);
  });
  test.each([1, 7, 30])('%i-day KPIs integrate the same selected chart rows', (days) => {
    const snapshot = data.validateSnapshot(fixture(), now);
    const summary = data.summarize(snapshot, days);
    expect(summary.rows).toEqual(data.selectRows(snapshot, days));
    expect(summary.hours).toBe(days * 24);
    expect(summary.generationAverage).toBe(11);
    expect(summary.generationEnergy).toBe(11 * days * 24);
    expect(summary.loadAverage).toBe(15);
    expect(summary.priceAverage).toBe(10);
    expect(summary.priceMin).toBe(-10);
    expect(summary.negativeHours).toBe(days * 12);
    expect(summary.renewableShare).toBeCloseTo(6 / 11 * 100);
    expect(summary.mix.reduce((sum, source) => sum + source.share, 0)).toBeCloseTo(100);
    expect(summary.label).not.toContain('9. September');
  });
  test.each([
    ['2026-02-27T23:00:00Z', '2026-03-29T22:00:00Z', 719, 23],
    ['2026-09-25T22:00:00Z', '2026-10-25T23:00:00Z', 721, 25],
  ])('handles Berlin DST window %s', (start, end, hours, dayHours) => {
    const snapshot = data.validateSnapshot(fixture(start, end), now);
    expect(data.summarize(snapshot, 30).hours).toBe(hours);
    expect(data.summarize(snapshot, 1).hours).toBe(dayHours);
    expect(data.summarize(snapshot, 7).hours).toBe(144 + dayHours);
    expect(data.summarize(snapshot, 1).generationEnergy).toBe(11 * dayHours);
  });
  test('distinguishes repeated local hours using explicit offsets', () => {
    const first = data.timestampLabel(Date.parse('2026-10-25T00:00:00Z'));
    const second = data.timestampLabel(Date.parse('2026-10-25T01:00:00Z'));
    expect(first).toContain('02:00');
    expect(second).toContain('02:00');
    expect(first).toContain('GMT+2');
    expect(second).toContain('GMT+1');
  });
  test('weights durations and energy, not instantaneous shares or unweighted means', () => {
    const first = [0, ...Array(11).fill(0), 10, -20];
    const second = [data.HOUR, ...Array(11).fill(0), 40, 40];
    first[1] = 10;
    second[11] = 30; // Pumped storage contributes to the denominator, not renewables.
    const summary = data.summarizeRows([first, second], 3 * data.HOUR);
    expect(summary.generationEnergy).toBe(70);
    expect(summary.generationAverage).toBeCloseTo(70 / 3);
    expect(summary.renewableShare).toBeCloseTo(10 / 70 * 100);
    expect(summary.loadAverage).toBe(30);
    expect(summary.priceAverage).toBe(20);
    expect(summary.negativeHours).toBe(1);
  });
  test('zero generation produces an undefined share rather than fabricated percentages', () => {
    const row = [0, ...Array(13).fill(0)];
    const summary = data.summarizeRows([row], data.HOUR);
    expect(summary.renewableShare).toBeNull();
    expect(data.presentation(summary).renewable).toBe('–');
  });
  test.each([
    ['missing hour', (s) => s.rows.splice(10, 1)],
    ['duplicate hour', (s) => { s.rows[10][0] = s.rows[9][0]; }],
    ['wrong order', (s) => s.rows.reverse()],
    ['null', (s) => { s.rows[0][1] = null; }],
    ['string', (s) => { s.rows[0][1] = '1'; }],
    ['boolean', (s) => { s.rows[0][1] = true; }],
    ['NaN', (s) => { s.rows[0][1] = NaN; }],
    ['infinity', (s) => { s.rows[0][1] = Infinity; }],
    ['negative generation', (s) => { s.rows[0][1] = -1; }],
    ['oversized generation', (s) => { s.rows[0][1] = 201; }],
    ['oversized price', (s) => { s.rows[0][13] = -10001; }],
    ['columns', (s) => s.columns.reverse()],
    ['nuclear', (s) => s.columns.push('nuclear')],
    ['schema', (s) => { s.schema_version = 2; }],
    ['timezone', (s) => { s.timezone = 'UTC'; }],
    ['units', (s) => { s.units.power = 'MW'; }],
    ['source', (s) => { s.source.name = 'Unknown'; }],
    ['extra field', (s) => { s.extra = 1; }],
    ['hash', (s) => { s.content_hash = 'invalid'; }],
    ['boundary mismatch', (s) => { s.data_through = s.window_start; }],
    ['invalid date', (s) => { s.snapshot_created_at = '2026-02-30T00:00:00Z'; }],
  ])('rejects %s', (name, mutate) => {
    const snapshot = fixture();
    mutate(snapshot);
    expect(() => data.validateSnapshot(snapshot, now)).toThrow('Stromdaten');
  });
  test('rejects pre-shutdown and non-midnight windows', () => {
    expect(() => data.validateSnapshot(fixture('2023-03-31T22:00:00Z', '2023-04-30T22:00:00Z'), now)).toThrow();
    expect(() => data.validateSnapshot(fixture('2026-08-09T23:00:00Z', '2026-09-08T23:00:00Z'), now)).toThrow();
    expect(() => data.validateSnapshot(fixture('2026-08-09T22:00:30Z', '2026-09-08T22:00:30Z'), now)).toThrow();
  });
});

describe('freshness is measured from exclusive coverage', () => {
  test('warns only after 96 hours even if the snapshot was created recently', () => {
    const snapshot = fixture();
    const through = Date.parse(snapshot.data_through);
    snapshot.snapshot_created_at = new Date(through + 95 * data.HOUR).toISOString().replace('.000Z', 'Z');
    expect(data.freshness(snapshot, through + 96 * data.HOUR).stale).toBe(false);
    expect(data.freshness(snapshot, through + 96 * data.HOUR + 1).stale).toBe(true);
  });
  test('rejects future creation, future coverage, and creation before coverage', () => {
    const snapshot = fixture();
    const through = Date.parse(snapshot.data_through);
    expect(() => data.validateSnapshot(snapshot, through - 1)).toThrow('Zukunft');
    expect(() => data.validateSnapshot(snapshot, through)).toThrow('Zukunft');
    snapshot.snapshot_created_at = snapshot.window_start;
    expect(() => data.validateSnapshot(snapshot, now)).toThrow('Zukunft');
  });
});
