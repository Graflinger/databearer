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

The validated source is the **30 June 2026** MaStR battery subset, not current
September stock. Source archive SHA-256:

```text
ac21af97af411566af5377b08f91e023b8631733d0b70371f0ec0ecb0cab4f7c
```

The official source URL is
`https://download.marktstammdatenregister.de/Gesamtdatenexport_20260630_26.1.zip`.
The historical local subset's acquisition is recorded as user-supplied, not a
new verified retrieval from that URL. Its content hash was verified during ingestion.
The original general DuckDB database and raw June archive were preserved.

Frozen aggregate exports and provenance are under
`frontend/src/data_ingestion/data/battery_storage_*`. The metadata records every
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
2019–2025, not a headline comparison of incomplete H1 2026 registrations.

Validated research result: 2024 versus 2025 has **573,235 versus 559,016 plants**,
**6.178516 versus 6.714984 GWh**, and large-segment energy **0.824290 versus
1.746098 GWh**. The selected-operating quality exclusions account for roughly
0.45% of units but 4.57% of known energy. Do not use the all-source exclusion
sum as battery quality loss: it includes non-battery technologies and other statuses.

The price/solar illustration is separately frozen to **11 August–9 September
2026**, 720 hourly observations, with 30 observations per Berlin hour. It is not
a yearly pattern, battery dispatch measurement, causal estimate or profit model.

## Running manually

Run commands from `pipeline/` with `PYTHONPATH=.`. Use a compatible isolated
environment; verification used Python 3.11, DuckDB 1.1.1, dbt-core 1.8.8 and
dbt-duckdb 1.9.0, plus requests and Jinja2. The general developer dbt environment
had a pre-existing `dsi_pydantic_shim` import failure; an isolated environment
avoided modifying it.

Ingestion defaults to `.data/mastr_battery.duckdb` and refuses the general
`.data/duckdb.db`, including filesystem aliases. Five source tables and one
provenance row are replaced transactionally only after validation.

```bash
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_mastr_data.py \
  --zip-path .data/raw/mastr/Gesamtdatenexport_20260630_26.1_battery_subset.zip \
  --export-url https://download.marktstammdatenregister.de/Gesamtdatenexport_20260630_26.1.zip \
  --snapshot-date 2026-06-30 \
  --database .data/mastr_battery.duckdb
```

For a fresh manual source attempt, omit `--zip-path`; optionally pin the
expected date and dated URL. Download and parser budgets are explicit CLI
options (`--help`). The one September attempt stopped at the 96-request budget
before member payload downloading. Review subsequently replaced the inefficient
header preflight with one streamed request per member. Offline 82-member
fixtures now fit the budget (88 classic ZIP / 91 ZIP64 requests, including
discovery); **this revised fresh-download path has not been live-verified**.
Do not silently increase budgets or fall back to a multi-GB full download.

Create a separate dbt profile outside tracked files, using this project's
`databearer_dbt` profile name, target `prod`, schema `prod`, type `duckdb`, and
an absolute path to the dedicated battery database. Never use the unchanged
general profile for the following build:

```bash
PYTHONPATH=. dbt build --target prod --profiles-dir /PATH/TO/BATTERY/PROFILE \
  --project-dir src/data_pipelines/databearer_dbt \
  --vars '{battery_snapshot_date: "2026-06-30"}' \
  --select 'path:models/cleaned/mastr' \
           'path:models/curated/energy_germany/fact_battery*' \
           'path:tests/battery*'

PYTHONPATH=. python src/data_pipelines/export_data/2026/batteries_germany/export.py \
  --database .data/mastr_battery.duckdb \
  --electricity-snapshot ../frontend/src/_data/germanElectricity.json \
  --output-dir .data/output/batteries_germany
```

The export rejects a rotating electricity snapshot outside the frozen article
window. Recover the original input from Git commit
`dd0c7f8deef858a844be777a5fd1e78949386413` when needed; see the export directory's
README. It never refreshes or rewrites the live dashboard. After reviewing a
complete validated output set, explicitly select
`--output-dir ../frontend/src/data_ingestion/data` to prepare tracked article
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

Acceptance checks on 11 September 2026:

- 47 offline ingestion tests and 39 model/export tests passed.
- Node 20.20.2: 16 frontend suites, 396 tests passed (one build-only test skipped
  before build); lint and production build passed; all 42 focused post-build
  battery checks then passed.
- Build-time battery validation verifies all ten data files against their
  manifest before any chart generation, rejecting incomplete or mixed sets.
- Browser checks rendered all five charts at 1,280 px and 390 px, with expected
  series lengths, no horizontal page overflow and no console errors.
- Draft exclusion from feeds, search, sitemap and indexes was verified.

The real June build passed 10 models and 25 dbt tests. Unrelated electricity
selection compiles without battery variables; selecting battery models without
an explicit date fails. Remaining editorial work: assess residual outliers and
operator-type sensitivity, decide whether to obtain a fresh source before
publication, review the draft headline/copy, and optionally add an original card
image. Historical snapshot comparisons and a full-year electricity profile are
future work, not implemented claims.
