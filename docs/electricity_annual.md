# German electricity: frozen official annual supplementation

`pipeline/src/data_pipelines/dashboards/german_electricity/annual.py` supplies
**2016 and 2018 only** to the fixed annual generation/share trend charts, through
`frontend/src/_data/germanElectricityAnnual.json`. It fetches all twelve generation
categories at official SMARD **year** resolution, including nuclear, excluding
load and prices. The annual denominator and all numerators use that same resolution.
Do not replace only the two gap-affected category cells in a daily-derived total.

This is an explicit, frozen annual backfill alongside the approved
[daily history](german_electricity_history.md),
[monthly trade](electricity_trade.md), and [source contract](german_electricity_data.md).
It adds no routine refresh, source fallback, dependency, DuckDB state, dbt model,
scheduler, or publication step. Existing history partitions/manifest, recent data,
trade, and frozen blog datasets are read-only for this operation. Production
publication of this supplement retains the manual release gate. The authorized
[daily data publisher](dashboard_publication.md) neither fetches these frozen years
nor includes this file in its write allowlist; it validates the existing supplement
when building trends and verifying their deployed input identity.

## Commands and frozen-year policy

From `pipeline/`, with that directory on `PYTHONPATH`:

```bash
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.annual backfill
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.annual backfill --years 2016 2018 --reconcile
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.annual backfill --years 2018 --output /existing/directory/annual.json
PYTHONPATH=. python -m unittest discover -s tests -p 'test_german_electricity_annual.py' -v
```

- Default selection is `2016 2018`. `--years` accepts either or both, in any order;
  duplicate selections and every other year fail. Output rows are always ascending.
- Backfill fetches only selected absent years. Existing years are frozen and make
  **zero source requests** unless explicitly selected with `--reconcile`. Adding
  or reconciling one year retains the other year verbatim; subsets are allowed and
  the snapshot describes only its actual years. Reconciliation never drops a year.
- `--output` defaults to the generated frontend JSON above; its parent must exist.
  `--history-directory` defaults to `frontend/src/data-history/german-electricity/`
  (resolved absolutely by the module). It must contain a validated `manifest.json`
  and its referenced partitions, with full calendar coverage for exported years.
- Validate existing annual bytes and the complete local history before fetching.
  Compare all exported categories with local known daily sums, including on a
  no-fetch rerun. No daily/hourly/quarter-hour endpoint is requested.
- There is no `refresh`, as-of, current-month cutoff, or automatic workflow hook.
  These closed years require no recurring source calls. `--reconcile` reads today's
  official source vintage; it is not a reproduction of an archived raw response.

## Why official annual values are legitimate despite daily gaps

