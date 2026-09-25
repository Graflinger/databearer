const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const SearchIndex = require('../src/search.11ty');
const { searchText, decodeEntities } = require('../lib/search-text');

const flushPromises = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};
const THUMBNAIL = {
  src: '/assets/images/card-360.png',
  srcset: '/assets/images/card-360.png 360w, /assets/images/card-720.png 720w',
  webpSrcset: '/assets/images/card-360.webp 360w, /assets/images/card-720.webp 720w',
  sizes: '(max-width: 768px) 100vw, 300px',
  width: 360,
  height: 203,
};
const entry = (title, extra = {}) => ({
  title, excerpt: 'Kurz', content: '', topic: ['energie'], url: '/post/',
  date: '2024-01-15', thumbnail: THUMBNAIL, ...extra,
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

  it('renders prepared responsive thumbnails as a decorative <picture>', async () => {
    setup();
    await load([entry('Energie mit Bild')]);
    submit('energie');
    await flushPromises();
    const picture = results.querySelector('.blog-card-image-small > picture');
    expect(picture).not.toBeNull();
    const source = picture.querySelector('source');
    expect(source.getAttribute('type')).toBe('image/webp');
    expect(source.getAttribute('srcset')).toBe(THUMBNAIL.webpSrcset);
    expect(source.getAttribute('sizes')).toBe(THUMBNAIL.sizes);
    const img = picture.querySelector('img');
    expect(img.getAttribute('src')).toBe(THUMBNAIL.src);
    expect(img.getAttribute('srcset')).toBe(THUMBNAIL.srcset);
    expect(img.getAttribute('sizes')).toBe(THUMBNAIL.sizes);
    expect(img.getAttribute('width')).toBe('360');
    expect(img.getAttribute('height')).toBe('203');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it.each([
    ['null', null],
    ['missing', undefined],
    ['without src', { srcset: 'x.png 1w' }],
  ])('renders no image block, and no placeholder, for a %s thumbnail', async (label, thumbnail) => {
    setup();
    await load([entry('Energie ohne Bild', { thumbnail })]);
    submit('energie');
    await flushPromises();
    expect(results.querySelector('.blog-card-link')).not.toBeNull();
    expect(results.querySelector('.blog-card-image-small, picture, img')).toBeNull();
    expect(results.innerHTML).not.toContain('test_img');
  });

  it('escapes thumbnail attributes and skips invalid optional ones', async () => {
    setup();
    await load([entry('Energie', { thumbnail: { src: '/a.png" onerror="alert(1)', width: 'x', height: -1, sizes: '' } })]);
    submit('energie');
    await flushPromises();
    const img = results.querySelector('img');
    expect(img.getAttribute('src')).toBe('/a.png" onerror="alert(1)');
    expect(img.hasAttribute('onerror')).toBe(false);
    for (const name of ['width', 'height', 'sizes', 'srcset']) expect(img.hasAttribute(name)).toBe(false);
    expect(results.querySelector('source')).toBeNull();
  });

  it('announces "Suche läuft" only when the debounced search runs, not on every keystroke', async () => {
    setup();
    await load([entry('Energie'), entry('Wind', { url: '/wind/', topic: ['wirtschaft'] })]);
    submit('energie');
    await flushPromises();
    expect(status.textContent).toBe('1 Ergebnis gefunden');
    input.value = 'wi';
    input.dispatchEvent(new Event('input'));
    input.value = 'win';
    input.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(299);
    // Nothing changes during the debounce window: no status churn for screen readers.
    expect(status.textContent).toBe('1 Ergebnis gefunden');
    expect(results.getAttribute('aria-busy')).toBe('false');
    jest.advanceTimersByTime(1);
    expect(status.textContent).toBe('Suche läuft …');
    expect(results.getAttribute('aria-busy')).toBe('true');
    await flushPromises();
    expect(status.textContent).toBe('1 Ergebnis gefunden');
    expect(results.textContent).toContain('Wind');
    expect(results.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps ?q= in sync with replaceState, preserving other parameters and adding no history entries', async () => {
    setup('?q=alt&ref=nav#top');
    const push = jest.spyOn(window.history, 'pushState');
    const replace = jest.spyOn(window.history, 'replaceState');
    const length = window.history.length;
    await load([entry('Energie & Wind')]);
    input.value = 'Energie & Wind';
    input.dispatchEvent(new Event('input'));
    expect(window.location.search).toBe('?q=alt&ref=nav'); // unchanged during debounce
    jest.advanceTimersByTime(300);
    await flushPromises();
    expect(new URLSearchParams(window.location.search).get('q')).toBe('Energie & Wind');
    expect(new URLSearchParams(window.location.search).get('ref')).toBe('nav');
    expect(window.location.hash).toBe('#top');

    input.value = 'e';
    input.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(300);
    await flushPromises();
    expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    expect(window.location.search).toBe('?ref=nav');
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
  });

  it('still searches when replaceState throws', async () => {
    setup();
    jest.spyOn(window.history, 'replaceState').mockImplementation(() => { throw new Error('SecurityError'); });
    await load([entry('Energie')]);
    submit('energie');
    await flushPromises();
    expect(status.textContent).toBe('1 Ergebnis gefunden');
  });
});

describe('search index template (search.11ty.js)', () => {
  const item = (title, extra = {}, templateContent = '<p>Content</p>') => ({
    url: `/${title.toLowerCase().replace(/\s+/g, '-')}/`, templateContent, data: { title, ...extra },
  });

  async function render(collections, imageThumbnail = jest.fn(async () => ({ ...THUMBNAIL }))) {
    const template = new SearchIndex();
    template.imageThumbnail = imageThumbnail;
    return { index: JSON.parse(await template.render({ collections })), imageThumbnail };
  }

  it('is a sitemap- and collection-excluded JSON file rendered after posts and dashboards', () => {
    expect(new SearchIndex().data()).toEqual({
      permalink: '/search.json',
      excludeFromSitemap: true,
      eleventyExcludeFromCollections: true,
      eleventyImport: { collections: ['post', 'dashboard'] },
    });
    expect(fs.existsSync(path.join(__dirname, '../src/search.json.njk'))).toBe(false);
  });

  it('includes public posts and dashboards, excludes drafts/noindex/unpublished and handles optional metadata', async () => {
    const { index, imageThumbnail } = await render({
      post: [item('Older', { date: new Date('2024-01-15T00:00:00Z'), topic: ['energie'], excerpt: 'Alt', image: '/images/a.png' }),
        item('Post', { date: '2025-02-01', topic: 'wirtschaft', excerpt: 'Neu' }),
        item('Draft', { draft: true }), item('Hidden', { noindex: true }),
        item('Unpublished', { permalink: false }), item('Excluded', { eleventyExcludeFromCollections: true })],
      dashboard: [item('Dashboard', { dashboardSummary: 'Strommix &amp; Preise', dashboardTopic: 'Energie',
        dashboardImage: '/images/dashboards/strom.svg' }, '<table><tr><td>999</td></tr></table>'),
      item('Draft dashboard', { draft: true })],
    });
    expect(index.map((entry) => entry.title)).toEqual(['Dashboard', 'Post', 'Older']);
    for (const entry of index) {
      expect(Object.keys(entry)).toEqual(['title', 'url', 'excerpt', 'date', 'topic', 'thumbnail', 'content']);
    }
    expect(index[0]).toEqual({ title: 'Dashboard', url: '/dashboard/', excerpt: 'Strommix & Preise', date: null,
      topic: ['Energie'], thumbnail: THUMBNAIL, content: 'Strommix & Preise' });
    expect(index[1]).toMatchObject({ date: '2025-02-01T00:00:00.000Z', topic: ['wirtschaft'], thumbnail: null, content: 'Content' });
    expect(index[2]).toMatchObject({ date: '2024-01-15T00:00:00.000Z', topic: ['energie'], thumbnail: THUMBNAIL });
    expect(imageThumbnail.mock.calls).toEqual([['/images/dashboards/strom.svg'], ['/images/a.png']]);
    expect((await render({})).index).toEqual([]);
  });

  it('keeps only the documented thumbnail fields and treats a missing result as no image', async () => {
    const extra = jest.fn(async () => ({ ...THUMBNAIL, alt: 'x', format: 'png', srcset: null }));
    const { index } = await render({ post: [item('A', { image: '/images/a.png' })] }, extra);
    expect(index[0].thumbnail).toEqual({ src: THUMBNAIL.src, webpSrcset: THUMBNAIL.webpSrcset, sizes: THUMBNAIL.sizes,
      width: 360, height: 203 });
    for (const value of [null, undefined, {}, { src: '' }]) {
      const { index: empty } = await render({ post: [item('A', { image: '/images/a.png' })] }, async () => value);
      expect(empty[0].thumbnail).toBeNull();
    }
  });

  it('never requests thumbnails for remote or non-/images/ sources', async () => {
    const { index, imageThumbnail } = await render({ post: [item('Remote', { image: 'https://example.org/a.png' })] });
    expect(index[0].thumbnail).toBeNull();
    expect(imageThumbnail).not.toHaveBeenCalled();
  });

  it('fails loudly without the image filter and propagates image errors', async () => {
    const template = new SearchIndex();
    await expect(template.render({ collections: {} })).rejects.toThrow(/imageThumbnail/);
    await expect(render({ post: [item('A', { image: '/images/missing.png' })] },
      async () => { throw new Error('missing image'); })).rejects.toThrow('missing image');
  });

  it('excludes only boolean false permalinks, not missing or empty implicit values', async () => {
    const items = [undefined, '', false, '/explicit/'].map((permalink, index) => ({
      url: `/post-${index}/`, data: { title: `Post ${index}`, permalink }, templateContent: 'Content',
    }));
    const { index } = await render({ post: items });
    expect(index.map((entry) => entry.url).sort()).toEqual(['/post-0/', '/post-1/', '/post-3/']);
  });

  it('indexes visible text only: embeds, entities and markup are sanitised', async () => {
    const html = '<h2>Wind &amp; Sonne</h2><p>Erste&nbsp;Zeile</p><p>zweite</p>'
      + '<iframe title="Chart" src="https://datawrapper.dwcdn.net/x/"><p>iframe fallback</p></iframe>'
      + '<script type="text/javascript">!function(){"use strict";window.addEventListener("message",function(a){})}();</script>'
      + '<style>.x { color: red }</style><noscript>Bitte JavaScript aktivieren</noscript>'
      + '<table><tr><th>Jahr</th><td>2024</td><td>1,5&#8201;GW</td></tr></table>'
      + '<p>Code: &lt;b&gt;fett&lt;/b&gt; und <strong>St</strong>rom</p>';
    const { index } = await render({ post: [item('Sanitised', { excerpt: 'A &amp; B <em>kursiv</em>' }, html)] });
    const [{ content, excerpt }] = index;
    // Non-breaking and thin spaces collapse to ordinary spaces, so "Erste Zeile" matches.
    expect(content).toBe('Wind & Sonne Erste Zeile zweite Jahr 2024 1,5 GW Code: <b>fett</b> und Strom');
    expect(excerpt).toBe('A & B kursiv');
    for (const leaked of ['function', 'addEventListener', 'color', 'iframe fallback', 'JavaScript aktivieren', 'amp', 'nbsp']) {
      expect(content).not.toContain(leaked);
    }
  });
});

describe('searchText', () => {
  test.each([
    [null, ''],
    [undefined, ''],
    ['  plain\n\ttext  ', 'plain text'],
    ['<p>a</p><p>b</p>', 'a b'],
    ['<td>1</td><td>2</td>', '1 2'],
    ['Ener<a href="/x">gie</a>', 'Energie'],
    ['<img src="x.png" alt="Bild">Text', 'Text'],
    ['<a title="a > b" href="/">Link</a>', 'Link'],
    ['<!-- <script>x</script> -->sichtbar', 'sichtbar'],
    ['<script>var s = "<!--";</script>danach', 'danach'],
    ['<SCRIPT type="module">x()</SCRIPT >nach', 'nach'],
    ['<template><p>t</p></template>ok', 'ok'],
    ['vor<script>ohne Ende', 'vor'],
    ['Stro\u00adm\u200b', 'Strom'],
    ['&amp;lt;', '&lt;'],
    ['&euro; &#228; &#xFC; &#0; &unknown;', '€ ä ü \ufffd &unknown;'],
  ])('%p → %p', (input, expected) => {
    expect(searchText(input)).toBe(expected);
  });

  test('decodes entities in a single pass', () => {
    expect(decodeEntities('&amp;amp; &lt;b&gt;')).toBe('&amp; <b>');
  });

  test('real Datawrapper posts no longer match their embed script', () => {
    const markdown = new MarkdownIt({ html: true });
    const posts = ['2025/Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md', '2024/Erfreuliche-Entwicklung-für-die-Windkraft.md'];
    for (const post of posts) {
      const source = fs.readFileSync(path.join(__dirname, '../src/posts', post), 'utf8');
      const html = markdown.render(body(source));
      expect(html).toMatch(/<script[^>]*>!function/);
      const text = searchText(html);
      expect(text.length).toBeGreaterThan(200);
      expect(text).not.toMatch(/function|datawrapper-height|addEventListener|use strict/);
      expect(text).not.toMatch(/&[a-z]+;|<\/?[a-z]/i);
    }
  });
});
