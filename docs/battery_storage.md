# German battery storage: frozen article research

This is a manual blog workflow, **not a dashboard refresh**. It does not change
the daily publication workflow, its source selection or its ten-minute budget.
Nothing is committed or published by these commands.

## Scope and evidence

The draft is `frontend/src/posts/2026/batteriespeicher-wandel.md`. It is excluded
from collections and the sitemap, but renders at `/posts/2026/batteriespeicher-wandel/`
for review. Collection exclusion is not access control: deploying this branch
would make that route accessible. Review the text and remove the draft markers
deliberately before ordinary manual promotion.

The current validated source is the **11 September 2026** MaStR storage subset.
The latest included actual unit commissioning date is **10 September 2026**.
Reconstructed subset SHA-256:

```text
f4ee028817cf56c3ad079f4fd3c3f001a9e77baee8129a892981ee63aa7159d6
```

The official source URL is
`https://download.marktstammdatenregister.de/Gesamtdatenexport_20260911_26.1.zip`.
Acquisition was live-verified as `http_range_subset`: all **86 members** of the
five required families, without sampling. These are 28 parts each of
`EinheitenStromSpeicher`, `AnlagenStromSpeicher` and `AnlagenEegSpeicher`, plus
`Katalogwerte` and `Katalogkategorien`. This is the complete required storage
source, not the full 3,185,388,379-byte remote register ZIP. The hash above
identifies the reconstructed subset, not that full remote ZIP.

- HTTP acquisition: **91 requests, 680,466,813 bytes**.
- Local source ZIP: **680,364,600 bytes**; selected uncompressed members:
  **13,362,859,408 bytes**; source ETag: `"9e1270ae8c41dd1:0"`.
- Staging rows: **2,790,346** storage units, **2,790,264** storage plants,
  **2,733,656** EEG storage plants, **1,737** catalogue values and **123**
  catalogue categories, with exactly one provenance row.
- The plant model has **2,790,276 relations**, reconciling all source unit and
  plant rows. The 2,790,346 source units cover all storage technologies/statuses;
  they are not the selected operating battery count.
- New database: `pipeline/.data/mastr_battery_20260911.duckdb`. The June database
  was used read-only for comparison; the general database and June ZIP were preserved.

Frozen aggregate exports and provenance are under
`frontend/src/data_ingestion/data/2026/battery_storage/`. The independently verified
fresh export is `pipeline/.data/output/batteries_germany_20260911/` (ten data files
plus `battery_storage_metadata.json`). The metadata records every
data-file hash, model/test SQL hashes, exporter identity, source identity and
the separate electricity input identity. No unit/plant/operator records are
exported to the frontend. Source licensing: MaStR, Datenlizenz Deutschland –
Namensnennung 2.0; SMARD, CC BY 4.0. Both require attribution and identification
of our modifications.

## Interpretation and quality

The grain is a storage **plant**, with net kW summed from its linked units and
usable kWh counted once. Actual identifiers are `SEE` for units and `SSE` for
storage plants; the source dictionary is validated rather than inferred from
old fixture values. Cleaned materializations retain snapshot/hash identities;
stale cleaned data cannot be relabelled with a fresh source snapshot.

Operating and planned assets remain separate. Included operating plants must
be active German batteries with consistent identifiers, links and statuses;
finite power greater than 0.3 kW; finite usable energy greater than 0.3 kWh;
an energy/power ratio from 0.1 through 12 hours; and valid unit commissioning
dates from 1990 through the source snapshot. Missing quantities remain unknown.
Exclusion reasons and their count/power/energy impact are retained. These are
research plausibility screens, not a certified national inventory; there is
no operator-type correction or imputation.

Disjoint technical size proxies:

- Small: power <30 kW **and** energy <30 kWh.
- Large: power >=1,000 kW **or** energy >=1,000 kWh.
- Medium: all remaining included plants.

