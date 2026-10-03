# Frozen electricity YTD article

Article: `frontend/src/posts/2026/strom-2026-ytd-zahlen.md`.
Evidence: `frontend/src/data_ingestion/data/2026/strom_ytd/`.

The source is pinned to `66035ab8b186fe975a55d065982a00963e3cee93` (dashboard refresh
of 2 October 2026, history through 2026-10-01, present on `main` and
`releases/cloudflare`). The source manifest selects the correct hashed 2026 partition;
do not choose the first matching filename. No network fetch or dashboard refresh is
involved.

Refresh of 3 October 2026 (before first publication): the window moved from
January 1–September 9 (source `dd0c7f8`) to January 1–September 30, so the article
compares three complete quarters. `quarters.csv` was added for the quarterly price
chart and the seasonal wind/solar comparison. The rounded `strom_ytd_2026_mix.csv`
from the first draft was dropped: it only preserved a never-published version and
cannot reconcile with the refreshed totals. The September 30 values were still
inside the dashboard's 35-day correction window when frozen; the article says SMARD
may still revise recent weeks. A later refresh must change the exporter constants,
validator, tests, article numbers/dates and this file together.

From `frontend/`, reproduce the other payloads and manifest with:

```sh
python3 src/data_ingestion/freeze_strom_ytd.py
node src/data_ingestion/generate-charts.js strom_ytd_2026.js
npm test -- --runInBand
npm run lint
npm run build
```

The exporter validates source hashes, dates, numeric coverage and DST before writing
any payload, and writes the manifest last. This is not a directory-level atomic swap;
the build validator rejects interrupted/mixed packages. Review the diff after export.
Tests independently recompute from the pinned Git objects, including provenance hashes,
when the exact source commit is available. Shallow checkouts skip only that historical
reproduction test. Frozen-package validation, corruption checks and article/chart
checks always run. Normal builds only read the frozen entity, never the live history
or Git objects.

All eight periods are January 1–September 30 inclusive (273 days, 6,551 hours;
274 days, 6,575 hours in the leap years 2020/2024 — the leap day stays included, so
calendar-equal windows do not have equal hours). Prices are nominal DE-LU daily means
weighted by local day length (the 23-hour spring DST day counts 23 h), not load.
Source daily means are rounded and can differ slightly from an evaluation of every
trading interval. Renewable shares are ratios of energy sums, not means of daily
shares; generation includes pumped storage and the former nuclear output, and
excludes PV self-consumption, industrial and railway grids. Missing values are
rejected, never zero-filled; the source-derived nuclear zeros after the 2023 phase-out
are retained. Complete daily rows do not prove complete intraday coverage; historical
SMARD daily sums can contain upstream partial data or interpolation.

`quarters.csv` holds the 2025 and 2026 calendar quarters Q1–Q3 (days, hours, price
numerator and mean, wind onshore and solar TWh). The validator requires the quarters
to partition each period exactly (days, hours, price numerator, wind and solar
energy). The dashboard's own quarterly prices reproduce SMARD's published quarterly
means (Q1 2025/2026, Q2 2025/2026, Q3 2025).

The manifest documents units, source limitations, missing-value policy and the
unknown original retrieval timestamp (not invented). Source commit time, source last
date, observation cutoff and editorial preparation date are distinct. Editorial
sources (SMARD merit-order explainer, 2022 annual review, Q1 and Q2 2026 quarterly
reviews) are recorded with their scope; their quarterly/annual figures are cited as
context and never mixed into the frozen aggregates.

`stromYtdValidation.js`, called by the chart config, enforces the exact payload
allowlist, regular files, hashes/sizes, CSV contracts, coverage and reconciled totals.
Hashes establish package consistency, not independent source authenticity.

The grouped mix chart uses just two year labels and two series, avoiding eleven
crowded mobile category labels. The quarterly price chart uses short `Q1`–`Q3` labels
so that all three stay visible at 375px. Both lines use explicit `seriesKeys` and
colors, with straight segments. Existing builders and public chart paths remain
standard. The headline comparison uses the reusable `comparison` type described below.

Following the blog-post-workflow skill, the article keeps only a short visible
"Daten und Quellen" section; the technical detail lives in this file. The post
retains numeric backups for the historical lines and full source mix in two closed
native `<details class="post-data-details">` disclosures, each with a
`<p class="table-note">` source line. Scope and causal limitations appear once, next
to the chart they qualify. Disclosure summaries retain the native marker and
keyboard behavior, with a visible focus outline. Tables inside the numeric
disclosures have cell padding, separators and numeric alignment.

## Reusable semantic comparison chart

`builders/comparisonChart.js` supports `type: 'comparison'` through the standard
generator. It renders a compact definition list, with a label, baseline/current
absolute figures and a neutral change label per metric. There is no normalized
axis, color-coded good/bad judgment or ECharts dependency for this chart type.
Mixed units are therefore meaningful without implying a shared scale.

The config uses the normal `dataFile`, `outputFile` and `containerId`, plus:

```js
{
  type: 'comparison',
  dataFile: '2026/strom_ytd/periods.csv',
  outputFile: 'comparison.js',
  containerId: 'strom-ytd-2026-comparison',
  label: 'Stromkennzahlen: jeweils 1. Januar bis 30. September',
  xKey: 'year', baseline: 2025, current: 2026,
  metrics: [
    { key: 'generation_twh', label: 'Öffentliche Erzeugung', unit: 'TWh' },
    { key: 'renewable_share_pct', label: 'Erneuerbarenanteil', unit: '%', delta: 'percentagePoints' },
    { key: 'price_eur_mwh', label: 'Day-Ahead-Preis', unit: '€/MWh', digits: 2 },
  ],
}
```

`digits` and `deltaDigits` default to 1; formatting is German. The default `delta`
is `percent` (relative change); `percentagePoints` requires values expressed in `%`
(0–100 units, not fractions). Changes are calculated before display rounding.
Zero/negative baselines display the absolute values and an explicit unavailable
relative-change label. Missing/duplicate periods, non-finite observations, invalid
units/delta contracts and invalid precision fail generation rather than becoming zero.

Use the universal Eleventy shortcode in Markdown to include the evidence in the
initial HTML and feeds, even with JavaScript disabled:

```liquid
{% comparisonChart "strom_ytd_2026", "strom-ytd-2026-comparison" %}
```

`builders/comparisonEmbed.js` resolves a direct chart config by basename and ID,
reads the frozen CSV and calls the same renderer as the JS builder. The shortcode
also embeds the standard generated script at
`/js/charts/strom_ytd_2026/comparison.js`. That script fills empty containers for
script-only use and leaves existing static content intact. Labels and units are
escaped. Style the embed within `.post-content`; its responsive definition-list
rows stack labels above values at narrow widths rather than using oversized cards.
Keep the chart title, period explanation and source link alongside the shortcode.

Tests cover units/deltas, missing values, escaping, idempotent script execution,
generated-asset equivalence, closed disclosures, Markdown parsing, visible caveats
and the compiled post/dark-mode selectors. After building, also run:

```sh
node tests/check-strom-ytd-build.js
```

Browser QA: `/posts/2026/strom-2026-ytd-zahlen/`; check the comparison and four
ECharts charts at 375px and desktop widths, dark mode, tooltips, legends, keyboard
focus, table expansion, and JavaScript disabled. Ingestion payloads are not public
download routes.
