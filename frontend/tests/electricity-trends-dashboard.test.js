const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
global.TextDecoder = TextDecoder;
const nunjucks = require('nunjucks');
const data = require('../src/js/dashboards/electricity-data');
const history = require('../src/js/dashboards/electricity-history');
const { readHistory } = require('../src/data_ingestion/builders/electricityHistory');
const { verifyAnnual, aggregate } = require('../src/data_ingestion/builders/electricityTrends');
const { scenarios, annualLabel, monthCount } = require('./fixtures/electricity-trends');
const { mount } = require('../src/js/dashboards/electricity-trends');
const recent = require('../src/_data/germanElectricity.json');
const producer = require('../src/_data/germanElectricityTrade.json');
const annual = verifyAnnual(fs.readFileSync(path.join(__dirname, '../src/_data/germanElectricityAnnual.json')));
const cases = scenarios(readHistory(), producer, recent, annual);
const template = fs.readFileSync(path.join(__dirname, '../src/dashboards/strom.njk'), 'utf8').replace(/^---[\s\S]*?---\n/, '');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../src/_includes')), { autoescape: true });
require('../src/data_ingestion/builders/electricityFilters').register(env);
describe.each(cases)('$name', ({ historyData, snapshot, now, trends }) => {
const monthlyCount = monthCount(snapshot.first_month, snapshot.last_month);
const tableCounts = [trends.summary.energy.length, trends.summary.energy.length, trends.summary.trade.years.length, monthlyCount];
let intersect, observe, unobserve, charts, themes;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  document.body.innerHTML = env.renderString(template, { germanElectricity: recent, germanElectricityHistory: historyData, germanElectricityTrends: trends });
  observe = jest.fn(); unobserve = jest.fn(); charts = []; themes = [];
  global.IntersectionObserver = jest.fn((callback) => { intersect = callback; return { observe, unobserve }; });
  window.matchMedia = jest.fn(() => ({ addEventListener: (_, callback) => themes.push(callback) }));
  window.echarts = { init: jest.fn((node) => { const chart = { node, setOption: jest.fn(), getOption: jest.fn(() => ({ legend: [{ selected: { Solar: false }, scrollDataIndex: 2 }] })), resize: jest.fn(), dispose: jest.fn() }; charts.push(chart); return chart; }) };
  window.fetch = jest.fn();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); delete global.IntersectionObserver; });
const nodes = () => [...document.querySelectorAll('[data-trend-chart]')];
const show = (node) => intersect([{ target: node, isIntersecting: true }]);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('annual panels render compact accessible tables and retain downloadable values and source notes', () => {
  expect(document.querySelectorAll('#electricity-trends table')).toHaveLength(4);
  const tables = [...document.querySelectorAll('#electricity-trends tbody')];
  expect(tables.map((node) => node.children.length)).toEqual(tableCounts);
  expect(nodes().every((node) => node.hidden)).toBe(true);
  expect(document.querySelector('#electricity-trends-gaps').textContent).toContain('2016 und 2018: veröffentlichte SMARD-Jahresaggregate; übrige Jahre aus Tageswerten summiert. Lücken in Tageshistorie bleiben bestehen.');
  for (const heading of ['shares', 'mix']) {
    const panel = document.querySelector(`[aria-labelledby="electricity-trends-${heading}-heading"]`);
    expect(panel.querySelector('table')).not.toBeNull();
    expect(panel.querySelector('[data-trend-chart]')).not.toBeNull();
  }
  const annualPanel = document.querySelector('[aria-labelledby="electricity-trends-trade-years-heading"]');
  expect(annualPanel.querySelector('table')).not.toBeNull();
  if (!snapshot.last_month.endsWith('-12')) expect(annualPanel.textContent).toContain(annualLabel(snapshot.last_month));
  expect(annualPanel.querySelectorAll('.electricity-trade-key[aria-hidden="true"]')).toHaveLength(4);
  expect(document.querySelectorAll('[aria-label="Legende monatlicher Stromhandel"] .electricity-trade-key')).toHaveLength(3);
  for (const table of document.querySelectorAll('#electricity-trends table')) {
    const details = table.closest('details');
    expect(details.open).toBe(false);
    expect(details.querySelector('summary').textContent.trim()).not.toBe('');
    const wrap = table.parentElement;
    expect(wrap.classList.contains('electricity-table-wrap')).toBe(true);
    expect(wrap.getAttribute('role')).toBe('region');
    expect(wrap.getAttribute('aria-label')).toBeTruthy();
    expect(wrap.tabIndex).toBe(0);
    expect(table.caption.textContent).toMatch(/%|TWh/);
    expect(table.caption.textContent).toContain('fehlend');
    expect([...table.querySelectorAll('thead th')].every((cell) => cell.scope === 'col')).toBe(true);
    expect([...table.querySelectorAll('tbody th')].every((cell) => cell.scope === 'row')).toBe(true);
  }
  const script = document.querySelector('#electricity-trends-data');
  expect(script.type).toBe('application/json');
  expect(JSON.parse(script.textContent)).toEqual(trends.summary);
  const sources = document.querySelector('#electricity-trends-sources');
  expect(sources.closest('.electricity-method')).not.toBeNull();
  expect(document.querySelector('#electricity-trends').contains(sources)).toBe(false);
  expect(sources.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]')).not.toBeNull();
  expect(sources.querySelector('a[href="/data/german-electricity-trends.json"][download]')).not.toBeNull();
});

