// Underlines belong to links in running text only. Whole-card links, topic tags,
// navigation and dashboard cards are identified by their layout; an inherited
// underline there would run through titles, excerpts and dates.
const fs = require('fs');
const path = require('path');
const { createCascade, compileSiteCss } = require('./helpers/css-cascade');

const css = compileSiteCss();
const cascade = createCascade(css);
const themes = ['light', 'dark'];

function render(html) {
  document.documentElement.className = 'js nav-enhanced';
  document.body.innerHTML = html;
}
const all = (selector) => {
  const elements = [...document.querySelectorAll(selector)];
  if (!elements.length) throw new Error(`Fixture element missing: ${selector}`);
  return elements;
};
const lines = (element, theme = 'light', width = 1280) => cascade.decorationLines(element, { theme, width });
const underlined = (element, theme, width) => lines(element, theme, width).includes('underline');

const card = (id) => `<a href="/${id}/" class="blog-card-link" id="${id}">
  <article class="blog-card blog-card-horizontal">
    <div class="blog-card-image-small"><picture><img src="/x.png" alt=""></picture></div>
    <div class="blog-card-content"><h2>Titel ${id}</h2><p class="post-excerpt">Auszug</p><p class="post-date">Datum</p></div>
  </article></a>`;

// post.njk: the related posts section is a sibling of article.post-content.
const postPage = `
  <main class="site-main"><div class="container">
    <nav class="breadcrumb"><ol><li><a href="/" class="crumb">Home</a></li><li aria-current="page">Titel</li></ol></nav>
    <article class="post-content">
      <h1>Titel</h1>
      <div class="post-meta"><span class="post-author">Von <a href="/about/" rel="author" class="prose">Autor</a></span></div>
      <p class="post-topics">
        <a href="/themen/energie/" class="post-topic-link">
          Energie
        </a>
        <a href="/themen/wirtschaft/" class="post-topic-link">
          Wirtschaft
        </a>
      </p>
      <p>Absatz mit <a href="/a/" class="prose">Link</a> und <strong><a href="/b/" class="prose">fett</a></strong>.</p>
      <ul><li><a href="/c/" class="prose">Listenlink</a></li></ul>
      <blockquote><p><a href="/d/" class="prose">Zitat</a></p></blockquote>
      <dl><dt><a href="/e/" class="prose">Begriff</a></dt><dd><a href="/f/" class="prose">Definition</a></dd></dl>
      <figure><img src="/x.png" alt=""><figcaption><a href="/g/" class="prose">Bildquelle</a></figcaption></figure>
      <div class="chart-section">
        <p class="chart-description"><a href="/h/" class="prose">Beschreibung</a></p>
        <div class="table-scroll"><table><caption><a href="/i/" class="prose">Tabellenquelle</a></caption>
          <thead><tr><th scope="col"><a href="/j/" class="prose">Spalte</a></th></tr></thead>
          <tbody><tr><th scope="row">2024</th><td><a href="/k/" class="prose">1</a></td></tr></tbody></table></div>
        <div class="chart-sources"><strong>Quelle:</strong> <a href="https://example.org" class="prose">Herausgeber</a>
          <ul><li><a href="https://example.org/2" class="prose">Weitere Quelle</a></li></ul></div>
      </div>
    </article>
    <section class="related-posts"><div class="container"><h2 class="related-posts-title">Verwandte Beiträge</h2>
      <div class="related-posts-grid">${card('related')}</div></div></section>
  </div></main>`;

describe('prose links', () => {
  beforeEach(() => render(postPage));

  test.each(themes)('are underlined in running text, captions, tables and chart sources (%s)', (theme) => {
    for (const link of all('.prose')) {
      expect(underlined(link, theme)).toBe(true);
      expect(cascade.computed(link, 'text-underline-offset', { theme })).toBe('0.15em');
    }
  });

  test('supporting pages (article.post-content from Markdown) underline their links too', () => {
    render('<main class="site-main"><div class="container"><article class="post-content"><h1>Impressum</h1>'
      + '<p>E-Mail: <a href="mailto:info@example.org" id="mail">info@example.org</a></p>'
      + '<table><thead><tr><th>Anschrift</th><th></th></tr></thead><tbody><tr><td>Name</td><td><a href="/x/" id="cell">X</a></td></tr></tbody></table>'
      + '</article></div></main>');
    expect(underlined(document.getElementById('mail'))).toBe(true);
    expect(underlined(document.getElementById('cell'))).toBe(true);
  });

  test('the search page fallback links are underlined inside their sentence', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/suche.njk'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
    render(`<main class="site-main"><div class="container">${source}</div></main>`);
    const links = all('.search-fallback a');
    expect(links).toHaveLength(4);
    for (const link of links) expect(underlined(link)).toBe(true);
  });
});

