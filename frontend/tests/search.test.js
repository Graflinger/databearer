const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');
const seo = require('../src/seo');

const flushPromises = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};
const entry = (title, extra = {}) => ({
  title, excerpt: 'Kurz', content: '', topic: ['energie'], url: '/post/',
  date: '2024-01-15', image: '/images/test.png', ...extra,
});
const template = (name) => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const body = (source) => source.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('search', () => {
  let resolveIndex;
  let input;
  let results;
  let status;

  function setup(query = '') {
    window.history.replaceState({}, '', `/suche/${query}`);
    document.body.innerHTML = body(template('suche.njk'));
    input = document.getElementById('search-input');
    results = document.getElementById('search-results');
    status = document.getElementById('search-status');
    global.fetch = jest.fn(() => new Promise((resolve) => { resolveIndex = resolve; }));
    jest.resetModules();
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    require('../src/js/search');
  }

  async function load(data = []) {
    resolveIndex({ ok: true, json: async () => data });
    await flushPromises();
  }

  function submit(query) {
    input.value = query;
    document.getElementById('search-form').dispatchEvent(new Event('submit', { cancelable: true }));
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.history.replaceState({}, '', '/');
    delete global.fetch;
  });

  it('waits for a delayed index before running the initial URL query', async () => {
    setup('?q=energie');
    expect(status.textContent).toContain('geladen');
    expect(results.getAttribute('aria-busy')).toBe('true');
    expect(results.textContent).not.toContain('Keine Ergebnisse');
    await load([entry('Energiepreise steigen')]);
    expect(results.innerHTML).toContain('<mark class="search-highlight">Energie</mark>preise');
    expect(status.textContent).toBe('1 Ergebnis gefunden');
    expect(results.getAttribute('aria-busy')).toBe('false');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not render an old query when input changes during loading/debounce', async () => {
    setup('?q=alte');
    input.value = 'neue';
    input.dispatchEvent(new Event('input'));
    await load([entry('Alte Daten'), entry('Neue Daten')]);
    expect(results.textContent).toBe('');
    jest.advanceTimersByTime(300);
    await flushPromises();
    expect(results.textContent).toContain('Neue Daten');
    expect(results.textContent).not.toContain('Alte Daten');
  });

  it('keeps only the latest submitted query while the index is pending', async () => {
    setup('?q=alte');
    submit('neue');
    await load([entry('Alte Daten'), entry('Neue Daten')]);
    expect(results.textContent).toContain('Neue Daten');
    expect(results.textContent).not.toContain('Alte Daten');
  });

  it('clearing input invalidates a pending initial search', async () => {
    setup('?q=energie');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await load([entry('Energie')]);
    jest.advanceTimersByTime(300);
    await flushPromises();
    expect(status.textContent).toContain('mindestens 2 Zeichen');
    expect(results.textContent).toBe('');
    expect(results.getAttribute('aria-busy')).toBe('false');
  });

  it.each(['http', 'json', 'shape'])('reports %s index failure separately from no matches', async (failure) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    setup('?q=energie');
    resolveIndex({
      ok: failure !== 'http', status: 503,
      json: async () => {
        if (failure === 'json') throw new Error('Invalid JSON');
        return {};
      },
    });
    await flushPromises();
    expect(status.textContent).toContain('nicht verfügbar');
    expect(results.textContent).not.toContain('Keine Ergebnisse');
    expect(results.getAttribute('aria-busy')).toBe('false');
    expect(document.querySelector('a[href="/themen/energie/"]')).not.toBeNull();
  });

  it('escapes query HTML in the no-results view', async () => {
    setup();
    await load([]);
    submit('<script>');
    await flushPromises();
    expect(status.textContent).toBe('Keine Ergebnisse gefunden.');
    expect(results.innerHTML).toContain('&lt;script&gt;');
    expect(results.querySelector('script')).toBeNull();
  });

  it('renders dashboard results without a fictitious date and safely highlights special characters', async () => {
    setup();
    await load([entry('Strom & Energie', { date: null, excerpt: 'A & B', url: '/dashboards/strom/' })]);
    submit('& Energie');
    await flushPromises();
    expect(results.querySelector('mark').textContent).toBe('& Energie');
    expect(results.querySelector('a').getAttribute('href')).toBe('/dashboards/strom/');
    expect(results.querySelector('.post-date')).toBeNull();
  });

  it('provides a label, live status, topic fallback and no nested main', () => {
    setup();
    expect(document.querySelector('label').htmlFor).toBe(input.id);
    expect(status.getAttribute('role')).toBe('status');
    expect(document.querySelector('noscript').textContent).toContain('JavaScript');
    expect(document.querySelector('main')).toBeNull();
    expect(template('suche.njk')).toMatch(/noindex: true/);
    expect(template('suche.njk')).toMatch(/excludeFromSitemap: true/);
  });
});

describe('search index template', () => {
  it('includes public posts and dashboards, excludes drafts and handles optional metadata', () => {
    const env = new nunjucks.Environment(null, { autoescape: true });
    env.addFilter('htmlDateString', (date) => new Date(date).toISOString());
    env.addFilter('published', seo.published);
    const item = (title, extra = {}) => ({
      url: `/${title}/`, templateContent: '<p>Content</p>',
      data: { title, ...extra },
    });
    const index = JSON.parse(env.renderString(body(template('search.json.njk')), {
      collections: {
        post: [item('Post'), item('Draft', { draft: true }), item('Hidden', { noindex: true }),
          item('Unpublished', { permalink: false }), item('Excluded', { eleventyExcludeFromCollections: true })],
        dashboard: [item('Dashboard', { dashboardSummary: 'Strommix', dashboardTopic: 'Energie', dashboardImage: '/chart.svg' }),
          item('Draft dashboard', { draft: true })],
      },
    }));
    expect(index.map((item) => item.title)).toEqual(['Dashboard', 'Post']);
    expect(index[0]).toMatchObject({ excerpt: 'Strommix', image: '/chart.svg', topic: ['Energie'], date: null });
    expect(index[1].content).toBe('Content');
    expect(template('search.json.njk')).toMatch(/excludeFromSitemap: true/);
    expect(template('search.json.njk')).toMatch(/eleventyExcludeFromCollections: true/);
    expect(JSON.parse(env.renderString(body(template('search.json.njk')), { collections: {} }))).toEqual([]);
  });

  it('excludes only boolean false permalinks, not missing or empty implicit values', () => {
    const env = new nunjucks.Environment(null, { autoescape: true });
    env.addFilter('published', seo.published);
    env.addFilter('htmlDateString', seo.isoDate);
    const items = [undefined, '', false, '/explicit/'].map((permalink, index) => ({
      url: `/post-${index}/`, data: { title: `Post ${index}`, permalink }, templateContent: 'Content',
    }));
    const index = JSON.parse(env.renderString(body(template('search.json.njk')), { collections: { post: items } }));
    expect(index.map((item) => item.url).sort()).toEqual(['/post-0/', '/post-1/', '/post-3/']);
  });
});