These are not proven household, commercial or utility ownership classes.
Commissioning cohorts contain plants still operating in the snapshot; current
whole-plant capacity is assigned to the earliest unit commissioning date.
They do not reconstruct historical stock, retirements or expansion dates.
Recent cohorts also suffer registration lag. Charts therefore focus on
2019–2025. The separately reported 2026 cohort is incomplete: **435,080 plants,
3.973667228 GW and 7.327640391 GWh**, with `period_complete=false` in the yearly
CSV. Do not annualize it or compare it as a full-year addition figure with 2025.
Calendar-period completeness does not imply registration completeness.

### Current operating fleet

The article's stock table uses `battery_storage_summary.csv`, separately from
commissioning cohorts. It includes all eligible commissioning years:

| Segment | Plants | Units | Power GW | Energy GWh | Median E/P hours |
|---|---:|---:|---:|---:|---:|
| Small | 2,708,524 | 2,708,525 | 14.823182201 | 23.419360690 | 1.84 |
| Medium | 27,650 | 27,650 | 0.812269588 | 1.735506554 | 2.56 |
| Large | 632 | 632 | 4.261751870 | 7.552860513 | 2 |
| Overall | 2,736,806 | 2,736,807 | 19.897203659 | 32.707727757 | 1.84 |

Planned plants are excluded from the frontend summary and other displayed
exports. The article therefore reports no planned capacity totals.

### Refreshed 2024–2025 argument

Values from `battery_storage_yearly.csv`:

| Cohort | Plants | Power GW | Energy GWh | Median E/P hours | Large energy GWh |
|---|---:|---:|---:|---:|---:|
| 2024 | 573,941 | 4.027361784 | 6.199238861 | 1.655172414 | 0.827139801 |
| 2025 | 562,181 | 3.960795735 | 6.759563553 | 1.920000000 | 1.735954590 |

Compute `(value_2025 / value_2024 - 1) * 100` from the CSV values before display
rounding. This gives (percentages shown to 12 decimal places):

- Plants: `(562181 / 573941 - 1) * 100` ≈ **−2.048991098388%**.
- Energy: `(6.759563553 / 6.199238861 - 1) * 100` ≈ **+9.038604650727%**.
- Large-segment energy: `(1.735954590 / 0.827139801 - 1) * 100` ≈
  **+109.874387364900%**.

The article rounds these to **−2.05%, +9.04% and +109.87%**. The core argument
survives the refresh: fewer plants but more energy, with the large segment's
increase outweighing the small segment's decline. It remains a snapshot cohort
comparison, not observed historical gross additions.

### Selected-operating quality impact

`battery_storage_quality.json` reports **2,749,125 selected operating units**
before screens and **12,318 excluded units (0.448069840404%)**. Known excluded
power is **0.023556207 GW / 19.920759866 GW (0.118249540472%)**; known excluded
energy is **0.921999724 GWh / 33.629727481 GWh (2.741621158009%)**. These are
finite positive relation-level capacity denominators, not estimates of unknown
capacity. There are **55 unknown/nonfinite energy relations** and **zero
mixed-selection relations**. Reasons overlap: 10,053 duration exclusions,
3,056 invalid/missing energy, 3,033 invalid/missing power, 522 invalid/missing
commissioning dates, and 10 each for identifier, plant, link and status issues.
Do not sum reasons or use the all-source exclusion sum as battery quality loss:
it includes non-battery technologies and other statuses. Unit-count exclusions
are distinct from the article's plant-count tables.

The price/solar illustration is separately frozen to **11 August–9 September
2026**, 720 hourly observations, with 30 observations per Berlin hour. This window
**precedes** the 11 September register snapshot. Input SHA-256:
`e2f5a68647bff876b6fe11344997bec89e6d28fcabc5bd30ea94aace40feb619`.
It is not a yearly pattern, battery dispatch measurement, causal estimate or profit model.

## Running manually

Run commands from `pipeline/` with `PYTHONPATH=.`. Use a compatible isolated
environment; verification used Python 3.11, DuckDB 1.1.1, dbt-core 1.8.8 and
dbt-duckdb 1.9.0, plus requests and Jinja2. The general developer dbt environment
had a pre-existing `dsi_pydantic_shim` import failure; an isolated environment
avoided modifying it.

