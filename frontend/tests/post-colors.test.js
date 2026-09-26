// Colours are checked through the real cascade (origin, specificity, source
// order, media queries and custom properties) on fixture markup that mirrors the
// templates, because jsdom's getComputedStyle applies rules in source order only.
const { createCascade, compileSiteCss, contrastRatio, toHex } = require('./helpers/css-cascade');

const cascade = createCascade(compileSiteCss());
const themes = ['light', 'dark'];
const states = ['', 'hover', 'focus', 'focus-visible', 'active'];
const AA = 4.5;

function render(html, classes = 'js nav-enhanced') {
  document.documentElement.className = classes;
  document.body.innerHTML = html;
}
const $ = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Fixture element missing: ${selector}`);
  return element;
};
const colour = (element, theme, property = 'color') => toHex(cascade.color(element, property, { theme }));
function force(element, state) {
  for (const name of ['hover', 'focus', 'focus-visible', 'active']) element.removeAttribute(`data-${name}`);
  if (state) element.setAttribute(`data-${state}`, '');
}

const archive = `
  <main class="site-main"><div class="container"><section class="blog-grid">
    <div class="grid"><a href="/p/" class="blog-card-link"><article class="blog-card blog-card-horizontal">
      <div class="blog-card-content"><h2>Titel</h2><p class="post-excerpt">Auszug</p><p class="post-date">1. Januar 2026</p></div>
    </article></a></div>
    <nav class="pagination">
      <a href="/" class="pagination-link" id="newer">← Neuere Beiträge</a>
      <span class="pagination-info">Seite 2 von 3</span>
      <a href="/3/" class="pagination-link" id="older">Ältere Beiträge →</a>
    </nav>
  </section></div></main>`;

describe('post text colours', () => {
  beforeEach(() => render(`<main class="site-main"><div class="container"><article class="post-content">
    <h1>H1</h1><h2>H2</h2><h3>H3</h3><p id="paragraph">Text</p>
    <ul><li id="item">Item<p id="nested">Nested</p></li></ul><ol><li>Ordered</li></ol>
  </article></div></main>`));

  test.each(themes)('paragraphs and nested lists inherit the article text colour (%s)', (theme) => {
    const text = theme === 'light' ? '#374151' : '#e0e0e0';
    expect(cascade.computed($('.post-content'), '--post-text', { theme })).toBe(text);
    for (const selector of ['#paragraph', 'ul', 'ol', '#item', '#nested']) {
      expect(colour($(selector), theme)).toBe(text);
      expect(cascade.winner($(selector), 'color', { theme })?.value ?? 'inherit').toMatch(/inherit|var\(--post-text\)/);
    }
  });

  test.each(themes)('headings keep their own colour and wrap long compound words (%s)', (theme) => {
    for (const heading of ['h1', 'h2', 'h3']) {
      expect(colour($(heading), theme)).toBe(theme === 'light' ? '#1a1a1a' : '#e0e0e0');
      expect(cascade.computed($(heading), 'overflow-wrap', { theme })).toBe('anywhere');
    }
  });
});

describe('pagination on archive pages', () => {
  beforeEach(() => render(archive));

  // Regression: `.blog-grid a { color: inherit }` (0,1,1) used to beat
  // `.pagination-link` (0,1,0), leaving #e0e0e0 on gold (1.34:1) in dark mode.
  test.each(themes)('dark text on gold wins the cascade in every state (%s)', (theme) => {
    for (const link of [$('#newer'), $('#older')]) {
      for (const state of states) {
        force(link, state);
        expect(colour(link, theme)).toBe('#1a1a1a');
        expect(['#d9c176', '#c4ad61']).toContain(colour(link, theme, 'background-color'));
        expect(cascade.contrast(link, { theme })).toBeGreaterThanOrEqual(AA);
      }
      force(link, '');
      expect(cascade.winner(link, 'color', { theme }).selector).toMatch(/pagination-link/);
      expect(cascade.decorationLines(link, { theme })).toEqual([]);
    }
  });

  test.each(themes)('the keyboard focus ring stays visible against the page (%s)', (theme) => {
    const link = $('#older');
    force(link, 'focus-visible');
    expect(cascade.computed(link, 'outline-style', { theme })).toBe('solid');
    const ring = cascade.color(link, 'outline-color', { theme });
    const page = cascade.background($('.pagination'), { theme });
    expect(contrastRatio(ring, page)).toBeGreaterThanOrEqual(3);
  });
});

describe('gold controls keep dark foregrounds', () => {
  beforeEach(() => render(`${archive}
    <form id="search-form"><div class="search-box"><input id="search-input"><button id="search-button">Suchen</button></div></form>
    <div class="error-404"><div class="error-404-content"><div class="error-404-actions">
      <a href="/" class="error-404-button primary">Zur Startseite</a>
      <a href="/" class="error-404-button secondary">Alle Beiträge</a>
    </div></div></div>
    <a class="skip-link" href="#main-content">Zum Inhalt</a>`));

  test.each(themes)('in all interaction states (%s)', (theme) => {
    for (const selector of ['.pagination-link', '#search-button', '.error-404-button.primary', '.skip-link']) {
      for (const state of states) {
        force($(selector), state);
        expect(colour($(selector), theme)).toBe('#1a1a1a');
        expect(['#c4ad61', '#d9c176']).toContain(colour($(selector), theme, 'background-color'));
        expect(cascade.contrast($(selector), { theme })).toBeGreaterThanOrEqual(AA);
      }
    }
    const secondary = $('.error-404-button.secondary');
    expect(cascade.contrast(secondary, { theme })).toBeGreaterThanOrEqual(AA);
    force(secondary, 'hover');
    expect(colour(secondary, theme)).toBe('#1a1a1a');
    expect(colour(secondary, theme, 'background-color')).toBe('#c4ad61');
  });
});

// Every text colour checked here sits on the background the page actually paints
// behind it, in both colour schemes.
describe('text and link contrast (WCAG AA 4.5:1)', () => {
  const fixture = `
    <header class="site-header"><div class="container"><button class="topics-menu-toggle">Menü</button></div></header>
    <nav class="topics-nav"><div class="container"><ul class="topics-menu">
      <li><a href="/" id="nav-link">Alle Posts</a></li><li><a href="/suche/" aria-current="page" id="nav-current">Suche</a></li>
    </ul></div></nav>
    <main class="site-main"><div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb"><ol>
        <li><a href="/" id="crumb">Home</a></li><li><a href="/themen/energie/" id="crumb-topic">Energie</a></li>
        <li aria-current="page" id="crumb-current">Titel</li>
      </ol></nav>
      <article class="post-content">
        <p>Text mit <a href="/x/" id="prose">Link</a></p>
        <div class="post-meta"><span class="post-author">Von <a href="/about/" rel="author" id="author">Autor</a></span>
          <time class="post-published">Veröffentlicht</time><time class="post-updated" id="updated">Aktualisiert</time></div>
        <p class="post-topics"><a href="/themen/energie/" class="post-topic-link" id="tag">Energie</a></p>
        <div class="chart-section"><p class="chart-description" id="chart-description">Beschreibung</p>
          <div class="chart-sources"><strong>Quelle:</strong> <a href="https://example.org" id="source">Herausgeber</a></div>
        </div>
      </article>
      <section class="related-posts"><div class="container"><div class="related-posts-grid">
        <a href="/r/" class="blog-card-link"><article class="blog-card blog-card-horizontal"><div class="blog-card-content">
          <h2 id="related-title">Verwandt</h2><p class="post-excerpt" id="related-excerpt">Auszug</p><p class="post-date" id="related-date">Datum</p>
        </div></article></a>
      </div></div></section>
      <div class="error-404"><div class="error-404-content"><h1 class="error-404-title" id="error-title">404</h1>
        <div class="error-404-suggestions"><h3>Vielleicht auch interessant:</h3>
          <ul><li><a href="/themen/energie/" id="suggestion">Energie</a></li></ul></div>
      </div></div>
      <div class="search-container"><p class="search-fallback">Direkt entdecken: <a href="/themen/energie/" id="fallback">Energie</a></p></div>
    </div></main>
    <footer class="site-footer"><div class="container"><nav class="footer-nav"><ul><li><a href="/impressum/" id="footer-link">Impressum</a></li></ul></nav>
      <p class="copyright" id="copyright">© Databearer <a href="https://github.com" class="github-link" id="github">GitHub</a></p></div></footer>`;
  beforeEach(() => render(fixture));

  const elements = ['#nav-link', '#nav-current', '#crumb', '#crumb-topic', '#crumb-current', '#prose', '#author',
    '#updated', '#tag', '#chart-description', '#source', '#related-title', '#related-excerpt', '#related-date',
    '#suggestion', '#fallback', '#footer-link', '#copyright', '#github', '#error-title'];

  test.each(themes)('all checked elements reach AA (%s)', (theme) => {
    const failures = elements.map((selector) => [selector, cascade.contrast($(selector), { theme })])
      .filter(([, ratio]) => ratio < AA).map(([selector, ratio]) => `${selector} ${ratio.toFixed(2)}:1`);
    expect(failures).toEqual([]);
  });

  test.each(themes)('breadcrumb, 404 suggestion and topic links use the accessible link colour (%s)', (theme) => {
    const link = theme === 'light' ? '#705815' : '#d9c176';
    expect(cascade.computed(document.documentElement, '--prose-link', { theme })).toBe(link);
    for (const selector of ['#crumb', '#crumb-topic', '#suggestion', '#tag', '#prose', '#source', '#fallback']) {
      expect(colour($(selector), theme)).toBe(link);
    }
  });

  test('breadcrumb and 404 suggestion links were the failing 2.21:1 gold on white', () => {
    // Guard against a return to the brand gold for text on light backgrounds.
    for (const selector of ['#crumb', '#suggestion']) {
      expect(colour($(selector), 'light')).not.toBe('#c4ad61');
      expect(cascade.contrast($(selector), { theme: 'light' })).toBeGreaterThan(6.5);
    }
  });
});