test('static annual cells match every summary value, all twelve sources and partial-year labels', () => {
  const table = (name) => document.querySelector(`[aria-labelledby="electricity-trends-${name}-heading"] table`);
  const cells = (row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent);
  const shares = [...table('shares').querySelectorAll('tbody tr')];
  const mix = [...table('mix').querySelectorAll('tbody tr')];
  expect(history.SOURCES).toHaveLength(12);
  expect([...table('mix').querySelectorAll('thead th')].slice(1, 13).map((cell) => cell.textContent)).toEqual(history.SOURCES.map((source) => source.label));
  trends.summary.energy.forEach((row, index) => {
    expect(shares[index].querySelector('th').textContent).toBe(String(row.year));
    expect(mix[index].querySelector('th').textContent).toBe(String(row.year));
    expect(cells(shares[index]).slice(0, 3)).toEqual([row.renewable_share, row.coal_share, row.gas_share].map((value) => data.number(value, 1)));
    expect(cells(mix[index]).slice(0, 13)).toEqual([...history.SOURCES.map((source) => row.mix_twh[source.key]), row.generation_twh].map((value) => data.number(value, 2)));
    for (const rendered of [shares[index], mix[index]]) {
      expect(cells(rendered).at(-1)).toContain(`${row.complete_days}/${row.days} Erzeugungstage`);
      expect(cells(rendered).at(-1).includes('SMARD-Jahreswerte')).toBe(row.method === 'source_annual_aggregate');
    }
  });
  const trade = [...table('trade-years').querySelectorAll('tbody tr')];
  trends.summary.trade.years.forEach((row, index) => {
    expect(trade[index].querySelector('th').textContent).toBe(`${row.label}${row.partial_year ? ' · Teiljahr' : ''}`);
    expect(trade[index].classList.contains('electricity-trends-partial')).toBe(row.partial_year);
    expect(cells(trade[index]).slice(0, 3)).toEqual([row.imports_twh, row.exports_twh, row.net_exports_twh].map((value) => data.number(value, 2)));
    expect(cells(trade[index]).at(-1)).toBe(`${row.complete_months}/${row.months} Monate${row.complete_months < row.months ? ' · Fehlende Monatswerte; keine Jahressumme' : ''}`);
  });
  expect(document.querySelector('#electricity-trends-status').textContent).toContain('Jahres- und Monatstabellen');
});

