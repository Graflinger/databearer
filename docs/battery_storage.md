# German battery storage: frozen article research

This is a manual blog workflow, **not a dashboard refresh**. It does not change
the daily publication workflow, its source selection or its ten-minute budget.
Nothing is committed or published by these commands.

## Scope and evidence

The article is `frontend/src/posts/2026/batteriespeicher-wandel.md`, published
(draft markers removed on 26 September 2026 after editorial approval) and part of
collections, feeds, search and the sitemap. It goes live through the ordinary
manual promotion to `releases/cloudflare`.

The current validated source is the **26 September 2026** MaStR storage subset.
The latest included actual unit commissioning date is **26 September 2026**.
Reconstructed subset SHA-256:

```text
d01a4ba35010335927f4d6a134778e47991fcc2bb3a781d4009be960324d602e
```

The official source URL is
`https://download.marktstammdatenregister.de/Gesamtdatenexport_20260926_26.1.zip`.
Acquisition was live-verified as `http_range_subset`: all **88 members** of the
five required families, without sampling: 29 parts each of
`EinheitenStromSpeicher` and `AnlagenStromSpeicher`, 28 parts of
`AnlagenEegSpeicher`, plus `Katalogwerte` and `Katalogkategorien`. This is the
complete required storage source, not the full 3,209,751,993-byte remote register
ZIP. The hash above identifies the reconstructed subset, not that full remote ZIP.

- HTTP acquisition: **93 requests, 689,032,446 bytes** (budget 96 requests /
  900,000,000 bytes); retrieved `2026-09-26T21:21:49Z`.
- Local source ZIP: **688,929,803 bytes**; selected uncompressed members:
  **13,529,434,442 bytes**; source ETag: `"f668981f574ddd1:0"`.
- Staging rows: **2,824,640** storage units, **2,824,559** storage plants,
  **2,767,702** EEG storage plants, **1,737** catalogue values and **123**
  catalogue categories, with exactly one provenance row.
- The plant model has **2,824,571 relations**. The 2,824,640 source units cover
  all storage technologies/statuses; they are not the selected operating battery count.
- New database: `pipeline/.data/mastr_battery_20260926.duckdb`. Earlier dated
  databases and ZIPs were preserved.

Frozen aggregate exports and provenance are under
`frontend/src/data_ingestion/data/2026/battery_storage/`. The independently verified
fresh export is `pipeline/.data/output/batteries_germany_20260926/` (ten data files
plus `battery_storage_metadata.json`), byte-identical to the tracked set. The
metadata records every data-file hash, model/test SQL hashes, exporter identity,
source identity and the separate electricity input identity. No unit/plant/operator
records are exported to the frontend.

Source licensing: MaStR, Datenlizenz Deutschland – Namensnennung 2.0 (attribution
"Bundesnetzagentur, Marktstammdatenregister", licence link, note of own
modifications); SMARD, CC BY 4.0 with the mandated attribution
"Bundesnetzagentur | SMARD.de". The article lists both with licence links.

