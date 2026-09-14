# Frozen electricity YTD article

Article: `frontend/src/posts/2026/strom-2026-ytd-zahlen.md`.
Evidence: `frontend/src/data_ingestion/data/2026/strom_ytd/`.

The source is permanently pinned to `dd0c7f8deef858a844be777a5fd1e78949386413`.
The source manifest selects the correct hashed 2026 partition; do not choose the
first matching filename. No network fetch or dashboard refresh is involved.
The original rounded mix CSV is moved byte-for-byte and remains supporting evidence.

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
reproduction test. Frozen-package validation, corruption checks, article/chart checks
and the original CSV's independently pinned SHA-256 always run.
Normal builds only read the frozen entity, never the live history or Git objects.

All eight periods are January 1–September 9 inclusive. Leap days remain included.
Prices are nominal DE-LU daily means weighted by local day length, not load. Renewable
shares are ratios of energy sums. The manifest documents units, source limitations,
missing-value policy and the unknown original retrieval timestamp (not invented).
Source commit time, observation cutoff and editorial preparation date are distinct.

`stromYtdValidation.js`, called by the chart config, enforces the exact payload
allowlist, regular files, hashes/sizes, CSV contracts, coverage and reconciled totals.
Hashes establish package consistency, not independent source authenticity.

The grouped mix chart uses just two year labels and two series, avoiding eleven
crowded mobile category labels. Both lines use explicit `seriesKeys` and colors,
with straight segments. Existing builders and public chart paths remain standard.
The headline comparison uses the reusable `comparison` type described below. The
post retains numeric backups for the historical lines and full source mix in closed
native disclosures. Methodology also starts closed; its Markdown headings, nested
lists and links render inside `<details class="post-methodology">` with blank lines
around the HTML boundary. Sources, scope and important causal limitations remain
in the visible article flow. Post-scoped inherited text colors fix nested lists in
both themes; disclosure summaries retain the native marker and keyboard behavior,
with a visible focus outline. Tables inside the numeric disclosures have cell
padding, separators and numeric alignment.

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
  label: 'Stromkennzahlen: jeweils 1. Januar bis 9. September',
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

Browser QA: `/posts/2026/strom-2026-ytd-zahlen/`; check the comparison and three
ECharts charts at 375px and desktop widths, dark mode, tooltips, legends, keyboard
focus, methodology and table expansion, and JavaScript disabled. Ingestion payloads
are not public download routes. This task deliberately leaves browser QA to the
coordinating agent's sequential session.
