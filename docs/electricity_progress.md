# Electricity progress: capacity, statutory milestones and congestion

`pipeline/src/data_pipelines/dashboards/german_electricity/progress.py` produces
`frontend/src/_data/germanElectricityProgress.json`. This is a standalone,
standard-library-only snapshot: one compact source CSV per manual/monthly refresh,
no DuckDB, dbt, new dependency or daily workflow integration. Publication retains
the manual release gate. The authorized [daily publisher](dashboard_publication.md)
refreshes recent/history/trade only; progress is outside its write allowlist. Daily
build/public verification reads this existing snapshot without fetching its source
or advancing its observation dates. Review and manually promote progress changes
separately, reconciling release ancestry into `main` first when needed.

## Commands and bounded refresh

From `pipeline/`, with that directory on `PYTHONPATH`:

```bash
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.progress refresh
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.progress refresh --output /existing/directory/progress.json
PYTHONPATH=. python -m unittest discover -s tests -p 'test_german_electricity_progress.py' -v
```

The output parent must already exist. The CLI uses the current Europe/Berlin date;
there is no historical-vintage/as-of CLI or database prerequisite. Refresh at most
monthly or explicitly by hand. Every run reconstructs the selected data from the
single CSV; previous output is only for validation/change detection and protection
against coverage regression. Revisions to any source year/month are accepted.

- Explicit endpoint: <https://www.smard.de/resource/blob/217306/-/data-csv-data.csv>.
  No endpoint discovery, chart-page requests, statutory requests or fallback source
  during refresh. If the blob ID or format changes, manually reverify the official
  chart metadata and update `CSV_URL`/the schema configuration.
- Reuses `SmardClient`: one GET normally, at most **three attempts total**, only
  transient network/429/500/502/503/504 errors retried with 1/2-second backoff.
  **15-second fetch deadline**, socket timeout clipped to remaining time; shared
  socket teardown/backoff can add small overhead, so this is not a process SLA.
- **2,000,000 bytes per response and cumulatively across attempts**; streamed reads
  check byte/time budgets. **150,000-byte export cap**. Raw bytes stay in memory.
- UTF-8 (optional BOM), semicolon-separated, headerless multi-group CSV, parsed by
  `csv.reader(strict=True)`, including quoted fields/newlines. Baseline audit:
  **759,184 bytes, 23,607 records, 132 distinct groups**. Exactly 132 groups are
  required until manual format review. Unrelated group contents, including their
  headers/footers, are ignored; blank records are skipped. No generic header/footer
  exemption exists inside a selected group.
- All four required groups must exist. Every row in each selected group must have
  the exact width, valid period and finite, nonnegative decimal values, including
  unexported capacity categories and current-year/current-month rows. Missing values
  never become zero. A genuine numeric zero is retained.
- Periods must be ascending and consecutive from their documented start; duplicate,
  missing, reordered, non-month-start, invalid or future periods fail. Monthly
  congestion and redispatch must have identical raw period sequences. Per-group
  caps: 100 yearly or 600 monthly rows. Numeric corruption ceiling: 1,000,000 source
  units (1,000 GW after capacity conversion); these are guards, not forecasts.
- Capacity is intentionally pinned to **2011–2025**, always completed Berlin years.
  The source's 2026 row is validated but never exported, even after year rollover:
  it must not silently turn into a year-end observation without metadata review.
  Annual congestion exports completed years from 2015; monthly congestion exports
  completed calendar months from July 2022. Minimum accepted coverage is 2025 for
  annual congestion and May 2026 for monthly congestion. Older/truncated baselines
  fail, and subsequent output may never regress either congestion watermark.

## Licensing and independently verified capacity metadata

Attribution is the exact existing `pipeline.py` `SOURCE` object:
**Bundesnetzagentur | SMARD.de — CC BY 4.0**, including its existing source,
license and terms URLs. `source_csv` separately identifies the actual compact data.

`license_evidence` is the [September 2026 SMARD handbook](https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf),
verified **10 September 2026**:

- **Printed page 6 (PDF page 7)**: the introduction states broadly that data
  published on SMARD and visualizations created from them can be downloaded,
  stored and reused under Creative Commons Attribution 4.0 International. It
  explicitly also mentions monitoring data in **Energiedaten kompakt**.
- **Printed page 12 (PDF page 13)**: the compact section describes monitoring
  data, chart export and table export in **XLSX and CSV**.
