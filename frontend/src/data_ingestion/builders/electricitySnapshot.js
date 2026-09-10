const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const electricity = require('../../js/dashboards/electricity-data');

const SNAPSHOT_PATH = path.resolve(__dirname, '../../_data/germanElectricity.json');

/**
 * Verify the producer's compact, sorted-key JSON without reserializing numbers.
 * Python spells e.g. 0.0, -0.0 and 1e-07 differently from JSON.stringify.
 * JSON.parse validates grammar; the small token walk preserves every numeric byte,
 * canonicalizes keys/strings, rejects duplicate keys and checks the wire encoding.
 * Only the two operational root fields are omitted from the SHA-256 preimage.
 */
function verifySnapshot(raw, now = Date.now()) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 1000000) {
    throw new Error('Stromdaten: Ungültige Snapshot-Datei');
  }
  const snapshot = JSON.parse(raw);
  electricity.validateSnapshot(snapshot, now);
  const tokens = raw.match(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]/g);
  let index = 0;
  let semantic;
  function consume(expected) {
    if (tokens[index++] !== expected) throw new Error('Stromdaten: Ungültige JSON-Struktur');
  }
  function value(root = false) {
    const token = tokens[index++];
    if (token === '{') {
      const entries = new Map();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]);
        if (entries.has(key)) throw new Error('Stromdaten: Doppelter JSON-Schlüssel');
        consume(':');
        entries.set(key, value());
        if (tokens[index] !== ',') break;
        consume(',');
      }
      consume('}');
      const keys = [...entries.keys()].sort();
      const encode = (selected) => `{${selected.map((key) => `${JSON.stringify(key)}:${entries.get(key)}`).join(',')}}`;
      if (root) semantic = encode(keys.filter((key) => !['content_hash', 'snapshot_created_at'].includes(key)));
      return encode(keys);
    }
    if (token === '[') {
      const items = [];
      while (tokens[index] !== ']') {
        items.push(value());
        if (tokens[index] !== ',') break;
        consume(',');
      }
      consume(']');
      return `[${items.join(',')}]`;
    }
    return token.startsWith('"') ? JSON.stringify(JSON.parse(token)) : token;
  }
  const canonical = value(true);
  if (index !== tokens.length || raw !== `${canonical}\n`) {
    throw new Error('Stromdaten: Snapshot muss kompaktes JSON mit sortierten Schlüsseln und abschließendem Zeilenumbruch sein');
  }
  const actualHash = createHash('sha256').update(semantic, 'utf8').digest('hex');
  if (actualHash !== snapshot.content_hash) throw new Error('Stromdaten: content_hash stimmt nicht mit dem Dateiinhalt überein');
  return snapshot;
}

function validateBuildSnapshot(snapshot) {
  // Read on every render: watch builds must not reuse an earlier verified artifact.
  const verified = verifySnapshot(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  if (!isDeepStrictEqual(snapshot, verified)) {
    throw new Error('Stromdaten: Eleventy-Daten stimmen nicht mit der geprüften Snapshot-Datei überein');
  }
  return verified;
}

module.exports = { verifySnapshot, validateBuildSnapshot };
