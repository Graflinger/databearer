# German electricity frontend

Route: `/dashboards/strom/` (standalone, outside post collections).
The menu opens `/dashboards/`, which lists pages tagged `dashboard` automatically.
Optional `dashboardImage` and `dashboardImageAlt` frontmatter provide a card
illustration. Cards form compact horizontal rows with 25–27% image width; the
text-free SVG supports a 4:3 or square crop on smaller screens. The electricity SVG is an original decorative illustration, not a
plot of source observations. Cards without images still render normally.
Add `dashboardTopic`, `dashboardSummary`, and `dashboardCadence` frontmatter to new
dashboard pages for their overview cards. The overview itself is not tagged.
Dashboard chrome uses the site's gold/neutral palette, with a darker gold for
accessible text on light backgrounds; chart source colours remain distinct.
Input contracts: [recent hourly v1](../docs/german_electricity_data.md) and
[daily history v1](../docs/german_electricity_history.md), including its five
allowlisted nullable energy observations. The pipeline owns
`src/_data/germanElectricity.json` and `src/data-history/german-electricity/`.

## Static rendering and shared controls

Eleventy validates the real snapshot and the entire daily history. The default HTML
renders **YTD for the latest history year**, from 1 January through its final date,
with KPIs, source-mix table, chart text summaries, coverage and provenance.
The existing recent helper and hourly v1 contract retain their 1/7/30-day semantics.
`src/js/dashboards/electricity-data.js` is a dependency-free CommonJS/browser helper
used by both the build and the interactive page. It validates schema, metadata,
units, bounded values, complete hourly coverage, calendar days and future timestamps.
At the build boundary, `src/data_ingestion/builders/electricitySnapshot.js` verifies
the actual SHA-256 against the raw artifact. It preserves Python's numeric tokens
(including `0.0`, `-0.0` and exponent notation), checks compact sorted-key JSON with
one trailing newline, rejects duplicate keys, and hashes all root fields except
`content_hash` and `snapshot_created_at`. No Python runtime or extra dependency is
needed. Changing an observation while retaining its hash fails both rendering
filters. Parsed Eleventy data must also match the verified file, which is reread
for each render so watch builds cannot reuse an old verification.

The browser matches the HTML/JSON hash, coverage and creation timestamp to reject
mixed builds. A candidate becomes shared controller state only after all checks
pass, so a later theme change cannot render rejected data.

`src/data/german-electricity.njk` publishes the same snapshot at
`/data/german-electricity.json`. It is a standalone escaped JSON response, not an
interpolated executable script. The browser fetches this same-origin prepared
snapshot (15-second timeout) to enable the hourly controls. The standard local
ECharts library is reused.

This dashboard deliberately bypasses the CSV-to-generated-JS chart builder: one
shared JSON snapshot and one controller keep 1/7/30-day KPIs, table, stacked hourly
generation, separate load chart and signed price bars synchronized. Reusing the
per-chart CSV builders would duplicate data and calendar/aggregation logic. There
is no new framework, runtime server, upstream browser fetch or generated dashboard
JavaScript. Normal CSV chart discovery still reads only direct `.js` configs;
explicit nested filenames remain supported. Loader, generator and Eleventy hook
now propagate failures, including missing configs/data and write errors.

All period selections use Berlin calendar dates and actual UTC interval durations,
including 23/25-hour DST days. Tooltips distinguish repeated hours with GMT offsets;
the exclusive coverage boundary is never displayed as the last observed day.
Renewable shares use renewable energy / all generation energy, including pumped
storage in the denominator. Prices are time-weighted, not load-weighted. Source mix
bars, KPIs and summaries remain available without charts; without JavaScript the
initial YTD view remains readable and prepared JSON remains downloadable.

The freshness warning uses `data_through`, not snapshot creation time, and updates
in the browser every minute and when the tab becomes visible. Future timestamps
are rejected. This is not scheduler monitoring. Public copy describes automatic
daily updates and points to actual observation dates; capacity/congestion retains
its separate manual/monthly cadence and statutory targets their manual review date.

The [publication workflow](../docs/dashboard_publication.md) authorizes daily
09:17 UTC recent/history/trade publication only from an already released `main`
commit. Manual dispatch defaults to `publish=false`; activation awaits merge to
`main` and the first live deployment verification remains pending. Unpublished main
changes stop before source fetching/build. Changed validated exports alone advance
both refs atomically without force; normal code/blog promotion is manual.
`verify_dashboard_deployment.py` checks public recent data, history manifest/latest
partition, trends/progress and HTML for up to 240 seconds, including no-change
publishing runs. A push or validation artifact is not proof of Cloudflare deployment;
the verifier does not automatically retry an external build.

## YTD and yearly daily history

`src/js/dashboards/electricity-history.js` is the separate browser/CommonJS history
helper. `src/_data/germanElectricityHistory.js` calls the build validator in
`src/data_ingestion/builders/electricityHistory.js`, rereading the manifest and **all
referenced partitions**, including years that are not selected on the page. It checks:

- Exact keys, schema, source/license, revision policy, years and same-origin URLs.
- Contiguous dates/counts, leap days, Berlin 23/24/25-hour days, finite bounded values.
- Only the documented price and energy nulls, historical price zones, numeric
  nuclear values, shutdown zeros and their explicit derived-zero flags.
- Compact sorted-key UTF-8 JSON with no trailing newline or duplicate keys. Numeric
  tokens retain their Python spelling; SHA-256 hashes **raw bytes**, using Node
  crypto at build time and WebCrypto in the browser.