Attribution: **Bundesnetzagentur | SMARD.de**, **CC BY 4.0**. Reuse the exact
`pipeline.py` `SOURCE` object including the market-data, license and terms URLs.
Identify **MWh → GWh conversion** as a modification. The official
[April 2026 handbook](https://www.smard.de/resource/blob/220052/9d526adf4b948599da4a956dfae6dab9/smard-benutzerhandbuch-04-2026-data.pdf)
describes summation at the selected chart resolution (prices instead use means),
and source-side interpolation under specified missing-data rules. Annual source
values are MWh aggregates: divide by 1,000, round GWh to eight decimal places.
Never multiply by year hours or apply quarter-hour scaling.

Generation means net generation fed into the public grid under the existing SMARD
scope, not all gross national production. Pumped storage is discharge, excluded
from the renewable numerator. Nuclear is included in the generation denominator.
The renewable numerator is biomass, hydro, wind offshore, wind onshore, solar and
other renewables. Generation minus load is not commercial trade.

The five verified missing daily observations remain missing:

| Daily date | Category / ID |
| --- | --- |
| 2016-11-08 | other_renewables / 1228 |
| 2018-01-21 | pumped_storage / 4070 |
| 2018-08-02 | pumped_storage / 4070 |
| 2018-08-03 | pumped_storage / 4070 |
| 2018-08-23 | pumped_storage / 4070 |

The preceding source investigation found 24 null hourly and 96 null quarter-hour
observations on each affected series-day. This annual backfill does not repeat
those finer-resolution diagnostics or fill their nulls. SMARD nevertheless
publishes numeric yearly aggregates for every generation category in both years.
Those **published annual aggregates are authoritative at their stated resolution**;
source-side aggregation/interpolation can differ from summing published daily
values. Neither their presence nor agreement with daily sums certifies completeness
of underlying hourly/quarter-hour data. The method is
`source_annual_aggregate`, never “reconstructed complete daily history”.

In particular, the annual-minus-known-daily difference is **not an observed missing
day's energy**, even when only one daily value is absent. It can include
resolution-specific processing and rounding. Do not allocate the residual to days,
infer missing power, or use it to certify a complete daily denominator. Daily and
custom partial-year views retain their original gaps and coverage rules.

## Official acquisition surface and bounds

```text
https://www.smard.de/app/chart_data/{id}/DE/index_year.json
https://www.smard.de/app/chart_data/{id}/DE/{id}_DE_year_{Berlin_Jan1_epoch_ms}.json
```

All indices must contain unique integer **Berlin January 1 midnight** timestamps.
Check every returned boundary and require each selected year's boundary. Each
selected chunk must have exactly one `[timestamp, numeric_MWh]` observation at
that boundary. Missing/null, duplicate (including identical duplicate values),
wrong-year, non-midnight or nonannual observations fail. Equal numeric values in
different legitimate category/year keys are not duplicates.

| Energy key | SMARD ID |
| --- | ---: |
| biomass | 4066 |
| hydro | 1226 |
| wind_offshore | 1225 |
| wind_onshore | 4067 |
| solar | 4068 |
| other_renewables | 1228 |
| lignite | 1223 |
| hard_coal | 4069 |
| gas | 4071 |
| other_conventional | 1227 |
| pumped_storage | 4070 |
| nuclear | 1224 |

The allowlist is derived from `history.ENERGY` minus `load`. The two selected
Berlin boundaries are **1451602800000** (2016) and **1514761200000** (2018).
No load/price, other-country, daily or finer endpoint is consulted.

- **12 index requests + 24 chunks = 36** requests for both missing years;
  24 for a single year, zero when all selected years already exist.
- At most **three concurrent requests**, both index and chunk stages.
- Existing strict HTTP client: **15-second maximum socket timeout**, clipped to
  remaining **60-second fetch deadline**; deadline checked before requests and
  during body reads. In-flight socket teardown/backoff can add small overhead;
  this is a bounded fetch budget, not a hard end-to-end process SLA.
- At most three attempts per URL, transient connection/429/500/502/503/504 errors
  only, 1/2-second backoff. Permanent errors fail immediately. **48 total attempts**
  including retries; exhaustion fails without publication.
- **16 KB per response**, **200 KB total body bytes**, **10 KB export** caps.
- Strict JSON rejects duplicate object keys; observations reject null, booleans,
  numeric strings, negative/nonfinite and implausible values. Per-category bound
  is 0–200 GW equivalent over the year. Sum of all categories must be between
  100,000 GWh and 200 GW equivalent (8,784 hours in 2016, 8,760 in 2018). These
  deliberately broad bounds are corruption guards, not statistical estimates.

## Daily comparison and measured source-resolution differences

Read validated existing daily partitions only. For each of all 24 category/year
pairs, report annual GWh, known daily sum, known/missing day counts, signed
`annual - known_daily` GWh, rounding tolerance and agreement flag. Use accurate
summation; never coerce nulls to zero. All differences appear in the CLI JSON
metrics, including a failed lower-bound comparison.

Require `annual >= known_daily - tolerance`. The rounding-only tolerance is
`(known_days + 1) * 0.005 / 1000 + 1e-8` GWh, covering separately rounded daily
MWh values and the annual MWh value. Larger negative discrepancies fail for
investigation; they are not silently excused by a percentage allowance. Positive
differences are reported, not arbitrarily rejected or treated as imputed daily
values. No provider discrepancy exception is needed for these measured inputs.

Live results, 10 September 2026; signed deltas in **GWh**:

| Category | 2016 annual − known daily | 2018 annual − known daily |
| --- | ---: | ---: |
| biomass | −0.00008 | −0.00008 |
| hydro | −0.00002 | −0.00011 |
| wind_offshore | −0.00012 | −0.00011 |
| wind_onshore | −0.00016 | −0.00018 |
| solar | −0.00005 | −0.00005 |
| other_renewables | **+5.85457** | −0.00005 |
| lignite | +0.00002 | −0.00009 |
| hard_coal | −0.00016 | −0.00025 |
| gas | −0.00011 | −0.00014 |
| other_conventional | −0.00013 | −0.00008 |
| pumped_storage | +0.00001 | **+19.53223** |
| nuclear | −0.00006 | −0.00011 |

The 22 category/year pairs without daily nulls agree within rounding; the maximum
absolute difference is 0.25 MWh. The two larger differences are:

| Year/category | Official annual MWh | Annual GWh | Known daily GWh | Missing days |
| --- | ---: | ---: | ---: | ---: |
| 2016 other_renewables | 1,835,926.08 | 1,835.92608 | 1,830.07151 | 1 |
| 2018 pumped_storage | 8,804,806.38 | 8,804.80638 | 8,785.27415 | 4 |

## Exact consumer contract, schema 1

The root and each row have exactly these fields; no timestamp or coverage claim:

```text
{
  schema_version: 1,
  kind: "german-electricity-annual",
  source: SOURCE,
  region: "DE",
  timezone: "Europe/Berlin",
  resolution: "year",
  years: [{
    year: 2016,
    energy_gwh: {
      biomass, hydro, wind_offshore, wind_onshore, solar, other_renewables,
      lignite, hard_coal, gas, other_conventional, pumped_storage, nuclear
    },
    method: "source_annual_aggregate"
  }, ...],
  content_hash: "<lowercase SHA-256>"
}
```

`energy_gwh` has exactly the twelve keys above and finite nonnegative numbers.
`years` is a nonempty sorted unique subset of `[2016, 2018]`; the generated default
snapshot includes both. No daily rows, load, prices, totals, shares or derived-zero
flags are included. Consumers derive full annual totals/shares from **all twelve
values of that annual row**, with explicit annual-source methodology. Do not merge
the supplement into daily storage, use it for a partial year, or claim certified
underlying completeness. Other years continue using existing history under its
coverage rules. Keep monthly trade's independent methodology.

Serialization is UTF-8, compact JSON, recursively sorted keys, finite numbers,
**no trailing newline**. `content_hash` is SHA-256 over canonical JSON of the root
after excluding **only `content_hash`**. Canonical encoding reuses `canonical_bytes`:
`json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)`.
Frontend hashing must preserve numeric token spelling (Python `0.0` versus JS `0`,
for example); do not directly reuse the recent-hourly schema/newline validator.

## Atomic storage and failure preservation

Reuse the history parent-directory advisory lock, bounded reader, strict JSON
parser, canonical serialization and same-directory fsync/atomic replacement helper.
Validate all existing annual fields, hash and canonical bytes **even during
reconciliation**. Corrupt existing snapshots are never overwritten: restore a
known-good version or use an inspected alternate output. Symlinks are refused.

Validate the whole proposed annual snapshot and daily comparison before replacement.
Recheck the history manifest and original annual output bytes immediately before
publication; stale writers fail. Failed source/validation/replacement leaves prior
annual bytes intact; handled temporary files are cleaned. A no-change run preserves
bytes and mtime. Directory locks coordinate local cooperating writers only; any
later Git publication still needs serialization and the manual release gate.

## Measured acceptance

| Measurement | Initial real backfill | Existing snapshot rerun |
| --- | ---: | ---: |
| Requests | 36 | 0 |
| Response-body bytes | 4,231 | 0 |
| Fetch stage including history validation | 1.754 s | 0.136 s |
| Total time | 1.760 s | 0.137 s |
| Status | changed | unchanged |
| Export size / rows / generation values | 1,153 bytes / 2 / 24 | same |

Snapshot content hash:
`d2e3c19dc02d375c9ee754900d6eaea7c6c789c823a1c62322f75fdb19f39025`.

Fifteen focused offline tests pass, covering all twelve categories and MWh/GWh
units, leap-year boundaries, invalid indices/chunks/duplicates/numbers, request
selection/concurrency/retry/deadline/byte budgets, exact schema/hash, all daily
differences and lower-bound failure, unchanged daily bytes, subset retention,
explicit reconciliation, corrupt existing inputs, no-change bytes/mtime, locks,
stale writers, failed atomic replacement, and prohibited refresh/unapproved years.
Frontend verification also passed: **261 tests across 13 suites** and
`npm run build`. Frontend consumption/presentation is owned separately; this
supplement's handoff is the exact JSON contract and methodology above.
