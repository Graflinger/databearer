/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

const source = (file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');

describe('dashboard overview', () => {
  test('renders every dashboard in the collection with its route and metadata', () => {
    const template = source('dashboards/index.njk').replace(/^---[\s\S]*?---\s*/, '');
    const dashboards = ['Strom', 'Another dashboard'].map((title, index) => ({
      url: `/dashboards/${index}/`,
      data: { title, dashboardTopic: 'Energie', dashboardSummary: 'Description', dashboardCadence: 'Täglich',
        ...(index === 0 ? { dashboardImage: '/images/dashboards/strommarkt-deutschland.svg', dashboardImageAlt: 'Stilisierter Strommix' } : {}) },
    }));
    const html = nunjucks.renderString(template, { collections: { dashboard: dashboards } });
    dashboards.forEach((dashboard) => {
      expect(html).toContain(`href="${dashboard.url}"`);
      expect(html).toContain(dashboard.data.title);
    });
    expect(html.match(/class="dashboard-card"/g)).toHaveLength(2);
    expect(html.match(/class="dashboard-card-content"/g)).toHaveLength(2);
    expect(html.match(/class="dashboard-card-image"/g)).toHaveLength(1);
    expect(html).toContain('alt="Stilisierter Strommix"');
    expect(html).toContain('width="960" height="540"');
    expect(html).not.toContain('src=""');
  });

  test('dashboard prioritizes KPI cards before detailed data notices', () => {
    const page = source('dashboards/strom.njk');
    const cards = page.indexOf('class="electricity-kpis"');
    expect(cards).toBeLessThan(page.indexOf('id="electricity-history-coverage"'));
    expect(cards).toBeLessThan(page.indexOf('class="electricity-meta"'));
    expect(cards).toBeLessThan(page.indexOf('id="electricity-history-selection"'));
  });

  test('navigation leads to the overview and detail page opts into the collection', () => {
    expect(source('_includes/base.njk')).toMatch(/href="\/dashboards\/"[^>]*>Dashboards?<\/a>/);
    expect(source('dashboards/strom.njk')).toMatch(/^tags: dashboard$/m);
    expect(source('dashboards/strom.njk')).toContain('href="/dashboards/"');
    expect(source('dashboards/index.njk')).not.toMatch(/^tags: dashboard$/m);
    expect(source('dashboards/strom.njk')).toContain('dashboardImage: /images/dashboards/strommarkt-deutschland.svg');
    expect(source('dashboards/strom.njk')).not.toContain('Tage mit ergänztem Kernkraftwert 0');
    expect(source('js/dashboards/electricity-dashboard.js')).not.toContain('Tage mit ergänztem Kernkraftwert 0');
  });
});