At the build boundary, the helper also reads the exact recent producer file through
`electricitySnapshot.verifySnapshot`. Recent and history must end on the same Berlin
calendar date (recent's `data_through` is exclusive). Every date shared by their
declared ranges must exist with the same actual day hours. Daily energy is compared
to the hourly GW sum with tolerance `(hours + 1) * 0.005 / 1000 + 1e-8` GWh;
daily price is compared to the hourly mean with tolerance `0.011` EUR/MWh, matching
the pipeline. Missing observations never become zero. Nuclear has no recent v1
series and is covered by the separate history shutdown/schema checks.
January overlap includes the preceding year's partition; a subset history starting
on 1 January compares only shared dates. Older dates outside the recent window
retain their documented source limitations. A mismatch fails the build even if
each artifact has a valid hash: refresh recent first, then history against it.
The after-build check repeats overlap validation and checks that the public recent
JSON matches the validated producer snapshot. Tests can supply an alternate raw
recent snapshot to `readHistory(directory, recentRaw)`; it is always fully verified.

Eleventy passthrough maps `src/data-history/german-electricity/` to
`/data/history/german-electricity/`. The public `manifest.json` is ordinary JSON
copied byte-for-byte; it does not hash itself. An after-build check validates the
published set, compares each referenced file and manifest byte-for-byte with the
inputs, and verifies the HTML's embedded manifest matches. Unreferenced retained
versions may be copied but never become extra selectable years.
`src/_headers` sets the public manifest to `Cache-Control: no-cache` and hashed
year files to immutable one-year caching on Cloudflare Pages. The local Eleventy
server does not apply these hosting rules; deployment headers need host-side
verification during the first live rollout. Browser manifest retries explicitly
request revalidation; partition hashes are always verified, even on cache hits.

The small validated manifest is safely escaped into a non-executable
`application/json` script in HTML. Its URLs and hashes pin that page to one data
publication. On initial load only the latest year is requested; choosing a previous
year requests only that partition. Verified years and in-flight requests are cached
in memory. A 404 revalidates the public manifest and retries the partition only if
the full manifest still matches HTML; a changed publication requires a page reload.
Network/HTTP, timeout, hash, schema and mixed-deployment failures retain the previous
view. The controller commits a candidate only if it is still the latest requested
selection. Theme changes render only committed data and preserve loading/error text.
The dropdown and `aria-pressed` buttons describe the displayed view while requests
are pending; `aria-busy` and a live status announce loading and failure.

### Aggregation and interpretation

- **Energy:** exclude a date from *all* generation, renewable share, mix and load
  summary calculations when any required energy field is null. Use the same
  complete-day hours denominator for all averages. Actual source gaps yield
  **365/366 complete days in 2016** and **361/365 in 2018**; these are explicitly
  partial sums, not annual totals. Never coerce missing values to zero.
- **Charts:** daily generation/load power is GWh / actual day hours, in GW. All
  stacked generation sources have gaps on incomplete-generation dates to avoid a
  misleading total; observed load and prices remain visible independently. Price
  bars show daily means with null gaps, not hourly extremes.
- **Prices:** sum daily mean × actual hours, divided by known-price hours, independent
  of energy coverage. In 2015, 1–4 January remain unknown: 361/365 priced days and
  96 excluded hours. Count negative **daily mean days**, never negative hours.
- **Market areas:** DE–AT–LU through 30 September 2018, DE–LU from 1 October. The 2018
  blended annual price is labeled with both market areas; comparisons need care.
- **Nuclear:** a twelfth history-only generation/table/legend source, excluded from
  renewables. After 15 April 2023 absent nuclear values are structural zeros flagged
  by the producer; observed zeros remain unflagged. Recent charts retain 11 sources.
- **Provenance:** running-year corrections cover the last 35 completed days; closed
  years are frozen, changed only through explicit reconciliation. Selected dates,
  frozen/revisable status, partial-year coverage and derived-zero counts are visible.
  Source daily sums may contain upstream partial data/interpolation. “Complete day”
  means all required *daily* observations exist, not certified underlying hours.

History freshness uses the **latest manifest date**, never a selected closed year,
with the same 96-hour delay after the next Berlin midnight. The separate recent
warning continues to describe current hourly data. Both advance in open tabs.
The year selector is sufficient for historical exploration; there is no all-years
chart that would require downloading the entire history.

## Verification

Run from `frontend/` using Node 20:

```sh
npm test -- --runInBand
npm run build
npm run lint
npm start
```

Open `http://localhost:8080/dashboards/strom/`. Check YTD, all previous years, all
three hourly periods, negative prices, mobile layout, light/dark mode, JavaScript
disabled, blocked JSON and blocked ECharts. Inspect 2015 price gaps, 2016/2018 energy
coverage, 2018 price-zone labeling, and history-only nuclear. Race two selections,
switch to recent while history is pending, then fail a request and change theme.
Check `/themen/energie/` discovery and the Dashboard navigation.
Jest covers aggregation, DST, validation, stale/future dates, controller fallbacks,
period consistency, and chart-generation failure propagation.
`tests/electricity-history.test.js` adds real-file Node/WebCrypto validation, strict
contract mutations, missing/corrupt unselected partitions, daily aggregation, lazy
caching, 404/mixed manifests and timeout recovery. `tests/electricity-history-dashboard.test.js`
adds static YTD, every year, daily chart gaps/units, dynamic nuclear, independent
freshness and asynchronous controller regression coverage. Existing recent tests
remain unchanged.

`src/scss/pages/_electricity.scss` holds scoped theme tokens and dashboard styles;
Sass emits the existing tracked `src/css/style.css` (include intentional dashboard styles). Generated legacy chart rewrites
are build artifacts, not dashboard source changes.