Ingestion defaults to `.data/mastr_battery.duckdb`; explicitly select the dated
September database below to preserve the June comparison. It refuses the general
`.data/duckdb.db`, including filesystem aliases. Five source tables and one
provenance row are replaced transactionally only after validation.

```bash
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_mastr_data.py \
  --zip-path .data/raw/mastr/Gesamtdatenexport_20260911_26.1_battery_subset.zip \
  --export-url https://download.marktstammdatenregister.de/Gesamtdatenexport_20260911_26.1.zip \
  --snapshot-date 2026-09-11 \
  --database .data/mastr_battery_20260911.duckdb --raw-dir .data/raw/mastr \
  --download-seconds 600 --max-bytes 900000000 --max-requests 96 --retries 1 \
  --parse-seconds 1800
```

For a fresh manual retrieval, omit `--zip-path` and retain the pinned date and
dated URL. This path was successfully live-verified on 11 September within
the existing bounds: 600 download seconds, 900,000,000 HTTP bytes, 96 requests,
one retry per request; 1,800 parse seconds, 20,000,000,000 uncompressed bytes,
10,000,000 rows per table and 256 members. Do not silently increase budgets or
fall back to a multi-GB full download. The successful local recovery used the
validated ZIP above with its adjacent `.manifest.json` HTTP provenance sidecar.

Create a separate dbt profile outside tracked files, using this project's
`databearer_dbt` profile name, target `prod`, schema `prod`, type `duckdb`, and
an absolute path to `.data/mastr_battery_20260911.duckdb` and one thread. The
verified profile was
`/var/folders/k1/t0305t314372vqsc585ptywr0000gn/T/opencode/battery-20260911-profile/profiles.yml`.
Never use the unchanged general profile for the following build; substitute
your own isolated profile/target/log paths if replaying elsewhere:

```bash
TMP=/var/folders/k1/t0305t314372vqsc585ptywr0000gn/T/opencode
PYTHONPATH=. dbt build --target prod --profiles-dir "$TMP/battery-20260911-profile" \
  --project-dir src/data_pipelines/databearer_dbt \
  --target-path "$TMP/battery-20260911-target" --log-path "$TMP/battery-20260911-logs" \
  --vars '{battery_snapshot_date: "2026-09-11"}' \
  --select '+path:models/cleaned/mastr' \
           '+path:models/curated/energy_germany/fact_battery*' \
           '+path:tests/battery*'

PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py \
  --database .data/mastr_battery_20260911.duckdb \
  --electricity-snapshot ../frontend/src/_data/germanElectricity.json \
  --output-dir .data/output/batteries_germany_20260911
```

The export rejects a rotating electricity snapshot outside the frozen article
window. Recover the original input from Git commit
`dd0c7f8deef858a844be777a5fd1e78949386413` when needed; see the export directory's
README. It never refreshes or rewrites the live dashboard. After reviewing a
complete validated output set, explicitly select
`--output-dir ../frontend/src/data_ingestion/data/2026/battery_storage` to prepare tracked article
inputs. Validation happens before replacement; the manifest is promoted last.
Individual replacements are atomic, not the entire directory: verify the manifest
after interruption before using any mixed files.

## Checks and remaining work

```bash
PYTHONPATH=. python -m unittest discover -s tests -p 'test_mastr_ingestion.py' -v
PYTHONPATH=. python -m unittest discover -s tests -p 'test_battery_storage_*.py' -v
```

From `frontend/`: `npm test -- --runInBand`, `npm run lint`, `npm run build`,
then `BATTERY_STORAGE_BUILD_CHECK=1 npm test -- --runInBand tests/battery-storage-post.test.js`.

### Current acceptance: real 11 September refresh

- Complete live acquisition: 91 requests / 680,466,813 bytes, all 86 members
  downloaded, CRC/hash validated. Started at `2026-09-11T10:02:38Z`; validated
  acquisition recorded at `2026-09-11T10:05:53.023796+00:00`.