- This is the compact-data licensing evidence, rather than relying solely on the
  narrower market-data wording elsewhere in the handbook. Modifications here are
  selecting series/periods, joining monthly series, MW→GW conversion and JSON
  serialization. Statutory milestones have their own official legal sources.

The [official compact capacity chart](https://www.smard.de/page/home/topic-article/211972/212382/entwicklung-der-nettonennleistung)
was inspected directly, including inline JavaScript `.set_data("s-ent_nettonl-1-1")`,
`.set_locale`, series order, unit **MW** and source attribution **Kraftwerksliste
der Bundesnetzagentur**. Its own German subtitle states:

> Der Wert für das Jahr 2026 wurde zum Stichtag 26.06.2026 abgefragt.

The article text states that capacity has been recorded **jeweils zum 31.12. seit
2011**, covering capacity **am Strommarkt und außerhalb des Strommarktes**. Its
note states **all values are provisional, evaluated on 26.06.2026**. Thus the
compact chart's verified evaluation date is **2026-06-26**, and the exported
latest observation is **2025-12-31**. This is not a retrieval timestamp. No
hour/minute publication timestamp is supplied by that chart. Neither a date nor
values from the separate BNetzA portal chart are substituted; its values differ.

The evaluation date is documented as the manually inspected baseline, not emitted
as an automatically maintained source-release date: the raw CSV contains no release
metadata. Future CSV revisions must not inherit a falsely current release date.

Exact 18 numeric value columns, zero-based after group ID and year:

| Index | Official series | Export |
| ---: | --- | --- |
| 0 | Sonstige Energieträger | validated only |
| 1 | Mineralölprodukte | validated only |
| 2 | Wärme | validated only |
| 3 | Grubengas | validated only |
| 4 | Geothermie | validated only |
| 5 | Batteriespeicher | `battery_gw` |
| 6 | Abfall | validated only |
| 7 | Pumpspeicher | `pumped_storage_gw` |
| 8 | Erdgas | validated only |
| 9 | Steinkohle | validated only |
| 10 | Braunkohle | validated only |
| 11 | Kernenergie | validated only |
| 12 | Photovoltaik | `solar_gw` |
| 13 | Wind Onshore | `wind_onshore_gw` |
| 14 | Wind Offshore | `wind_offshore_gw` |
| 15 | Wasser | validated only |
| 16 | Biomasse | validated only |
| 17 | Wasserstoff | validated only |

MW values are divided by 1,000 and rounded to eight decimal places. Headerless
numeric data cannot independently reveal a same-width upstream column permutation;
the mapping is pinned to this manually verified official chart, with sentinel tests
against accidental code reordering. Reverify it when source configuration changes.

### Geographic and storage scope

The official [Kraftwerksliste scope](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Versorgungssicherheit/Erzeugungskapazitaeten/Kraftwerksliste/start.html)
explicitly includes foreign capacity in **Denmark, Luxembourg, Austria and
Switzerland feeding the German grid**, alongside German units and aggregated small
units/wind/PV. It explicitly excludes **small storage below 13.2 kW** and emergency
generators predominantly not feeding the public grid. This page is used to explain
scope, not to supply compact observations or their date.

Use **“Gemeldete Kraftwerksliste – Nettonennleistung”**, not a certified geographic
Germany total. The compact CSV has no country dimension to remove foreign units;
their exact contribution to each exported series is not established. Battery power
is not all German battery storage and omits small household systems below the
threshold. Both battery and pumped storage are **power in GW**, not energy capacity
in GWh, usable duration, discharge generation or an adequacy guarantee.

## Separate statutory baseline

Verified manually on **2026-09-10**, fixed until explicit legal review. Routine
refresh does not fetch laws. These are statutory milestones, not measurements,
forecasts or interpolated annual targets.

| Year | PV GW, EEG §4 | Onshore GW, EEG §4 | Offshore minimum GW, WindSeeG §1 |
| ---: | ---: | ---: | ---: |
| 2024 | 88 | 69 | — |
| 2026 | 128 | 84 | — |
| 2028 | 172 | 99 | — |
| 2030 | 215 | 115 | ≥30 |
| 2035 | 309 | 157 | ≥40 |
| 2040 | 400 | 160 | — |
| 2045 | — | — | ≥70 |

Official sources: [EEG 2023 §4](https://www.gesetze-im-internet.de/eeg_2014/__4.html)
and [WindSeeG §1(2)](https://www.gesetze-im-internet.de/windseeg/__1.html).
EEG requires maintaining the respective 2040 PV/onshore level afterward; this is
`maintain_after_year: 2040`, not an invented 2060 milestone. Offshore targets concern
grid-connected installations and explicitly say **mindestens**.

**Do not compute an achievement ratio from these observed and target series.**
In particular, PV statutory installed/module capacity and reported net rated power
have different measurement bases (DC module rating versus net output); geographic
scope and reporting dates also differ. Present each on its own stated basis.

## Congestion definitions and source groups

All selected congestion charts explicitly give numeric series in this order:
**Energiemengen (GWh), Kosten (Mio. Euro)**. Preserve these units without scaling.

| Group | Official compact chart | Coverage in initial snapshot |
| --- | --- | --- |
| `s-nepm_entw-2-2` | [Entwicklung des Netzengpassmanagements](https://www.smard.de/page/home/topic-article/211972/217842/entwicklung-des-netzengpassmanagements) | 2015–2025, 11 years |
| `s-nepm_nepm-2-2x` | [Netzengpassmanagement](https://www.smard.de/page/home/topic-article/211972/213328/netzengpassmanagement) | 2022-07–2026-05, 47 months |
| `s-nepm_re_mk-2-2x` | [Redispatch mit Marktkraftwerken](https://www.smard.de/page/home/topic-article/211972/213270/redispatch-mit-marktkraftwerken) | same 47 months |

The annual and both monthly `.set_data`, `.set_locale`, units and series order were
verified directly on those official pages. Total congestion includes redispatch
with market and reserve plants and countertrading; it covers TSO/DSO measures,
including cross-border measures. **`redispatch_*` means market-plant redispatch**,
including conventional and renewable plants, **excluding grid-reserve costs**.
It is not all redispatch including reserves and not renewable-only curtailment.

Energy is the **volume of measures**, including increases and reductions, not
lost renewable generation. Costs include net/saldierte amounts: market-plant
redispatch accounts for avoided fuel proceeds; countertrading nets costs/revenues.
Reserve costs include operation and availability. Since 2022, former renewable
feed-in management is incorporated in Redispatch 2.0; the official history page
documents the methodological transition from October 2021. Do not interpret a
series break as a pure physical change or a cost total as solely compensation for
curtailment.

Annual source aggregates are kept independently of monthly source values. Their
vintages/rounding can differ from monthly sums and older editorial articles. For
example, the current compact annual 2025 values are **30,327 GWh / €3,058 million**;
the March 2026 article reported 30,319 / 3,071. The CSV is the selected evidence;
no forced reconciliation, overwrite from article prose or sum-to-year equality
assumption is applied. There is no renewable-curtailment extra dataset.

## Exact frontend contract: schema 1

All objects have exactly the fields below; numeric observations are required,
finite and nonnegative, never strings/null/booleans. Rows ascend consecutively.

```text
{
  schema_version: 1,
  kind: "german-electricity-progress",
  source: SOURCE,
  source_csv: CSV_URL,
  license_evidence: LICENSE_EVIDENCE,
  capacity: {
    reference: "year_end", unit: "GW", scope: CAPACITY_SCOPE,
    source_url: CAPACITY_URL, provisional: true,
    data_through: "2025-12-31",
    rows: [{year, solar_gw, wind_onshore_gw, wind_offshore_gw,
            battery_gw, pumped_storage_gw}, ...]
  },
  targets: {
    verified_on: "2026-09-10", unit: "GW", kind: "statutory_baseline",
    solar: {source_url: EEG_URL, comparison: "target", maintain_after_year: 2040,
            rows: [{year, capacity_gw}, ...]},
    wind_onshore: {source_url: EEG_URL, comparison: "target", maintain_after_year: 2040,
                   rows: [{year, capacity_gw}, ...]},
    wind_offshore: {source_url: WINDSEE_URL, comparison: "at_least", maintain_after_year: null,
                    rows: [{year, capacity_gw}, ...]}
  },
  congestion: {
    units: {energy: "GWh", cost: "million EUR"},
    annual_through: "YYYY-12-31", monthly_through: "YYYY-MM",
    annual: [{year, energy_gwh, cost_million_eur}, ...],
    monthly: [{month: "YYYY-MM", energy_gwh, cost_million_eur,
               redispatch_energy_gwh, redispatch_cost_million_eur}, ...]
  },
  content_hash: "<64 lowercase SHA-256 hex digits>"
}
```

`SOURCE`, URLs and the exact German `CAPACITY_SCOPE` text are constants in
`progress.py` and appear verbatim in the generated JSON. `year` is an integer.
Target rows contain precisely the milestones above; missing milestone years are
absent, not zero. `maintain_after_year` is the only nullable field.

Canonical UTF-8 uses the shared `canonical_bytes`: recursively sorted keys, compact
separators, `ensure_ascii=False`, finite numbers, **no trailing newline**.
SHA-256 is over canonical bytes of the root excluding **only `content_hash`**.
There is **no retrieval, check or creation timestamp** to exclude or advance.
Consumers verifying the hash must preserve numeric token spelling (Python `0.0`
versus JS `0`); the existing recent-hourly schema/newline validator is not compatible.

### Freshness presentation

Display separate observation ages, not one shared “current as of” stamp:

- Capacity: year-end `capacity.data_through`, provisional, selected 2011–2025 history.
- Congestion annual: `annual_through`, completed annual source observations.
- Congestion monthly: `monthly_through`, completed monthly source observations;
  initial coverage ends May 2026, not the September retrieval month. A 2026 sum is
  January–May/YTD, not a full year. July–December 2022 is also a partial year.
- Targets: `verified_on` is the manual legal-review date, not observed-data freshness.

These source ages legitimately differ. The consumer should show the actual end
period and update/review cadence. No certified publication-lag SLA or automatic
freshness guarantee is supplied; the coverage guards prevent regression/internal
gaps, not an unchanged upstream source becoming old.

## Atomic storage and failure handling

Reuses the history module's strict JSON parser, bounded reader, advisory lock on
the output parent directory, and same-directory fsync/atomic writer. Existing bytes
must validate their exact schema, source, legal baseline, periods, units, hash and
canonical encoding before any fetch. Corrupt/noncanonical files and symlinks fail;
restore a known-good file or inspect and choose another output location.

Validate the whole proposed snapshot before replacement. Recheck old bytes to reject
stale writers and reject coverage regression. Failed source, parsing, validation or
replacement preserves previous bytes; temporary files are cleaned on handled
failure. Equal data preserves **bytes and mtime**. Cooperating local writers share
the directory lock; cross-checkout publication still requires serialization.

## Deferred source candidates

The earlier direct BNetzA XLSX route remains blocked for this implementation:
redistribution licensing for those separate downloads was not verified. SMARD's
explicit compact-data evidence is not treated as a blanket license for arbitrary
BNetzA files. Grids/build-out, SAIDI and interconnector indicators likewise have no
verified licensed acquisition route within this scope, and no sufficiently cheap
unit-level MaStR path was established for comprehensive storage. These datasets
are not built or represented by proxy totals in this snapshot.

## Measured acceptance, 10 September 2026

| Measure | Initial live refresh | Second live refresh |
| --- | ---: | ---: |
| Requests | 1 | 1 |
| Downloaded bytes | 759,184 | 759,184 |
| Total seconds | 0.541 | 0.476 |
| Result | changed | unchanged; bytes and mtime verified |
| Export bytes | 11,138 | 11,138 |

Initial data: 15 capacity year ends (2011–2025), 11 congestion years (2015–2025),
47 congestion/market-redispatch months (July 2022–May 2026). The live 2025 capacity
row has **104.856 GW PV, 68.112 GW onshore, 9.733 GW offshore, 2.9 GW batteries,
9.902 GW pumped storage**. May 2026 has **1,119.86 GWh / €187.91 million** total
congestion and **868.87 GWh / €75.50 million** market-plant redispatch.

Semantic content hash:
`941a519f4367f4c524dec38401d2a5b96c0d7c97dc4249b4081a1f7b58c26896`.

**13 focused offline tests** pass: exact series mapping/units, completed periods
and rollover, missing groups/columns, all-row numeric validation, malformed CSV,
month-start/sequence/alignment, statutory contract, hashes, network retry/deadline/
byte bounds, no-change preservation, revisions, corrupt existing snapshots,
coverage regression, stale writers, directory locks, symlinks and failed atomic
replacement. The module and live refresh ran with only the available Python
standard library, without a virtual environment or database. Existing frontend
verification also passed: **299 tests across 13 suites**, and `npm run build`.
