---
name: frontend-visualization
description: Guides creating databearer frontend data visualisations with Apache ECharts, CSV inputs, chart config files, generated chart JavaScript, and Markdown post embeds.
compatibility: opencode
metadata:
  project: databearer
  area: frontend
---

# Databearer frontend visualization skill

## When to use this skill

Use this skill when adding or changing charts in `databearer/frontend/`, especially:

- Adding CSV data for a post.
- Creating chart config files in `src/data_ingestion/charts/`.
- Embedding generated Apache ECharts visualisations in Markdown posts.
- Debugging chart generation or missing charts.

## How chart generation works

Charts are generated before every Eleventy build by `.eleventy.js`, which runs:

```bash
node "src/data_ingestion/generate-charts.js"
```

The generator:

1. Reads CSV files from `src/data_ingestion/data/`.
2. Loads chart config modules from `src/data_ingestion/charts/`.
3. Builds chart JavaScript using `src/data_ingestion/builders/`.
4. Writes generated files to `src/js/charts/<config-file-name>/<outputFile>`.

`src/data_ingestion/**` is ignored by Eleventy output, while `src/js/**` is copied through.

Important: the current loader reads direct `.js` files in `src/data_ingestion/charts/` for full
generation. If you keep configs in subfolders, either call the generator with that relative path
(for example `2026/ausschreibung_wind_2025.js`) or update `chartConfigLoader.js` to recurse.

## Add a new visualization

1. **Prepare data**
   - Export source data from the pipeline to `.data/output/*.csv`.
   - Copy the final CSV into `frontend/src/data_ingestion/data/` if it should be tracked.
   - Keep headers stable and readable; chart configs reference headers exactly.
   - Prefer one tidy CSV per related chart set.

2. **Create chart config**
   - Add a JS config file directly under `src/data_ingestion/charts/` for automatic full builds.
     Use subfolders only if you also update the loader or call the file explicitly by relative path.
   - Export an array of chart objects.
   - The config file basename determines the output subdirectory.
     Example: `charts/ausschreibung_wind_2025.js` outputs to
     `src/js/charts/ausschreibung_wind_2025/`.

   ```javascript
   module.exports = [
     {
       type: 'line',                 // 'line' or 'bar'
       dataFile: 'my-data.csv',      // file in src/data_ingestion/data/
       outputFile: 'my-chart.js',    // generated JS filename
       containerId: 'my-chart',      // must match the post div id
       title: '',
       xAxisLabel: 'Jahr',
       yAxisLabel: 'Wert',
       xKey: 'jahr',
       yKey: 'wert',                 // single series
       smooth: true,
     },
   ];
   ```

   Multi-series example:

   ```javascript
   module.exports = [
     {
       type: 'bar',
       dataFile: 'energy-mix.csv',
       outputFile: 'energy-mix.js',
       containerId: 'energy-mix',
       xKey: 'country',
       yAxisLabel: 'TWh',
       seriesKeys: ['wind', 'solar', 'hydro'],
       seriesNames: ['Wind', 'Solar', 'Wasser'],
       stacked: false,
     },
   ];
   ```

3. **Generate charts**
   - Generate all charts:

     ```bash
     npm run build:charts
     ```

   - Generate one config file:

     ```bash
     node "src/data_ingestion/generate-charts.js" ausschreibung_wind_2025.js
     ```

     For a config stored in a subfolder, pass the relative path, for example
     `node "src/data_ingestion/generate-charts.js" 2026/ausschreibung_wind_2025.js`.

   - Confirm files appear under `src/js/charts/<config-file-name>/`.

4. **Embed in a post/page**
   - Load ECharts once per page before chart scripts; use ordered `defer` for both.
     Do not use `async` for dependent scripts.
   - Add a semantic chart section with a unique container ID, static evidence,
     units, observation period, and a descriptive source link.

   ```html
   <script defer src="/js/lib/echarts.min.js"></script>

   <section class="chart-section" aria-labelledby="my-chart-heading">
     <h3 id="my-chart-heading">Chart heading: measure and period</h3>
     <p id="my-chart-summary" class="chart-description">
       State the verified finding, key values, units and observation period here.
     </p>

     <div id="my-chart" aria-describedby="my-chart-summary"
          style="width: 100%; height: 400px;"></div>
     <script defer src="/js/charts/my-config/my-chart.js"></script>

     <p class="chart-sources">
       <strong>Quelle: </strong><a href="https://example.com/dataset">Publisher – dataset title</a>
     </p>
   </section>
   ```

   Replace the example source and summary with verified evidence. Where comparisons
   need more detail, include a real HTML table with caption, column/row headers,
   units and period. Summaries/tables must use the same frozen evidence as the chart,
   be visible without JavaScript, and be updated together. For chart-only annual
   articles, add a verified annual summary/table rather than relying on canvas text.
   Inspect any annual-summary helper before documenting its API; do not assume one exists.

5. **Build and inspect**

   ```bash
   npm test -- --runInBand
   npm run lint
   npm run build
   ```

   Follow the [generated SEO output checklist](../../../docs/seo.md), including
   `npm run test:seo-output` after building. Check the
   rendered page on desktop/mobile, browser console, and evidence with JavaScript
   disabled. Confirm drafts are absent from HTML, collections, sitemap, feeds and
   search after a full production rebuild, not only in watch output.

## Supported config fields

Required:

- `type`: currently `line` or `bar`.
- `dataFile`: CSV filename in `src/data_ingestion/data/`.
- `outputFile`: generated JS filename.
- `containerId`: HTML element ID.

Common optional fields:

- `title`, `xAxisLabel`, `yAxisLabel`
- `xKey`, `yKey`
- `seriesKeys`, `seriesNames` for multi-series charts
- `smooth` for line charts
- `color`, `colors`, `stacked` for bar/multi-series styling

## Troubleshooting

- **Chart not generated**: Check that the config exports an array and includes required fields.
- **Data load error**: Verify the CSV exists in `src/data_ingestion/data/` and headers match keys.
- **Chart not visible**: Confirm the container ID matches `containerId`, ECharts is loaded first,
  and the generated script path uses `/js/charts/<config-basename>/<outputFile>`.
- **Stale chart**: Re-run `npm run build:charts` and clear browser cache.
- **Build loop risk**: Generated chart files are watch-ignored; do not remove that setting in
  `.eleventy.js`.

## Quality expectations

- Every chart needs static HTML evidence, units, observation period and a verified
  descriptive source link. Verify legacy citations instead of fabricating missing
  provenance; label incomplete coverage and uncertainty.
- Use semantic headings/sections and accessible tables. Chart tooltip text is not
  a substitute for visible evidence, and summaries must not overstate results.
- Keep title/excerpt consistent with the data and set `lastUpdated` only for a real
  substantive revision, never during an incidental rebuild.
- Use unique container IDs across the page.
- Avoid committing generated or copied data unless it is intentionally part of the reproducible
  frontend chart inputs.
- Keep frontend CSV column names synchronized with pipeline export scripts.