test('share legend shows decorative line swatches with readable series labels', () => {
  const legend = document.querySelector('[aria-label="Anteilslinien"]');
  expect(legend.querySelectorAll('.electricity-share-key[aria-hidden="true"]')).toHaveLength(3);
  for (const [key, label] of [
    ['renewable', 'Erneuerbare'],
    ['coal', 'Kohle'],
    ['gas', 'Erdgas'],
  ]) {
    expect(legend.querySelector(`.electricity-share-key-${key}`).parentElement.textContent).toBe(label);
  }
  expect(legend.textContent).not.toMatch(/Gold|neutral|Quellenfarbe|durchgezogen|gestrichelt|gepunktet/);
});

test('daily-only template preserves coverage and visible gaps when the supplement is absent', () => {
  const summary = aggregate(historyData, snapshot);
  const html = env.render('electricity-trends.njk', { germanElectricityTrends: { summary, json: history.safeJSON(summary), sources: history.SOURCES } });
  const root = document.createElement('div'); root.innerHTML = html;
  const note = root.querySelector('#electricity-trends-gaps').textContent;
  expect(note).toContain('2016: 365/366');
  expect(note).toContain('2018: 361/365');
  expect(note).toContain('ohne Jahresaggregat bleibt der Jahreswert als Lücke sichtbar');
  expect(root.textContent).not.toContain('SMARD-Jahreswerte');
  for (const name of ['shares', 'mix']) {
    const rows = [...root.querySelectorAll(`[aria-labelledby="electricity-trends-${name}-heading"] tbody tr`)];
    for (const year of [2016, 2018]) {
      const row = rows.find((node) => node.querySelector('th').textContent === String(year));
      const cells = [...row.querySelectorAll('td')];
      expect(cells.slice(0, -1).map((cell) => cell.textContent)).toEqual(Array(name === 'shares' ? 3 : 13).fill('–'));
      expect(cells.at(-1).textContent).toContain('Jahreswert fehlt');
    }
    const complete = rows.find((node) => node.querySelector('th').textContent === '2015');
    expect(complete.textContent).not.toContain('Jahreswert fehlt');
    expect(complete.querySelector('td').textContent).not.toBe('–');
  }
});

test('annual trade tables distinguish true zeros, negative net values and missing months from partial calendar years', () => {
  const changed = JSON.parse(JSON.stringify(snapshot));
  for (const row of changed.rows.filter((row) => row.month.startsWith('2019-'))) {
    Object.assign(row, { imports_gwh: 0, exports_gwh: 0, net_exports_gwh: 0 });
  }
  for (const row of changed.rows.filter((row) => row.month.startsWith('2020-'))) {
    Object.assign(row, { imports_gwh: 2000, exports_gwh: 1000, net_exports_gwh: -1000 });
  }
  // Exercise a missing full-year month and the latest (possibly partial) year.
  for (const row of [changed.rows.find((row) => row.month === '2021-01'), changed.rows.at(-1)]) {
    Object.assign(row, { imports_gwh: null, exports_gwh: null, net_exports_gwh: null, missing_series: [4486] });
  }
  changed.schema_version = 2;
  const summary = aggregate(historyData, changed, annual);
  const root = document.createElement('div');
  root.innerHTML = env.render('electricity-trends.njk', { germanElectricityTrends: { summary, json: history.safeJSON(summary), sources: history.SOURCES } });
  const rows = [...root.querySelectorAll('[aria-labelledby="electricity-trends-trade-years-heading"] tbody tr')];
  expect([...rows[0].querySelectorAll('td')].slice(0, 3).map((cell) => cell.textContent)).toEqual(['0,00', '0,00', '0,00']);
  expect([...rows[1].querySelectorAll('td')].slice(0, 3).map((cell) => cell.textContent)).toEqual(['24,00', '12,00', '-12,00']);
  for (const index of [2, rows.length - 1]) {
    const row = summary.trade.years[index];
    const cells = [...rows[index].querySelectorAll('td')];
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual(['–', '–', '–']);
    expect(cells.at(-1).textContent).toBe(`${row.complete_months}/${row.months} Monate · Fehlende Monatswerte; keine Jahressumme`);
    expect(rows[index].querySelector('th').textContent).toBe(`${row.label}${row.partial_year ? ' · Teiljahr' : ''}`);
  }
});

