# Frozen battery article exports

Run from `pipeline/` with `duckdb` and `jinja2` installed:

```sh
PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py
```

Defaults: `--database .data/mastr_battery.duckdb`,
`--output-dir .data/output/batteries_germany`. The database is opened read-only,
with one execution thread. To explicitly write the complete article export set:

```sh
PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py \
  --output-dir ../frontend/src/data_ingestion/data/2026/battery_storage
```

`--electricity-snapshot` (legacy alias `--electricity-input`) defaults to `frontend/src/_data/germanElectricity.json`
(resolved relative to the repository). It must be the frozen September 10, 2026
snapshot covering August 11–September 9 in Europe/Berlin; an advancing dashboard
window is rejected. For later reproduction, retain those original input bytes
outside Git and supply that path. Recover the original tracked bytes from commit
`dd0c7f8deef858a844be777a5fd1e78949386413` after the live window rotates. From
`pipeline/`, this writes only an ignored frozen input, not the dashboard:

```sh
mkdir -p .data/frozen/batteries_germany
git show dd0c7f8deef858a844be777a5fd1e78949386413:frontend/src/_data/germanElectricity.json \
  > .data/frozen/batteries_germany/germanElectricity.json
PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py \
  --electricity-snapshot .data/frozen/batteries_germany/germanElectricity.json
```

Keep the basename `germanElectricity.json` to reproduce the manifest filename as
well as the input hash. The exporter revalidates the original hourly input rather
than accepting a previously aggregated profile. The manifest records SHA-256 and semantic
content hash, independently of the MaStR June 30 snapshot and archive hash.
This exporter has no network requests or raw-record outputs.

## Chart contracts

UTF-8 comma-delimited CSV, header, LF endings, decimal point, no thousands
separators. Rows sort ascending; finite numbers have up to nine decimal places.

| Filename | Exact columns | Rows |
| --- | --- | --- |
| `battery_storage_cohorts.csv` | `Jahr,Anzahl_Index,Energie_Index,Anzahl,Leistung_GW,Energie_GWh` | 2019–2025, seven rows; both indices 2024=100 |
| `battery_storage_segments.csv` | `Jahr,Klein_GWh,Mittel_GWh,Gross_GWh` | 2019–2025, seven rows |
| `battery_storage_duration.csv` | `Jahr,Median_Stunden` | 2019–2025, seven rows; unweighted plant median |
| `battery_storage_daily_profile.csv` | `Stunde,Preis_EUR_MWh,Solar_GW` | `00:00`–`23:00`, 24 rows; arithmetic mean of 30 observations per Berlin hour |

The yearly data describe **commissioning cohorts of plants still operating at the
MaStR snapshot**, with current whole-plant capacity attributed to the earliest
unit commissioning date. They are not historical stock or gross annual additions.
Small means both power <30 kW and energy <30 kWh; large means power >=1,000 kW
or energy >=1,000 kWh; medium is the remainder. These are size classes, not proven
household/commercial/grid-use classifications. Duration is usable kWh/net kW,
not measured operation. The electricity profile is not battery dispatch or revenue.

## Supporting CSV contracts

Common measures (in this order):
`plant_count,unit_count,power_gw,energy_gwh,median_duration_hours,network_verified_plant_count`.

| Filename | Columns before common measures | Columns after common measures |
| --- | --- | --- |
| `battery_storage_yearly.csv` | `snapshot_date,commissioning_year,size_segment` | `period_complete` |
| `battery_storage_monthly.csv` | `snapshot_date,commissioning_month,size_segment` | `period_complete` |
| `battery_storage_by_state.csv` | `snapshot_date,state,size_segment` | none |
| `battery_storage_summary.csv` | `snapshot_date,operating_status,size_segment` | none |

Dates are ISO dates, months use day 01, segments are `small`, `medium`, `large`,
`overall`. Summary contains operating stock only. State `Unknown` remains explicit.
Full cohort files contain every observed period, without filling absent periods
with zero. `period_complete` is `true`/`false`; snapshot-year and incomplete
snapshot-month rows are flagged, never annualized. Calendar completeness does not
imply registration completeness. Overall capacity/counts reconcile with segments,
years with months, and all stock aggregates with each other (1e-8 GW/GWh tolerance).

`battery_storage_duration_distribution.csv` has exact columns:

```text
Jahr,Segment,Anzahl,P10_Stunden,P25_Stunden,Median_Stunden,P75_Stunden,P90_Stunden
```

It contains 28 rows: seven completed years × three segments plus overall, with
continuous plant-level quantiles and counts reconciled to the yearly model.

## Quality, provenance, promotion

- `battery_storage_quality.json`: before/included/excluded aggregate reports for
  relations touching active German operating battery units only. Mixed-selection
  relations are counted explicitly. Known positive capacity sums are not estimates
  of unknown values. Reason counts overlap and cannot be added. Giant non-battery
  records from the full-source quality model are outside this report's scope.
- `battery_storage_metadata.json`: publication manifest with source date/URL/
  filename/archive hash, separate electricity input provenance/window/time grain,
  methodology/version, model/test/exporter hashes, DuckDB version, stock totals,
  and exact SHA-256/byte size/CSV contracts for all ten data files. No wall-clock
  export timestamp makes repeat runs over identical inputs byte-reproducible.

All seven current `battery_*.sql` singular dbt tests (plus any future matching
tests) are rendered with Jinja `execute=True` and executed as read-only queries
before export. The seven named required tests must exist. This includes cleaned
row date/archive-hash provenance and operating/planned summary reconciliation.
`mastr_battery_freshness` is additionally evaluated inline from its current
ephemeral SQL; references to it are expanded, never read from a cached table.
Missing SQL, unsupported configuration, or a non-true freshness result stops export.
Additional export guards cover unique keys, finite metrics, source/aggregate
dates, completed article-year coverage, and cross-aggregate reconciliation.

The entire set is staged and verified before any target data file changes.
Validation failure preserves existing outputs. Promotion uses individual file
replacements with the manifest last, and attempts rollback on ordinary I/O errors.
It is **not a directory-atomic operation**: interruption may leave mixed files.
Consumers must call `verify_set(Path(output_dir))` (or verify every manifest hash)
before accepting a set, and regenerate the whole set if verification fails.
Unrelated files are ignored and preserved.

Tests from `pipeline/`:

```sh
PYTHONPATH=. python -m unittest discover -s tests -p test_battery_storage_export.py -v
```
