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
The post supplies static tables for every plotted value and the full source mix.
Browser QA: `/posts/2026/strom-2026-ytd-zahlen/`; check all three charts at 375px and
desktop widths, dark mode, tooltips, legends and table expansion. Ingestion payloads
are not public download routes. This task deliberately leaves browser QA to the
coordinating agent's sequential session.
