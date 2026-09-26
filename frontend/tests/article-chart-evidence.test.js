/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const root = path.resolve(__dirname, '../src');
const markdown = new MarkdownIt({ html: true });
const posts = fs.readdirSync(path.join(root, 'posts'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((year) => fs.readdirSync(path.join(root, 'posts', year.name))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${year.name}/${name}`));

function render(post) {
  const source = fs.readFileSync(path.join(root, 'posts', post), 'utf8');
  document.body.innerHTML = markdown.render(source.replace(/^---\n[\s\S]*?\n---\n/, ''));
  return source;
}

// These literals are the checked-in published evidence, independent of missing
// legacy CSVs and of ignored local inputs that may contain newer observations.
function frozenChart(script) {
  const code = fs.readFileSync(path.join(root, script.getAttribute('src')), 'utf8');
  return {
    containerId: code.match(/document\.getElementById\('([^']+)'\)/)[1],
    x: JSON.parse(code.match(/const xData = (\[[^\n]+\]);/)[1]),
    series: JSON.parse(code.match(/const seriesData = (\[[^\n]+\]);/)[1]),
  };
}

describe('article charts, including the battery draft', () => {
  test.each(posts)('%s: ordered deferred scripts and authored accessible summaries', (post) => {
    render(post);
    const scripts = [...document.querySelectorAll('script[src]')];
    const charts = scripts.filter((script) => script.getAttribute('src').startsWith('/js/charts/'));
    if (!charts.length) return;
    const libraries = scripts.filter((script) => script.getAttribute('src') === '/js/lib/echarts.min.js');
    expect(libraries).toHaveLength(1);
    for (const script of [libraries[0], ...charts]) {
      expect(script.hasAttribute('defer')).toBe(true);
      expect(script.hasAttribute('async')).toBe(false);
    }
    for (const script of charts) {
      expect(scripts.indexOf(libraries[0])).toBeLessThan(scripts.indexOf(script));
      const { containerId } = frozenChart(script);
      const container = document.getElementById(containerId);
      expect(container.getAttribute('role')).toBe('img');
      const headingId = container.getAttribute('aria-labelledby');
      if (headingId) {
        const heading = document.getElementById(headingId);
        expect(heading.tagName).toMatch(/^H[2-4]$/);
        expect(heading.textContent.trim()).not.toBe('');
      } else {
        expect(container.getAttribute('aria-label')).toBeTruthy();
      }
      const summary = document.getElementById(container.getAttribute('aria-describedby'));
      expect(summary.classList.contains('chart-description')).toBe(true);
      expect(summary.textContent.trim().length).toBeGreaterThan(40);
    }
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('published static numerical evidence', () => {
  const chartPosts = ['2025/Industriepolitik.md', '2026/Windenergiezukunft.md', '2026/Windkraftausschreibungen-2026.md'];
  test.each(chartPosts)('%s: every table cell matches its frozen chart, including missing values', (post) => {
    render(post);
    const scripts = [...document.querySelectorAll('script[src^="/js/charts/"]')];
    expect(scripts.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('table')).toHaveLength(scripts.length);
    for (const script of scripts) {
      const chart = frozenChart(script);
      const table = document.getElementById(`${chart.containerId}-table`);
      expect(table).not.toBeNull();
      expect(table.querySelector('caption').textContent).toMatch(/Auswahl|[Aa]usgewählte/);
      const headers = [...table.querySelectorAll('thead th')];
      expect(headers.every((cell) => cell.getAttribute('scope') === 'col')).toBe(true);
      const transposed = headers[0].textContent === 'Region';
      const rows = [...table.querySelectorAll('tbody tr')];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(6);
      if (transposed) expect(rows).toHaveLength(chart.series.length);
      for (const row of rows) {
        const rowHeading = row.querySelector('th[scope="row"]').textContent;
        const cells = [...row.querySelectorAll('td')];
        expect(cells).toHaveLength(headers.length - 1);
        if (!transposed) expect(cells).toHaveLength(chart.series.length);
        cells.forEach((cell, index) => {
          const x = transposed ? headers[index + 1].textContent : rowHeading;
          const xIndex = chart.x.findIndex((value) => String(value) === x);
          expect(xIndex).toBeGreaterThanOrEqual(0);
          const series = transposed ? chart.series.find((item) => item.name === rowHeading) : chart.series[index];
          expect(series).toBeDefined();
          const expected = series.data[xIndex];
          const text = cell.textContent.trim();
          if (expected === '' || expected === null) {
            expect(text).toBe('—');
          } else {
            expect(typeof expected).toBe('number');
            expect(Number.isFinite(expected)).toBe(true);
            const decimals = text.includes(',') ? text.split(',')[1].length : 0;
            expect(Number(text.replace(/\./g, '').replace(',', '.'))).toBe(Number(expected.toFixed(decimals)));
          }
        });
      }
    }
  });

  test('legacy gaps remain gaps and the two wind snapshots keep separate cutoffs', () => {
    render('2025/Industriepolitik.md');
    expect(document.querySelector('#industriepolitik_electrification_rate-table tbody tr').lastElementChild.textContent).toBe('—');
    render('2026/Windenergiezukunft.md');
    expect(document.querySelector('#zuschlagsmenge_in_kw-table').textContent).not.toContain('2026-02-01');
    const source = render('2026/Windkraftausschreibungen-2026.md');
    expect(document.querySelector('#zuschlagsmenge_in_kw_2026-table').textContent).toContain('2026-02-01');
    expect(document.querySelector('#zuschlagsmenge_in_kw_yearly_2026-table').textContent).not.toMatch(/2015|2016|2026/);
    expect(source).toContain('Stand: Februarrunde 2026');
    expect(source).toContain('ihre Ergebnisse sind im eingefrorenen Datenstand dieses Beitrags nicht enthalten');
    expect(source).not.toContain('stehen noch aus');
  });
});

// Source names/URLs verified from the embeds' source credits (including their
// existing version redirects), not from newly downloaded replacement datasets.
const sourceCredits = [
  ['2024/Staatsverschuldung-besser-als-gedacht.md', 3, 'AMECO', 'https://economy-finance.ec.europa.eu/economic-research-and-databases/economic-databases/ameco-database_en'],
  ['2024/Deutschland-der-kranke-Mann-Europas.md', 5, 'AMECO', 'https://economy-finance.ec.europa.eu/economic-research-and-databases/economic-databases/ameco-database_en'],
  ['2024/Das-fadenscheinige-Argument-der-Rekordsteuereinnahmen.md', 2, 'Destatis', 'https://www.destatis.de/DE/Home/_inhalt.html'],
  ['2024/Erfreuliche-Entwicklung-für-die-Windkraft.md', 1, 'Bundesnetzagentur', 'https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Ausschreibungen/Wind_Onshore/BeendeteAusschreibungen/start.html'],
  ['2025/Sensationelle-Ausschreibungserfolge-für-die-Windkraft.md', 1, 'Bundesnetzagentur', 'https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Ausschreibungen/Wind_Onshore/BeendeteAusschreibungen/start.html'],
  ['2025/Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md', 2, 'Energy-Charts', 'https://energy-charts.info'],
  ['2025/Die-Dunkelflaute-der-Kernkraft:-Hitzewellen.md', 1, 'World Bank', 'https://climateknowledgeportal.worldbank.org/'],
];

test.each(sourceCredits)('%s: lazy embeds and source credit readable in the host article', (post, count, name, url) => {
  render(post);
  const frames = [...document.querySelectorAll('iframe')];
  expect(frames).toHaveLength(count);
  for (const frame of frames) {
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.title).toBeTruthy();
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/datawrapper.dwcdn.net\//);
  }
  expect(document.querySelector(`a[href="${url}"]`).textContent).toContain(name);
  // These embeds have no checked-in numerical payload: do not substitute a table.
  expect(document.querySelector('table')).toBeNull();
});

test('contextual article links resolve to existing article routes', () => {
  const links = [
    ['2024/Staatsverschuldung-besser-als-gedacht.md', '2024/Das-fadenscheinige-Argument-der-Rekordsteuereinnahmen.md'],
    ['2024/Deutschland-der-kranke-Mann-Europas.md', '2024/Staatsverschuldung-besser-als-gedacht.md'],
    ['2024/Erfreuliche-Entwicklung-für-die-Windkraft.md', '2025/Sensationelle-Ausschreibungserfolge-für-die-Windkraft.md'],
    ['2025/Sensationelle-Ausschreibungserfolge-für-die-Windkraft.md', '2026/Windenergiezukunft.md'],
    ['2026/Windenergiezukunft.md', '2026/Windkraftausschreibungen-2026.md'],
    ['2026/Windkraftausschreibungen-2026.md', '2026/Windenergiezukunft.md'],
  ];
  for (const [post, target] of links) {
    expect(posts).toContain(target);
    render(post);
    const route = `/posts/${target.replace(/\.md$/, '/')}`;
    const links = [...document.querySelectorAll('a[href]')];
    expect(links.map((link) => decodeURI(link.getAttribute('href')))).toContain(route);
    const link = links.find((link) => decodeURI(link.getAttribute('href')) === route);
    expect(link.textContent).not.toBe('hier');
  }
  render('2025/Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md');
  expect(document.querySelector('a[href="/dashboards/strom/"]').textContent).toContain('Strom-Dashboard');
});
