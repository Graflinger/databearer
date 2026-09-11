---
name: frontend-visualization
description: Use when creating or organizing frontend data entities, frozen CSV/JSON datasets by year/topic, provenance manifests, ECharts configs, generated charts, or Markdown chart embeds.
compatibility: opencode
metadata:
  project: databearer
  area: frontend
---

# Databearer frontend visualization skill

## When to use this skill

Use this skill when adding or changing charts in `databearer/frontend/`, especially:

- Adding CSV data for a post.
- Creating, refreshing, or moving a frozen article dataset and its provenance/quality files.
- Creating chart config files in `src/data_ingestion/charts/`.
- Embedding generated Apache ECharts visualisations in Markdown posts.
- Debugging chart generation or missing charts.

## How chart generation works

Charts are generated before every Eleventy build by `.eleventy.js`, which runs:

```bash
node "src/data_ingestion/generate-charts.js"
```

The generator:

1. Reads CSV files relative to `src/data_ingestion/data/`; new frozen article datasets
   use `<article-year>/<topic>/` subfolders, while legacy flat paths remain supported.
2. Loads chart config modules from `src/data_ingestion/charts/`.
3. Builds chart JavaScript using `src/data_ingestion/builders/`.
4. Writes generated files to `src/js/charts/<config-file-name>/<outputFile>`.

`src/data_ingestion/**` is ignored by Eleventy output, while `src/js/**` is copied through.

Important: the current loader reads direct `.js` files in `src/data_ingestion/charts/` for full
generation. Nested **data** paths already work; this does not imply recursive **config**
discovery. Keep new automatically built configs directly in the config directory.
Invoke legacy nested configs explicitly (for example `2026/ausschreibung_wind_2025.js`).
Do not enable recursive discovery as part of a data-folder migration: old configs may
depend on unavailable frozen inputs or overwrite published charts.

## Organize a frozen data entity

A data entity is the complete, reproducible evidence package for one article/topic:
chart CSVs, supporting aggregates, quality report, and source/contract manifest.
Use the **article year**, not the years covered by the observations:

```text
frontend/src/data_ingestion/
  data/2026/battery_storage/
    battery_storage_cohorts.csv
    battery_storage_segments.csv
    battery_storage_yearly.csv
    ...
    battery_storage_quality.json
    battery_storage_metadata.json
  charts/battery_storage.js
  utils/batteryStorageValidation.js
```

- Choose one stable lowercase topic slug; keep all payloads and their manifest together.
- Keep raw downloads, databases, credentials and unit-level private data outside Git.
  Frontend evidence should be compact, licensed aggregates, not a source dump.
- Keep live dashboard exports in their existing `_data/` / `data-history/` architecture.
  Never make a frozen post consume a rotating dashboard snapshot at build/runtime.
- Use `dataFile: '2026/battery_storage/battery_storage_cohorts.csv'` in chart configs.
  This is relative to the data root, not the config directory or web URL. Use no
  absolute paths or `..`. Generated JS paths continue to depend on the config basename.
- Ingestion sources are excluded from site output. If readers need downloads, create
  an explicit, tested public route/passthrough; do not link directly to ingestion paths.
- Add narrow Git-ignore exceptions in `src/data_ingestion/.gitignore`, including
  parent-directory traversal. Do not broadly unignore all raw/local datasets. Example:

  ```gitignore
  data/*
  !data/2026/
  data/2026/*
  !data/2026/battery_storage/
  data/2026/battery_storage/*
  !data/2026/battery_storage/battery_storage_cohorts.csv
  !data/2026/battery_storage/battery_storage_segments.csv
  !data/2026/battery_storage/battery_storage_duration.csv
  !data/2026/battery_storage/battery_storage_daily_profile.csv
  !data/2026/battery_storage/battery_storage_yearly.csv
  !data/2026/battery_storage/battery_storage_monthly.csv
  !data/2026/battery_storage/battery_storage_by_state.csv
  !data/2026/battery_storage/battery_storage_summary.csv
  !data/2026/battery_storage/battery_storage_duration_distribution.csv
  !data/2026/battery_storage/battery_storage_quality.json
  !data/2026/battery_storage/battery_storage_metadata.json
  ```