- The first ingestion then failed on BOM-marked **UTF-16LE** members declaring
  UTF-16. Its ASCII-compatible lexical guard rejected the first member and the
  staging transaction rolled back. The already validated ZIP/provenance survived.
- The parser fix incrementally and strictly decodes BOM-marked UTF-16 for lexical
  checks before feeding original bytes to Expat. Token/name/attribute/DTD/deadline
  bounds remain enforced. Regression tests cover both byte orders, one-byte reads,
  surrogate pairs, oversized tokens, malformed/truncated encodings, declarations
  and UTF-32 rejection; new regressions failed before the fix and passed after it.
- **49 ingestion + 39 model/export offline tests = 88 passing tests** after the fix.
- Local recovery began at `2026-09-11T10:07:04Z`, reusing the ZIP with **no second
  network acquisition**, and completed successfully in 479.50 seconds. Initial
  download/validation plus immediate parse failure took 195.23 seconds.
- Fresh focused dbt build: **10 materialized models and 25 tests passed**, zero
  errors/skips. The ephemeral freshness check was included through ancestry.
  dbt took 23.88 seconds internally / 26.13 seconds CLI wall time.
- All seven singular tests passed again read-only at export. The isolated export
  completed in 1.45 seconds; its manifest records per-file hashes and model/test
  identities. New data artifacts are Git-ignored.
- Article values and percentage calculations were checked against the fresh
  yearly, summary, cohort, quality and metadata exports. On Node 20.20.2, the
  migrated September frontend passed 398 tests, lint and production build;
  all 44 focused post-build checks passed. All five charts rendered at 1,280 px
  and 390 px without horizontal page overflow, with September dates and updated
  cohort values. The draft remains excluded from feeds, search and indexes.
- No commit, push or publication was performed for this refresh.

Build-time battery validation verifies all ten data files against their manifest
before chart generation, rejecting incomplete or mixed sets. Keep the draft's
collection/sitemap exclusions and route while reviewing the refreshed frontend.

### Historical June baseline and earlier checks

The **30 June 2026** source remains a valid historical record. Its local subset
was user-supplied, with verified SHA-256
`ac21af97af411566af5377b08f91e023b8631733d0b70371f0ec0ecb0cab4f7c`, and source URL
`https://download.marktstammdatenregister.de/Gesamtdatenexport_20260630_26.1.zip`.
It was not a verified fresh HTTP retrieval. Its database is
`pipeline/.data/mastr_battery.duckdb`; the raw June archive was preserved.

The June operating selection contained 2,566,415 plants, 18.162091618 GW and
29.480829592 GWh. Its 2024/2025 cohorts contained 573,235/559,016 plants and
6.178516442/6.714984165 GWh; their large segments held 0.824289801/1.746097850 GWh.
The September audit therefore revises 2024 by +706 plants/+0.020722419 GWh and
2025 by +3,165 plants/+0.044579388 GWh. These are snapshot revisions, not measured
new installations between snapshots. June's quality exclusion shares were
0.452313876% of selected operating units and 4.574549880% of known energy.

The earlier fresh-download attempt exhausted the 96-request budget during header
preflight. The subsequent one-streamed-request-per-member change was initially
tested offline only; the successful September acquisition above now supplies
live evidence. The later UTF-16 failure and local recovery are separate steps.

Earlier acceptance on 11 September, **using June battery data**, recorded:

- 47 ingestion and 39 model/export offline tests; real June dbt build:
  10 models and 25 tests passed.
- Node 20.20.2: 16 frontend suites, 396 tests passed (one build-only test skipped
  before build); lint and production build passed; all 42 focused post-build
  battery checks passed.
- Browser: all five charts at 1,280 px and 390 px, expected series lengths,
  no horizontal page overflow and no console errors. Draft exclusion from feeds,
  search, sitemap and indexes was verified.
- Unrelated electricity selection compiled without battery variables; selecting
  battery models without an explicit date failed as intended.

Remaining editorial work: assess residual outliers and operator-type sensitivity,
review the refreshed headline/copy, and optionally add an original card image.
The read-only June–September audit exists; a historical stock time series and a
full-year electricity profile remain future work.
