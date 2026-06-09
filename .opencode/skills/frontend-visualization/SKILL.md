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
   - Load ECharts once per page before chart scripts.
   - Add a chart section with a unique container ID, short explanation, and source.

   ```html
   <script src="/js/lib/echarts.min.js"></script>

   <div class="chart-section">
     <h3>Chart heading</h3>
     <p class="chart-description">One-sentence takeaway from the chart.</p>

     <div id="my-chart" style="width: 100%; height: 400px;"></div>
     <script src="/js/charts/my-config/my-chart.js"></script>

     <div class="chart-sources">
       <strong>Quelle: </strong><a href="https://example.com">Source name</a>
     </div>
   </div>
   ```

5. **Build and inspect**

   ```bash
   npm run build
   ```

   Then check the rendered page or dev server and browser console.

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

- Every chart should have a textual takeaway and source link in the post.
- Use unique container IDs across the page.
- Avoid committing generated or copied data unless it is intentionally part of the reproducible
  frontend chart inputs.
- Keep frontend CSV column names synchronized with pipeline export scripts.
