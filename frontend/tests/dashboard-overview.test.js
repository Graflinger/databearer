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
      data: { title, dashboardTopic: 'Energie', dashboardSummary: 'Description', dashboardCadence: 'Täglich' },
    }));
    const html = nunjucks.renderString(template, { collections: { dashboard: dashboards } });
    dashboards.forEach((dashboard) => {
      expect(html).toContain(`href="${dashboard.url}"`);
      expect(html).toContain(dashboard.data.title);
    });
    expect(html.match(/class="dashboard-card"/g)).toHaveLength(2);
  });

  test('navigation leads to the overview and detail page opts into the collection', () => {
    expect(source('_includes/base.njk')).toMatch(/href="\/dashboards\/"[^>]*>Dashboards?<\/a>/);
    expect(source('dashboards/strom.njk')).toMatch(/^tags: dashboard$/m);
    expect(source('dashboards/strom.njk')).toContain('href="/dashboards/"');
    expect(source('dashboards/index.njk')).not.toMatch(/^tags: dashboard$/m);
  });
});