test('charts initialize independently only near viewport, once, with no requests; theme changes preserve uninitialized charts', () => {
  mount();
  expect(window.echarts.init).not.toHaveBeenCalled();
  expect(observe).toHaveBeenCalledTimes(4);
  expect(global.IntersectionObserver.mock.calls[0][1]).toEqual({ rootMargin: '200px' });
  intersect([{ target: nodes()[0], isIntersecting: false }]);
  expect(window.echarts.init).not.toHaveBeenCalled();
  show(nodes()[0]); show(nodes()[0]);
  expect(window.echarts.init).toHaveBeenCalledTimes(1);
  themes.forEach((callback) => callback());
  expect(charts[0].setOption).toHaveBeenCalledTimes(2);
  expect(window.echarts.init).toHaveBeenCalledTimes(1);
  nodes().slice(1).forEach(show);
  expect(charts).toHaveLength(4);
  expect(unobserve).toHaveBeenCalled();
  expect(window.fetch).not.toHaveBeenCalled();
});

test('real period controller changes 1/7/30-day and historical selections without changing long-term charts or tables', async () => {
  window.ElectricityData = data;
  window.ElectricityHistory = { ...history, createLoader: () => async (year) => historyData.partitions.find((partition) => partition.year === year) };
  window.fetch.mockResolvedValue({ ok: true, json: async () => recent });
  mount(); nodes().forEach(show);
  const before = document.querySelector('#electricity-trends').innerHTML;
  const trendCharts = [...charts];
  window.eval(fs.readFileSync(path.join(__dirname, '../src/js/dashboards/electricity-dashboard.js'), 'utf8'));
  await flush();
  for (const days of [1, 7, 30]) document.querySelector(`[data-days="${days}"]`).click();
  const select = document.querySelector('#electricity-year'); select.value = '2018'; select.dispatchEvent(new Event('change'));
  await flush();
  expect(document.querySelector('#electricity-history-coverage').textContent).toContain('361/365');
  expect(document.querySelector('#electricity-trends').innerHTML).toBe(before);
  trendCharts.forEach((chart) => expect(chart.setOption).toHaveBeenCalledTimes(1));
  expect(window.fetch).toHaveBeenCalledTimes(1);
});

test('mix legend selection and page survive a theme change', () => {
  mount();
  const mix = nodes().find((node) => node.dataset.trendChart === 'mix');
  show(mix);
  themes.forEach((callback) => callback());
  const updated = charts[0].setOption.mock.calls.at(-1)[0];
  expect(updated.legend.selected).toEqual({ Solar: false });
  expect(updated.legend.scrollDataIndex).toBe(2);
});

test('missing ECharts retains all tables and reports fallback', () => {
  delete window.echarts;
  mount(); nodes().forEach(show);
  expect(document.querySelectorAll('#electricity-trends tbody tr')).toHaveLength(tableCounts.reduce((sum, count) => sum + count, 0));
  expect(nodes().every((node) => node.hidden)).toBe(true);
  expect(document.querySelector('#electricity-trends-status').textContent).toContain('JSON-Download');
  expect(document.querySelector('#electricity-trends-status').textContent).toContain('Jahres- und Monatstabellen');
});

test('no IntersectionObserver falls back to rendering and embedded JSON escapes script boundaries', () => {
  delete global.IntersectionObserver;
  mount();
  expect(charts).toHaveLength(4);
  const escaped = history.safeJSON({ note: '</script><script>alert(1)</script>\u2028&' });
  expect(escaped).not.toContain('<');
  expect(escaped).not.toContain('&');
  expect(JSON.parse(escaped).note).toContain('</script>');
});
});