Editorial decision (26 September 2026): the article does not name or link any
third-party methodology. The plausibility screens and size classes below are
described in the article only in simplified form ("unplausible or missing values
removed; <1 % of plants, ~4 % of capacity; totals therefore slightly low"). The
detailed rules, counts and shares stay in this document.

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
2019–2025. The separately reported 2026 cohort is incomplete: **466,762 plants,
4.291020297 GW and 7.902219936 GWh**, with `period_complete=false` in the yearly
CSV. Calendar-period completeness does not imply registration completeness.

The article shows 2026 in its own section and table (not in the charts), always
labelled "bis 26. September"/unvollständig. It may be compared with full 2025
only as an already-reached level that late registrations would typically raise
(e.g. large-segment energy 3.768157450 GWh vs 1.737298590 GWh in 2025; 215 vs
131 large plants; total 7.902 vs 6.768 GWh). Never annualize it or present it as
a full-year addition figure. Large-segment energy exceeds small-segment energy
(3.694521683 GWh) in 2026 and otherwise only in 2016 (0.121711 vs 0.0753586 GWh,
a tiny market); the article says "erstmals seit 2016".

### Current operating fleet

The article's stock table uses `battery_storage_summary.csv`, separately from
commissioning cohorts. It includes all eligible commissioning years:

| Segment | Plants | Units | Power GW | Energy GWh | Median E/P hours |
|---|---:|---:|---:|---:|---:|
| Small | 2,740,190 | 2,740,191 | 15.008280735 | 23.710404080 | 1.84 |
| Medium | 28,178 | 28,178 | 0.829080754 | 1.774300432 | 2.56 |
| Large | 652 | 652 | 4.384160870 | 7.814413713 | 2 |
| Overall | 2,769,020 | 2,769,021 | 20.221522359 | 33.299118225 | 1.84 |

Planned plants are excluded from the frontend summary and other displayed
exports. The article therefore reports no planned capacity totals. Article tables
round GW/GWh to three decimals and medians to two; a note covers rounding gaps.

### Refreshed 2024–2025 argument

Values from `battery_storage_yearly.csv`:

| Cohort | Plants | Power GW | Energy GWh | Median E/P hours | Large energy GWh |
|---|---:|---:|---:|---:|---:|
| 2024 | 574,051 | 4.028811855 | 6.202971356 | 1.655172414 | 0.827139801 |
| 2025 | 562,472 | 3.964645995 | 6.768137764 | 1.920000000 | 1.737298590 |

Compute `(value_2025 / value_2024 - 1) * 100` from the CSV values before display
rounding:

- Plants: `(562472 / 574051 - 1) * 100` ≈ **−2.017068170%**.
- Energy: `(6.768137764 / 6.202971356 - 1) * 100` ≈ **+9.111220664%**.
- Large-segment energy: `(1.737298590 / 0.827139801 - 1) * 100` ≈
  **+110.036875012%**.
- Mean energy per plant: 10.806 kWh (2024) → 12.033 kWh (2025).

The article rounds these to **−2.02%, +9.11% and +110.04%**. The core argument
survives the refresh: fewer plants but more energy, with the large segment's
increase outweighing the small segment's decline. It remains a snapshot cohort
comparison, not observed historical gross additions.

### Selected-operating quality impact

`battery_storage_quality.json` reports **2,781,756 selected operating units**
before screens and **12,735 excluded units (0.457804351%)**. Known excluded
power is **0.038839353 GW / 20.260361712 GW (0.191701183%)**; known excluded
energy is **1.272975548 GWh / 34.572093773 GWh (3.682089828%)**. These are
finite positive relation-level capacity denominators, not estimates of unknown
capacity. There are **55 unknown/nonfinite energy relations** and **zero
mixed-selection relations**. Reasons overlap: 10,439 duration exclusions,
3,105 invalid/missing energy, 3,067 invalid/missing power, 530 invalid/missing
commissioning dates, and 10 each for identifier, plant, link and status issues.
Do not sum reasons or use the all-source exclusion sum as battery quality loss:
it includes non-battery technologies and other statuses. Unit-count exclusions
are distinct from the article's plant-count tables.

The price/solar illustration is separately frozen to **27 August–25 September
2026** (the dashboard window of the 26 September snapshot, schema v2 with all
components complete), 720 hourly observations, with 30 observations per Berlin
hour. Input SHA-256:
`a5925adc1cb9f0f860dbafeaf747b4d6b14c65f44f41174558e7819c57deb0c5`; tracked at
commit `c49ce4dafb61f6c33418cabdd90c70c8c13316a6`. Mean day-ahead price is lowest
at 13:00 (37.94 EUR/MWh) and highest at 19:00 (248.93 EUR/MWh); mean solar peaks
at 12:00 (37.20 GW). The article names this the "Duck Curve" (originally a residual-load
concept; in this window mean load minus wind and solar falls to ~2 GW at 13:00 and
rises to ~37.5 GW at 19:00, computed from the same frozen input but not exported). It is not a yearly pattern, battery dispatch measurement,
causal estimate or profit model.

## Running manually

Run commands from `pipeline/` with `PYTHONPATH=.`. Use a compatible isolated
environment; verification used Python 3.11, DuckDB 1.1.1, dbt-core 1.8.8 and
dbt-duckdb 1.9.0, plus requests and Jinja2. The general developer dbt environment
had a pre-existing `dsi_pydantic_shim` import failure; an isolated environment
avoided modifying it.

Ingestion defaults to `.data/mastr_battery.duckdb`; explicitly select a dated
database as below to preserve earlier snapshots for comparison. It refuses the general
`.data/duckdb.db`, including filesystem aliases. Five source tables and one
provenance row are replaced transactionally only after validation.

```bash
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_mastr_data.py \
  --zip-path .data/raw/mastr/Gesamtdatenexport_20260926_26.1_battery_subset.zip \
  --export-url https://download.marktstammdatenregister.de/Gesamtdatenexport_20260926_26.1.zip \
  --snapshot-date 2026-09-26 \
  --database .data/mastr_battery_20260926.duckdb --raw-dir .data/raw/mastr \
  --download-seconds 600 --max-bytes 900000000 --max-requests 96 --retries 1 \
  --parse-seconds 1800
```

For a fresh manual retrieval, omit `--zip-path` and retain the pinned date and
dated URL. This path was successfully live-verified on 11 and 26 September within
the existing bounds: 600 download seconds, 900,000,000 HTTP bytes, 96 requests,
one retry per request; 1,800 parse seconds, 20,000,000,000 uncompressed bytes,
10,000,000 rows per table and 256 members. Do not silently increase budgets or
fall back to a multi-GB full download. The 26 September run used 93 of 96
requests: the member count grows as the register grows (88 members now), so a
future refresh may need an explicitly agreed request budget. A local replay uses
the validated ZIP above with its adjacent `.manifest.json` HTTP provenance sidecar.

Create a separate dbt profile outside tracked files, using this project's
`databearer_dbt` profile name, target `prod`, schema `prod`, type `duckdb`, and
an absolute path to `.data/mastr_battery_20260926.duckdb` and one thread. The
verified profile was
`/var/folders/k1/t0305t314372vqsc585ptywr0000gn/T/opencode/battery-20260926-profile/profiles.yml`.
Never use the unchanged general profile for the following build; substitute
your own isolated profile/target/log paths if replaying elsewhere:

```bash
TMP=/var/folders/k1/t0305t314372vqsc585ptywr0000gn/T/opencode
PYTHONPATH=. dbt build --target prod --profiles-dir "$TMP/battery-20260926-profile" \
  --project-dir src/data_pipelines/databearer_dbt \
  --target-path "$TMP/battery-20260926-target" --log-path "$TMP/battery-20260926-logs" \
  --vars '{battery_snapshot_date: "2026-09-26"}' \
  --select '+path:models/cleaned/mastr' \
           '+path:models/curated/energy_germany/fact_battery*' \
           '+path:tests/battery*'

git show c49ce4dafb61f6c33418cabdd90c70c8c13316a6:frontend/src/_data/germanElectricity.json \
  > .data/frozen/batteries_germany_20260926/germanElectricity.json
PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py \
  --database .data/mastr_battery_20260926.duckdb \
  --electricity-snapshot .data/frozen/batteries_germany_20260926/germanElectricity.json \
  --output-dir .data/output/batteries_germany_20260926
```

The export rejects a rotating electricity snapshot outside the frozen article
window (27 August–25 September 2026; schema v1 or v2, v2 requiring complete
`solar` and `price` components). Recover the original input from Git commit
`c49ce4dafb61f6c33418cabdd90c70c8c13316a6` as shown; see the export directory's
README. Moving the window for a future refresh is a deliberate exporter,
frontend-validation and test change. It never refreshes or rewrites the live dashboard. After reviewing a
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

### Current acceptance: real 26 September refresh

- Complete live acquisition: 93 requests / 689,032,446 bytes, all 88 members
  downloaded and CRC/hash validated; ingestion loaded all five tables in one run.
- Fresh focused dbt build (Python 3.11, DuckDB 1.1.1, dbt-core 1.8.8, dbt-duckdb
  1.9.0): **10 materialized models and 25 tests passed**, zero errors/skips.
- All seven singular tests passed again read-only at export; scratch and tracked
  export sets are byte-identical.
- Offline pipeline tests: 49 ingestion + 39 model/export = **88 passing**.
- The branch was merged with current `main` (drafts produce no production HTML;
  deferred scripts; `.table-scroll` regions). Frontend on Node 20.20.2:
  full Jest suite, lint and production build passed; all 44 focused
  `BATTERY_STORAGE_BUILD_CHECK=1` checks passed.
- Article copy was revised for the blog's narrative style (plain headings,
  rounded body figures, `aria-labelledby` chart headings) without changing the
  documented caveats, extended with the partial 2026 section, and published.
