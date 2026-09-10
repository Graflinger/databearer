/* Shared by Eleventy and the browser; no upstream requests or build-time clock in KPIs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ElectricityData = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR = 3600000;
  const TIMEZONE = 'Europe/Berlin';
  const SOURCES = [
    ['biomass', 'Biomasse', '#65843c', true],
    ['hydro', 'Wasserkraft', '#248b9b', true],
    ['wind_offshore', 'Wind auf See', '#3474ad', true],
    ['wind_onshore', 'Wind an Land', '#469c8a', true],
    ['solar', 'Solar', '#d5a62c', true],
    ['other_renewables', 'Sonstige Erneuerbare', '#9baf58', true],
    ['lignite', 'Braunkohle', '#88634d', false],
    ['hard_coal', 'Steinkohle', '#626a79', false],
    ['gas', 'Erdgas', '#bc7853', false],
    ['other_conventional', 'Sonstige Konventionelle', '#a483a4', false],
    ['pumped_storage', 'Pumpspeicher', '#797bc4', false],
  ].map(([key, label, color, renewable], index) => ({ key, label, color, renewable, index: index + 1 }));
  const COLUMNS = ['timestamp', ...SOURCES.map((source) => source.key), 'load', 'price'];
  const SOURCE = {
    name: 'Bundesnetzagentur | SMARD.de',
    url: 'https://www.smard.de/home/marktdaten',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    terms_url: 'https://www.smard.de/home/datennutzung',
  };
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const clockFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: TIMEZONE, day: 'numeric', month: 'long', year: 'numeric',
  });
  const timestampFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset',
  });
  function dayKey(timestamp) {
    const parts = Object.fromEntries(dayFormatter.formatToParts(timestamp).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function number(value, digits = 1) {
    return value === null ? '–' : new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
  }
  function assert(condition, message) {
    if (!condition) throw new Error(`Stromdaten: ${message}`);
  }
  function iso(value) {
    assert(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value), 'Ungültiger Zeitstempel');
    const time = Date.parse(value);
    assert(Number.isFinite(time) && new Date(time).toISOString() === value.replace('Z', '.000Z'), 'Ungültiges Datum');
    return time;
  }
  function freshness(metadata, now = Date.now()) {
    const through = iso(metadata.data_through);
    const created = iso(metadata.snapshot_created_at);
    assert(Number.isFinite(now) && through <= now && created <= now && created >= through, 'Zeitstempel liegt in der Zukunft oder vor Datenende');
    assert(metadata.stale_after_hours === 96, 'Ungültige Aktualitätsschwelle');
    return { stale: now - through > 96 * HOUR, ageHours: (now - through) / HOUR };
  }
  function validateSnapshot(snapshot, now = Date.now()) {
    assert(snapshot && typeof snapshot === 'object', 'Snapshot fehlt');
    const fields = ['schema_version', 'source', 'timezone', 'window_start', 'window_end', 'data_through',
      'snapshot_created_at', 'content_hash', 'columns', 'rows', 'units', 'expected_update', 'stale_after_hours'];
    assert(Object.keys(snapshot).sort().join() === fields.sort().join(), 'Unbekannte oder fehlende Felder');
    assert(snapshot.schema_version === 1 && snapshot.timezone === TIMEZONE && snapshot.expected_update === 'daily', 'Unbekanntes Datenformat');
    assert(JSON.stringify(snapshot.columns) === JSON.stringify(COLUMNS), 'Spalten stimmen nicht überein');
    assert(snapshot.units && Object.keys(snapshot.units).length === 2 && snapshot.units.power === 'GW' && snapshot.units.price === 'EUR/MWh', 'Ungültige Einheiten');
    assert(snapshot.source && Object.keys(snapshot.source).length === Object.keys(SOURCE).length && Object.entries(SOURCE).every(([key, value]) => snapshot.source[key] === value), 'Ungültige Quellenangaben');
    assert(/^[a-f0-9]{64}$/.test(snapshot.content_hash), 'Ungültige Snapshot-Kennung');
    const start = iso(snapshot.window_start);
    const end = iso(snapshot.window_end);
    assert(snapshot.data_through === snapshot.window_end && end > start, 'Ungültige Abdeckung');
    freshness(snapshot, now);
    assert(start % HOUR === 0 && end % HOUR === 0 && dayKey(start) >= '2024-01-01' && clockFormatter.format(start) === '00:00' && clockFormatter.format(end) === '00:00', 'Fenster muss nach 2023 an Berliner Mitternacht beginnen/enden');
    assert(Array.isArray(snapshot.rows) && snapshot.rows.length >= 719 && snapshot.rows.length <= 721 && snapshot.rows.length * HOUR === end - start, 'Unvollständiges 30-Tage-Fenster');
    snapshot.rows.forEach((row, index) => {
      assert(Array.isArray(row) && row.length === COLUMNS.length && Number.isSafeInteger(row[0]) && row[0] === start + index * HOUR, 'Fehlende, doppelte oder unsortierte Stunde');
      row.slice(1).forEach((value, column) => {
        assert(typeof value === 'number' && Number.isFinite(value) && (column === 12 ? Math.abs(value) <= 10000 : value >= 0 && value <= 200), 'Ungültiger Messwert');
      });
    });
    assert(new Set(snapshot.rows.map((row) => dayKey(row[0]))).size === 30, 'Erwartet werden 30 Kalendertage');
    return snapshot;
  }
  function selectRows(snapshot, days) {
    assert([1, 7, 30].includes(days), 'Ungültiger Zeitraum');
    const dates = [...new Set(snapshot.rows.map((row) => dayKey(row[0])))];
    const firstDay = dates[dates.length - days];
    return snapshot.rows.filter((row) => dayKey(row[0]) >= firstDay);
  }
  // Integrate average GW over interval duration. Valid snapshots have one-hour intervals,
  // including the 23/25-hour Berlin days; never average daily averages or hourly shares.
  function summarizeRows(rows, end) {
    assert(rows.length > 0, 'Leerer Zeitraum');
    const energy = Array(13).fill(0);
    let hours = 0;
    let negativeHours = 0;
    rows.forEach((row, index) => {
      const duration = ((rows[index + 1] ? rows[index + 1][0] : end) - row[0]) / HOUR;
      assert(duration > 0, 'Ungültige Intervalldauer');
      hours += duration;
      row.slice(1).forEach((value, column) => { energy[column] += value * duration; });
      if (row[13] < 0) negativeHours += duration;
    });
    const generationEnergy = energy.slice(0, 11).reduce((sum, value) => sum + value, 0);
    const renewableEnergy = SOURCES.filter((source) => source.renewable).reduce((sum, source) => sum + energy[source.index - 1], 0);
    const mix = SOURCES.map((source) => ({ ...source, energy: energy[source.index - 1],
      average: energy[source.index - 1] / hours,
      share: generationEnergy ? energy[source.index - 1] / generationEnergy * 100 : null }));
    return { rows, hours, mix, generationEnergy, generationAverage: generationEnergy / hours,
      renewableShare: generationEnergy ? renewableEnergy / generationEnergy * 100 : null,
      loadEnergy: energy[11], loadAverage: energy[11] / hours, priceAverage: energy[12] / hours,
      priceMin: Math.min(...rows.map((row) => row[13])), priceMax: Math.max(...rows.map((row) => row[13])),
      loadMin: Math.min(...rows.map((row) => row[12])), loadMax: Math.max(...rows.map((row) => row[12])),
      negativeHours, start: rows[0][0], end,
      // data_through is exclusive: label the final observation day, not tomorrow.
      label: dayKey(rows[0][0]) === dayKey(end - 1) ? dateFormatter.format(end - 1)
        : `${dateFormatter.format(rows[0][0])} – ${dateFormatter.format(end - 1)}` };
  }
  function summarize(snapshot, days = 1) {
    return summarizeRows(selectRows(snapshot, days), Date.parse(snapshot.window_end));
  }
  function presentation(summary) {
    const n = number;
    return {
      label: summary.label,
      generation: n(summary.generationAverage), energy: n(summary.generationEnergy),
      renewable: n(summary.renewableShare), load: n(summary.loadAverage), price: n(summary.priceAverage, 2),
      hours: n(summary.hours, 0), negative: n(summary.negativeHours, 0),
      generationText: `In ${n(summary.hours, 0)} Stunden wurden ${n(summary.generationEnergy)} GWh ins öffentliche Netz eingespeist. Erneuerbare lieferten ${n(summary.renewableShare)} % der erfassten Erzeugung einschließlich Pumpspeichern.`,
      loadText: `Die Netzlast lag zwischen ${n(summary.loadMin)} und ${n(summary.loadMax)} GW; im Mittel bei ${n(summary.loadAverage)} GW (${n(summary.loadEnergy)} GWh).`,
      priceText: `Die Stundenmittel des DE–LU-Day-Ahead-Preises lagen zwischen ${n(summary.priceMin, 2)} und ${n(summary.priceMax, 2)} €/MWh. ${n(summary.negativeHours, 0)} Stunden hatten ein negatives Stundenmittel; das zeitgewichtete Mittel beträgt ${n(summary.priceAverage, 2)} €/MWh.`,
    };
  }
  return { HOUR, TIMEZONE, SOURCES, COLUMNS, SOURCE, dayKey, number, freshness, validateSnapshot,
    selectRows, summarizeRows, summarize, presentation, dateLabel: (time) => dateFormatter.format(time),
    timestampLabel: (time) => timestampFormatter.format(time) };
});