describe('links that are not prose are never underlined', () => {
  test.each(themes)('related post cards outside the article, including title, excerpt and date (%s)', (theme) => {
    render(postPage);
    const link = document.getElementById('related');
    for (const element of [link, ...link.querySelectorAll('h2, p')]) {
      expect(lines(element, theme)).toEqual([]);
    }
    expect(cascade.computed(link, 'display', { theme })).toBe('block');
    // Card text keeps its own colours instead of the link colour.
    expect(cascade.computed(link.querySelector('h2'), 'color', { theme })).toBe(theme === 'light' ? '#333' : '#e0e0e0');
  });

  test.each(themes)('archive and search result cards (%s)', (theme) => {
    render(`<main class="site-main"><div class="container">
      <section class="blog-grid"><div class="grid">${card('archive')}</div></section>
      <div id="search-results"><div class="search-results-grid">${card('result')}</div></div>
    </div></main>`);
    for (const id of ['archive', 'result']) {
      const link = document.getElementById(id);
      for (const element of [link, ...link.querySelectorAll('h2, p')]) expect(lines(element, theme)).toEqual([]);
      expect(cascade.computed(link, 'display', { theme })).toBe('block');
    }
  });

  test.each(themes)('topic tags are separate pills, not one continuous underline (%s)', (theme) => {
    render(postPage);
    const tags = all('.post-topic-link');
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(lines(tag, theme)).toEqual([]);
      expect(cascade.computed(tag, 'display', { theme })).toBe('inline-block');
      expect(cascade.computed(tag, 'border-bottom-style', { theme })).toBe('solid');
      expect(cascade.computed(tag, 'padding-left', { theme })).not.toBe('0');
    }
    // Spacing comes from the flex gap, so whitespace inside the anchors is irrelevant.
    const list = document.querySelector('.post-topics');
    expect(cascade.computed(list, 'display', { theme })).toBe('flex');
    expect(cascade.computed(list, 'gap', { theme })).toBe('8px');
  });

  test.each(themes)('dashboard cards and the energy archive dashboard teaser (%s)', (theme) => {
    render(`<main class="site-main"><div class="container">
      <section class="dashboard-overview"><div class="dashboard-catalog"><article class="dashboard-card">
        <a class="dashboard-card-image" href="/dashboards/strom/" tabindex="-1" aria-hidden="true"><img src="/x.svg" alt=""></a>
        <div class="dashboard-card-content"><p class="electricity-eyebrow">Energie</p>
          <h2><a href="/dashboards/strom/" id="dashboard-title">Strom</a></h2><p>Zusammenfassung</p>
          <a class="dashboard-card-link" href="/dashboards/strom/">Dashboard öffnen <span aria-hidden="true">→</span></a>
        </div></article></div></section>
      <section class="blog-grid"><a class="electricity-discovery" href="/dashboards/strom/" id="teaser">
        <span>Dashboard / Deutschland</span><h2>Ein Tag im Stromnetz</h2><p>Strommix</p></a></section>
    </div></main>`);
    for (const link of all('.dashboard-card a, .electricity-discovery')) {
      expect(lines(link, theme)).toEqual([]);
    }
    for (const element of all('#teaser h2, #teaser p, #teaser span')) expect(lines(element, theme)).toEqual([]);
    const title = document.getElementById('dashboard-title');
    title.setAttribute('data-hover', '');
    expect(underlined(title, theme)).toBe(true);
  });

  test.each([['light', 1280], ['dark', 1280], ['light', 375]])('navigation, breadcrumbs, pagination, footer and 404 links (%s, %ipx)', (theme, width) => {
    render(`<header class="site-header"><div class="container"><div class="logo"><a href="/" id="logo"><img src="/l.png" alt="Logo"></a></div></div></header>
      <nav class="topics-nav"><div class="container"><ul class="topics-menu"><li><a href="/">Alle Posts</a></li></ul></div></nav>
      <main class="site-main"><div class="container">
        <nav class="breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Titel</li></ol></nav>
        <section class="blog-grid"><nav class="pagination"><a href="/2/" class="pagination-link">Ältere Beiträge →</a></nav></section>
        <div class="error-404"><div class="error-404-content"><div class="error-404-actions"><a href="/" class="error-404-button primary">Start</a></div>
          <div class="error-404-suggestions"><ul><li><a href="/themen/energie/">Energie</a></li></ul></div></div></div>
      </div></main>
      <footer class="site-footer"><div class="container"><nav class="footer-nav"><ul><li><a href="/impressum/">Impressum</a></li></ul></nav>
        <p class="copyright">© <a href="https://github.com" class="github-link">GitHub</a></p></div></footer>`);
    for (const link of all('a')) expect(lines(link, theme, width)).toEqual([]);
  });

  test('the electricity dashboard keeps its own explicitly underlined links', () => {
    render('<article class="electricity-dashboard"><p class="electricity-eyebrow"><a href="/dashboards/" id="eyebrow">Dashboards</a></p></article>');
    expect(underlined(document.getElementById('eyebrow'))).toBe(true);
  });
});

test('links default to the accessible link colour without underline, and the old duplicate rule is gone', () => {
  render('<main class="site-main"><div class="container"><div><a href="/x/" id="plain">Link</a></div></div></main>');
  const link = document.getElementById('plain');
  for (const theme of themes) {
    expect(lines(link, theme)).toEqual([]);
    expect(cascade.computed(link, 'color', { theme })).toBe(theme === 'light' ? '#705815' : '#d9c176');
  }
  // A blanket `.post-content a` rule would underline every link inside the article.
  expect(cascade.rules.filter((rule) => rule.origin === 'author' && rule.branches.some((branch) =>
    branch.selector.replace(/\s+/g, ' ') === '.post-content a'))).toEqual([]);
  expect(css).not.toMatch(/\.blog-grid a\s*[,{]/);
});

test('every compiled selector is understood by the cascade helper', () => {
  // Unsupported selectors would silently never match and weaken every cascade test.
  render('<main class="site-main"></main>');
  expect(cascade.unsupportedSelectors(document)).toEqual([]);
});