### Create and validate the package

1. Define grain, keys, units, coverage, timezone, missing-value semantics and source
   licensing before export. Distinguish snapshot date from observation cutoff and
   acquisition time; label incomplete periods and source-specific scopes explicitly.
2. Use `data-pipeline` to ingest/build only the required sources/models. Test uniqueness,
   joins, nonempty expected outputs, finite values, completeness and reconciled sums.
   Preserve unknowns and report exclusions rather than quietly converting them to zero.
3. Export deterministically into an ignored staging folder, e.g.
   `pipeline/.data/output/<topic>/`. Sort keys, fix headers/precision/null encoding,
   and record methodology version, source URL/license/date/hash, model/export identity,
   plus each payload's filename, SHA-256, byte size, row count and column contract.
   Use separate provenance/windows for multiple sources; never invent old retrieval times.
4. Validate the **entire** package before replacing frontend evidence. Promote the
   manifest last; file-by-file atomic replacement is not directory-level atomicity.
   Preserve the prior working set on validation failure and verify after interruption.
5. Add a build-time validator called by the chart config **before** exporting configs.
   Check the exact payload allowlist, safe regular-file paths, hashes, sizes, CSV
   headers/row counts, JSON structure and semantic dates. Check supporting exports too,
   not only the files directly charted. A mixed or missing package must fail generation.
   Hashes prove manifest consistency, not independent authenticity of the source.
6. After review, export to `frontend/src/data_ingestion/data/<article-year>/<topic>/`.
   Update chart config, validator, tests, article numbers/dates and runbook together.
   Do not silently refresh already-published evidence during an unrelated build.

Reference implementation: `charts/battery_storage.js`, `utils/batteryStorageValidation.js`,
`frontend/tests/battery-storage-post.test.js`,
`pipeline/src/data_pipelines/export_data/2026/batteries_germany/`, and
`docs/battery_storage.md` (all paths relative to their documented project roots).
Reuse the pattern, not battery-specific dates, thresholds or field names.

### Move an existing entity safely

- Inventory tracked, ignored and missing inputs and every `dataFile`, exporter,
  validator, test and runbook reference first. Never fabricate missing historical CSVs.
- Move the complete package byte-for-byte; retain manifest basenames and provenance.
  A path-only migration must not recompute source data, dates or scientific results.
- Update relative paths and ignore exceptions. Remove old copies only after the new
  package verifies. Keep generated JS URLs/container IDs stable; assert that path-only
  moves produce byte-identical JS. An intentional data refresh may change chart values.
- Leave unavailable legacy datasets/configs and shared examples intact; document them
  as legacy rather than assigning an arbitrary publication year or redownloading them.

### Acceptance checks

Test nested input resolution, missing/corrupt/mixed payload rejection, stable generated
asset paths and article/table numbers against exports. From `frontend/`, on Node 20:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Run any topic-specific post-build checks as well. Inspect desktop/mobile charts,
console errors, accessible static evidence, and feed/search/sitemap behavior for drafts.
Inspect Git status/diff and ignore boundaries; no commits or publication unless requested.

## Add a new visualization

1. **Prepare data**
   - Export and validate the complete package in `.data/output/<topic>/`.
   - Place frozen evidence in `frontend/src/data_ingestion/data/<article-year>/<topic>/`.
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
        dataFile: '2026/my_topic/my-data.csv', // relative to src/data_ingestion/data/
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
        dataFile: '2026/energy_mix/energy-mix.csv',
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
- `dataFile`: CSV path relative to `src/data_ingestion/data/`; use article year/topic
  for new frozen datasets. Legacy flat paths still resolve.
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
