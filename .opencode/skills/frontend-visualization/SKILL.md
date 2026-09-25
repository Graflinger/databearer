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

   Use this pattern. It passes `tests/article-chart-evidence.test.js`; keep it free of
   blank lines or indentation of 4+ spaces so Markdown keeps it as HTML:

   ```html
   <script defer src="/js/lib/echarts.min.js"></script>

   <div class="chart-section">
     <h3 id="my-chart-heading">Measure, geography and observation period</h3>
     <p class="chart-description" id="my-chart-description">Verified key finding with values, units and period.</p>
     <div id="my-chart" role="img" aria-labelledby="my-chart-heading" aria-describedby="my-chart-description" style="width: 100%; height: 400px;"></div>
     <script defer src="/js/charts/my-config/my-chart.js"></script>
     <div class="table-scroll" tabindex="0" role="region" aria-labelledby="my-chart-heading">
       <table id="my-chart-table">
         <caption>Ausgewählte Werte, Einheit, Datenstand</caption>
         <thead><tr><th scope="col">Jahr</th><th scope="col">Wert (Einheit)</th></tr></thead>
         <tbody><tr><th scope="row">2024</th><td>1.234</td></tr></tbody>
       </table>
     </div>
     <div class="chart-sources"><strong>Quelle: </strong><a href="https://example.com/dataset">Publisher – dataset title</a></div>
   </div>
   ```

   - Include ECharts **once** per page, before any chart script, and give every
     script `defer`, never `async`.
   - The container `id` must equal `containerId`. The heading must be an H2–H4 with
     an `id`, and the `chart-description` must be longer than 40 characters. All
     `id`s must be unique.
   - Tables use `id="<containerId>-table"`, a caption containing "Auswahl" or
     "Ausgewählte", `th scope="col"`/`th scope="row"`, and 2–6 rows. Values must
     match the frozen chart data (German number format, `—` for gaps).
   - Replace the placeholders with verified evidence and a verified source.

   The full requirements are in
   [Charts and evidence](../../../docs/seo.md#charts-and-evidence).

5. **Build and inspect**

   Run the [checks](../../../docs/seo.md#checks): `npm test -- --runInBand`,
   `npm run lint`, `npm run build`, `npm run test:seo-output`. Check the page on
   desktop and mobile, the browser console, and the evidence with JavaScript
   disabled.

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
- **Chart evidence test fails**: Compare the markup with the pattern in step 4; the
  test reads `containerId` from the generated script.
- **Stale chart**: Re-run `npm run build:charts` and clear browser cache.
- **Build loop risk**: Generated chart files are watch-ignored; do not remove that setting in
  `.eleventy.js`.

## Quality expectations

- Every chart has static HTML evidence (description plus table where useful), units,
  period and a verified, descriptive source link. Tooltips and canvas text do not
  count. Label incomplete coverage, and never invent provenance.
- Prose, tables and charts use the same frozen data. Do not refresh frozen article
  data incidentally, and set `lastUpdated` only for a real revision.
- Builders keep the authored `aria-labelledby`/`aria-describedby` and add ECharts
  ARIA labels only when none is given.
- Avoid committing generated or copied data unless it is intentionally part of the reproducible
  frontend chart inputs.
- Keep frontend CSV column names synchronized with pipeline export scripts.
