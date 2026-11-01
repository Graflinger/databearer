// /llms.txt (https://llmstxt.org): a Markdown index of the public, indexable pages for
// LLM-based tools. Built only from published content data, never from build time.
// It lists pages; it does not replace them. Article text stays in the linked HTML.
const { indexable, isoDate, absoluteUrl, topicNames } = require('./seo');
const { searchText } = require('../lib/search-text');

// Plain one-line text for link labels and notes; brackets would break Markdown links.
const text = (value) => searchText(String(value ?? '')).replace(/([[\]])/g, '\\$1');
// Absolute, percent-encoded URL; parentheses would end the Markdown link target.
const link = (url, site) => absoluteUrl(url, site.url).replace(/\(/g, '%28').replace(/\)/g, '%29');
const day = (value) => isoDate(value)?.slice(0, 10);
const entry = (label, url, site, note) => `- [${text(label)}](${link(url, site)})${note ? `: ${note}` : ''}`;

function postNote(data) {
  const parts = [`veröffentlicht ${day(data.date)}`];
  const updated = data.lastUpdated && day(data.lastUpdated);
  if (updated && updated !== day(data.date)) parts.push(`aktualisiert ${updated}`);
  const topics = (Array.isArray(data.topic) ? data.topic : data.topic ? [data.topic] : [])
    .map((topic) => topicNames[topic]).filter(Boolean);
  if (topics.length) parts.push(`${topics.length > 1 ? 'Themen' : 'Thema'}: ${topics.join(', ')}`);
  const summary = text(data.excerpt || data.description || '');
  return `${summary}${summary ? ' ' : ''}(${parts.join('; ')})`;
}

function llmsText({ site, collections = {} }) {
  const time = (item) => new Date(item.data.date).getTime() || 0;
  const posts = (collections.post || []).filter(indexable).sort((a, b) => time(b) - time(a) || a.url.localeCompare(b.url));
  const dashboards = (collections.dashboard || []).filter(indexable);
  const all = (collections.all || []).filter(indexable);
  const page = (url) => all.find((item) => item.url === url);
  const topics = Object.entries(topicNames).map(([slug, label]) => [label, page(`/themen/${slug}/`)]).filter(([, item]) => item);
  const about = page(site.authorUrl || '/about/');
  const overview = page('/dashboards/');

  const lines = [
    `# ${site.name}`,
    '',
    `> ${text(site.description)}.`,
    '',
    `Deutschsprachiger Datenjournalismus von ${site.author}: Analysen mit Diagrammen und Quellenangaben ` +
      'sowie interaktive Dashboards zu Energie, Politik und Wirtschaft in Deutschland. ' +
      'Diese Datei verweist nur auf öffentliche, indexierbare Seiten. Zahlen, Datenstand und Methodik stehen auf der ' +
      'jeweils verlinkten Seite; bitte diese Seite mit ihrem Datum zitieren. ' +
      `Code und Datenpipeline sind öffentlich: ${site.github}`,
  ];
  if (posts.length) {
    lines.push('', '## Artikel', '', ...posts.map((item) => entry(item.data.title, item.url, site, postNote(item.data))));
  }
  if (dashboards.length) {
    lines.push('', '## Dashboards', '', ...dashboards.map((item) => {
      const summary = text(item.data.dashboardSummary || item.data.description || '');
      const cadence = text(item.data.dashboardCadence || '');
      return entry(item.data.title, item.url, site, `${summary}${summary && cadence ? ' ' : ''}${cadence ? `(${cadence})` : ''}`);
    }));
  }
  if (topics.length) {
    lines.push('', '## Themen', '', ...topics.map(([label, item]) => entry(label, item.url, site, text(item.data.description || ''))));
  }
  const optional = [
    about && entry(about.data.title || 'Über mich', about.url, site, `Autor und Hintergrund von ${text(site.name)}`),
    overview && entry(overview.data.title || 'Dashboards', overview.url, site, text(overview.data.description || '')),
    entry('JSON Feed', '/feed.json', site, 'alle Artikel mit Volltext (JSON Feed 1.1)'),
    entry('Atom-Feed', '/feed.xml', site, 'die 20 neuesten Artikel'),
    entry('Sitemap', '/sitemap.xml', site, 'alle indexierbaren Seiten'),
  ].filter(Boolean);
  lines.push('', '## Optional', '', ...optional);
  return `${lines.join('\n')}\n`;
}

class LlmsTxt {
  data() {
    return {
      permalink: '/llms.txt',
      excludeFromSitemap: true,
      eleventyExcludeFromCollections: true,
      eleventyImport: { collections: ['post', 'dashboard'] },
    };
  }

  render({ site, collections }) {
    return llmsText({ site, collections });
  }
}

module.exports = LlmsTxt;
module.exports.llmsText = llmsText;