- Browser check (Chromium, 1,280 px and 390 px): all five charts render, no
  console errors, no horizontal overflow.
- No commit, push or publication was performed by the refresh itself.

Build-time battery validation verifies all ten data files against their manifest
before chart generation, rejecting incomplete or mixed sets.

### Historical 11 September baseline

The **11 September 2026** subset (SHA-256
`f4ee028817cf56c3ad079f4fd3c3f001a9e77baee8129a892981ee63aa7159d6`, 86 members,
91 requests) remains a valid historical record in
`pipeline/.data/mastr_battery_20260911.duckdb`. It contained 2,736,806 operating
plants, 19.897203659 GW and 32.707727757 GWh; 2024/2025 cohorts of 573,941/562,181
plants and 6.199238861/6.759563553 GWh (−2.05%, +9.04%, large +109.87%). The
26 September snapshot revises 2024 by +110 plants/+0.003732495 GWh and 2025 by
+291 plants/+0.008574211 GWh. These are snapshot revisions, not measured new
installations between snapshots. Its first ingestion exposed the BOM-marked
UTF-16LE parser issue, which was fixed with regression tests.

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

Possible follow-ups: assess residual outliers and operator-type sensitivity,
and refresh once 2026 is complete. Card image: `frontend/src/images/blog_card_images/2026/batteriespeicher-wandel.png` (Azure MAI-Image-2.5, 1408×800).
The read-only June–September audit exists; a historical stock time series and a
full-year electricity profile remain future work.
