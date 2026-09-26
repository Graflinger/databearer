// Plain-text extraction for the build-time search index (src/search.11ty.js).
// Lives outside src/ so Eleventy never treats it as a template or passthrough copy.

// Elements whose contents are never visible article text: scripts (such as
// Datawrapper embed loaders), styles, no-JS fallbacks and embedded documents.
const HIDDEN_ELEMENTS = ['script', 'style', 'noscript', 'iframe', 'template'];

// Attribute values may be quoted and contain `>`.
const ATTRIBUTES = `(?:[^>"']|"[^"]*"|'[^']*')*`;
// One left-to-right pass, so whichever construct starts first wins, as in the
// HTML tokenizer: a `<!--` inside a script string cannot swallow later text,
// and a commented-out `<script>` is removed with its comment. Alternatives:
// comment | hidden element with its contents (group 1) | tag (group 2) |
// doctype/processing instruction | truncated trailing tag.
const TOKEN = new RegExp([
  '<!--[\\s\\S]*?(?:-->|$)',
  `<(${HIDDEN_ELEMENTS.join('|')})\\b${ATTRIBUTES}>[\\s\\S]*?(?:<\\/\\1(?:\\s[^>]*)?>|$)`,
  `<\\/?([a-zA-Z][a-zA-Z0-9:-]*)\\b${ATTRIBUTES}>`,
  '<[!?][^>]*>',
  '<\\/?[a-zA-Z][^>]*$',
].join('|'), 'gi');

// Tags whose boundaries separate words, so adjacent cells or paragraphs do not
// merge; inline tags (a, strong, sup, ...) are removed without a space.
const BLOCK_TAGS = new Set(('address article aside blockquote br caption dd details dialog div dl dt '
  + 'fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr img legend li main nav ol '
  + 'option p picture pre section summary table tbody td tfoot th thead tr ul').split(' '));

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', shy: '\u00ad',
  ndash: '–', mdash: '—', minus: '−', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', ccedil: 'ç',
  euro: '€', pound: '£', cent: '¢', yen: '¥', copy: '©', reg: '®', trade: '™', sect: '§',
  para: '¶', deg: '°', plusmn: '±', times: '×', divide: '÷', sup2: '²', sup3: '³',
  frac12: '½', frac14: '¼', frac34: '¾', permil: '‰', micro: 'µ',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', larr: '←', rarr: '→', uarr: '↑', darr: '↓',
  thinsp: '\u2009', ensp: '\u2002', emsp: '\u2003',
};

function codePoint(value) {
  const code = Number(value);
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return '\ufffd';
  }
  return String.fromCodePoint(code);
}

// Single pass, so `&amp;lt;` becomes the literal text `&lt;`, never `<`.
// Unknown named references are kept as written.
function decodeEntities(text) {
  return String(text).replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g,
    (match, decimal, hex, name) => {
      if (decimal) return codePoint(decimal);
      if (hex) return codePoint(parseInt(hex, 16));
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : match;
    });
}

// Visible text of an HTML fragment (or plain text) for matching and snippets.
// Markup is removed before entities are decoded, so escaped text such as
// `&lt;b&gt;` stays literal text instead of being stripped as a tag.
function searchText(html) {
  if (html === undefined || html === null) return '';
  const text = String(html).replace(TOKEN, (match, hidden, tag) =>
    (tag && !BLOCK_TAGS.has(tag.toLowerCase()) ? '' : ' '));
  return decodeEntities(text)
    // Soft hyphens and zero-width characters must not split words.
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { searchText, decodeEntities, HIDDEN_ELEMENTS };
