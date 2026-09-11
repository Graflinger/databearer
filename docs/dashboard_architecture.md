# Dashboard architecture: stateless daily refresh

Repository paths in this document are relative to the repository root.

Status: implemented for the German electricity dashboard. Daily data-only
publication is authorized and enabled in the workflow; activation awaits merge to
`main` and first live deployment verification. See
[dashboard publication](dashboard_publication.md) for the operational policy and
recovery; the design/checklist below also guides future dashboards.

**Approved exception, September 2026:** the German electricity dashboard now has
a [durable daily-history extension](german_electricity_history.md). Its yearly JSON
exports are authoritative refresh inputs, closed years are frozen, and only the
current year's latest 35 complete days are corrected. Full reconstruction remains
an explicit bounded backfill (182 daily-source requests for 2015–2026). This
exception changes export-state retention and the total history-size budget; it
does not persist DuckDB. Scheduling/publication is separately authorized by the
publication policy linked above. The recent hourly snapshot retains the stateless
design below; monthly trade also uses a bounded durable snapshot.

Start with **one dashboard, one daily refresh, and the existing Python/DuckDB/dbt →
Eleventy/ECharts → Cloudflare Pages stack**. No rented server, persistent database,
or browser requests to upstream data providers are required.

See [Plan B](plan_b.md) for persistent history, independent data publishing, and
server-based alternatives. Those are migration options, not MVP requirements.

## 1. Scope and decisions

- Pick one topic and a small, explicit set of source endpoints, metrics, and periods.
  The source must let a fresh run reconstruct the dashboard's entire display window.
- Run daily after the expected source release, with a manual rerun option.
- Create a fresh DuckDB database on each run; discard it when the job ends.
- Reuse existing ingestion helpers and dbt transformations where appropriate, but
  never run the whole blog pipeline just to refresh this dashboard.
- Publish compact, validated exports. Browsers render and filter prepared data with
  ECharts; they do not download raw source datasets or receive API credentials.
- Keep historical blog-post data frozen. Use separate dashboard files and link from
  articles to the live dashboard rather than silently changing their evidence.
- For the MVP, commit only changed dashboard exports and use the existing
  Cloudflare Pages Git integration. Do not commit databases or raw downloads.

Non-goals: real-time guarantees, arbitrary server-side queries, user accounts,
incremental ingestion, a workflow orchestrator, and a warehouse of historical snapshots.

## 2. Data flow and repository fit

```text
Daily/manual GitHub Actions run
  → publishing only: require main ref and HEAD == origin/main == origin/releases/cloudflare
  → resolve explicit dashboard ID and reporting window
  → install minimal, pinned runtime dependencies
  → fetch only the required source data
  → fresh DuckDB: staging → selected cleaned/curated dbt models
  → validate and export deterministic chart data
  → compare with the tracked dashboard snapshot
      unchanged: no new commit/build; failed publication has a separate recovery path
      changed: validate frontend → commit only allowlisted exports → push normally
  → Cloudflare Pages builds and publishes a complete site deployment
  → electricity: refresh current-year history with recent overlap checks, then monthly trade
  → frontend tests/lint/build (including unchanged data in the current workflow)
  → compare with the tracked dashboard snapshot
      unchanged: no new commit or Git-triggered Cloudflare build
      changed + publishing: commit only allowlisted exports → atomic non-force push to both refs
  → publishing: verify public data/HTML, including no-change runs (up to 240 seconds)
  → Cloudflare Git integration handles the external build; failed deployment needs manual recovery
  → browser loads static chart assets from the CDN
```

Existing integration points:

- Ingestion: `pipeline/src/data_pipelines/get_raw_data/` and
  `pipeline/src/tools/datasources/`.
- dbt: `pipeline/src/data_pipelines/databearer_dbt/`.
- Temporary database/output: `pipeline/.data/` (ignored by Git).
- Frontend chart inputs: `frontend/src/data_ingestion/data/`.
- Chart configs/builders: `frontend/src/data_ingestion/charts/` and `builders/`.
- `.eleventy.js` generates chart JavaScript on build; the ingestion directory itself
  is excluded from the published site.
- `.github/workflows/frontend-ci.yml` runs PR checks; it does not refresh live data
  or deploy the site. The refresh workflow runs its own validation before publishing.

Implemented electricity locations:

| Purpose | Location |
| --- | --- |
| Dashboard entry point and narrow source/model selection | `pipeline/src/data_pipelines/dashboards/german_electricity/` |
| Pinned dashboard runtime dependency set | `pipeline/requirements-dashboard.txt` |
| Scheduled/manual workflow | `.github/workflows/dashboard-refresh.yml` |
| Evergreen dashboard page, outside post collections | `frontend/src/dashboards/strom.njk` |
| Dedicated chart controllers | `frontend/src/js/dashboards/` |
| Tracked recent export with freshness/provenance | `frontend/src/_data/germanElectricity.json` |
| Durable yearly history | `frontend/src/data-history/german-electricity/` |
| Guarded Git publisher / public verifier | `scripts/dashboard_publish.py`, `scripts/verify_dashboard_deployment.py` |

Electricity uses one shared prepared JSON snapshot rather than duplicated per-chart
CSVs, with explicit public JSON routes and history passthrough. See the
[frontend implementation](../frontend/README-dashboard.md). Placing JSON in the
ignored ingestion directory alone does not make it browser-accessible.

## 3. Statelessness and idempotency

Statelessness and idempotency are separate requirements:

- **Stateless:** no previous database, download, artifact, or cache is needed to
  compute correct output. Dependency caches only make installation faster.
- **Idempotent:** identical source payloads, transformation version, and explicit
  reporting window produce identical data exports. A retry replaces the same
  snapshot rather than appending duplicates or creating additional logical records.

Compute the reporting window once per run, with a documented timezone and an
optional explicit as-of date for manual reruns. Use stable keys, sorting, column
order, date formats, numeric precision, null encoding, and serialization. Keep the
wall clock and unordered query results out of chart-data output.

For the stateless recent snapshot, the tracked previous export is used only for
change detection and presentation continuity, never as an ingestion input. The
approved history/trade exceptions use validated repository snapshots as durable
inputs. A new checkout with an empty `.data/` must succeed. Avoid incremental dbt
models that depend on last run's tables.

Historical time series are allowed: fetch the bounded history from the provider
on every run. This does **not** preserve what the provider reported on an earlier
date. Revisions upstream may change the next snapshot, and an as-of parameter alone
cannot reproduce an old source version. If the source cannot reconstruct the
required window cheaply and reliably, narrow the dashboard or consider Plan B.

## 4. Runtime and cost budget

Make the job small by construction, not merely by caching a large pipeline:

1. Fetch an allowlist of endpoints/series, with bounded date ranges. Avoid broad
   source scripts that ingest every configured dataset. Set request timeouts,
   response-size expectations, and bounded retries/backoff; respect rate limits.
2. Install only imports needed by this dashboard. Reuse compatible pinned versions
   from the pipeline; exclude notebook/developer packages such as `ipykernel` and
   `pre-commit`. Do not install optional spreadsheet/parser libraries unless needed.
3. Select only the required dbt models and their upstream model dependencies. Check
   the selection before scheduling: adding ancestors must not pull in unrelated
   topics. Ingest the staging sources that this exact selection requires.
4. Run Python with `pipeline/` as working directory and on `PYTHONPATH`. Existing
   dbt profiles use `.data/duckdb.db` relative to that working directory. Pass the
   dbt project/profile directories explicitly and use `--target prod` when exports
   query `prod_curated`; do not rely on the profile's `dev` default.
5. Cache package downloads using dependency-file/platform keys, never the DuckDB
   database for correctness. A cold cache must still work within the timeout.
6. No-change output creates no data commit or Git-triggered deployment. The current
   electricity workflow deliberately runs frontend validation/build on unchanged
   data too, then verifies the public deployment on publishing runs.
7. On changed output, run the relevant frontend tests and one production build before
   pushing. Cloudflare's Git integration is expected to build again for deployment;
   verify this on the first live bot push and accept that small duplication
   initially rather than remove the pre-publication quality gate.
8. Record stage durations, request count, bytes downloaded, rows exported, and export
   size in the Actions job summary. Never log tokens or credential-bearing URLs.

Initial engineering targets, to measure and revise after the first cold run:

- Typical refresh under **5 minutes**, with a **10-minute job timeout** including
  installation, validation, and up to 240 seconds of public deployment verification.
- Initial published dashboard data at most **1 MB uncompressed** in total; aggregate
  or bound the display window before increasing it. Avoid loading all history just
  to display recent values.
- Daily cadence: roughly 30 runs/month; at 5 minutes each, approximately 150 runner
  minutes, excluding other CI jobs and separately hosted Cloudflare builds.

The README describes this repository as public. Standard GitHub-hosted runners in
public repositories are currently free; private repositories have plan-dependent
included minutes/storage. Efficiency still matters for quotas, latency, upstream
load, and future changes. Verify actual repository visibility, runner class, and
account limits before enabling the schedule; do not treat these targets as provider
entitlements. See [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).

## 5. Export contract and freshness

Document each dataset's grain, stable key, columns/types, units, timezone, coverage,
missing-value semantics, source URL, and license/attribution. Version the contract
when incompatible changes are made. Export only publicly redistributable data.

Keep metadata alongside the CSVs, including:

- `schema_version` and dashboard ID;
- source attribution and source release/version when available;
- `data_through`: the latest observation actually present, not the job date;
- reporting-window boundaries and a source-specific stale-data threshold;
- `snapshot_created_at`: when this changed, validated snapshot was created;
- content hash of deterministic data and semantic metadata, excluding operational
  wall-clock timestamps.

If data and semantic metadata are unchanged, preserve the existing snapshot
timestamp and do not commit just to advance a clock. Record each successful check
in the Actions summary instead. The public dashboard must not call its snapshot
timestamp “last checked”; that would imply checks it cannot observe.

Display “Datenstand”, snapshot date, expected source cadence, and attribution.
Calculate a stale-data warning in the browser against the declared coverage/release
expectation, so it can appear even when no new deployment succeeds. Distinguish
normal publication lag from missing updates. This is a data-freshness signal, not
proof that scheduled jobs are healthy; monitor Actions failures/inactivity separately.

## 6. Validation, publication, and failure handling

Validate before replacing tracked files:

- Required columns/types, unique keys, valid units, nonempty expected datasets.
- Coverage, missing periods, nulls, plausible value ranges, and latest completed
  reporting period according to the source's publication lag.
- Cross-series consistency where meaningful; do not mistake missing observations
  for zeros or silently accept partial API failures.
- Stable export generation and compatibility with the dashboard chart configuration.

Generate into a temporary directory first. Only after every required dataset passes,
copy the complete data/metadata set into the frontend and validate its build. A
multi-source snapshot must not silently mix a failed refresh with new data unless
an explicit per-source freshness contract permits it.

**Implemented build prerequisite:** chart-generation failures propagate to a nonzero
CI result; build checks validate expected dashboard assets and data/HTML consistency.
Preserve these checks. A superficially successful site build is not sufficient validation.

For the commit-based MVP:

- Serialize refresh runs with a concurrency group; avoid overlapping publications.
- Use least-privilege workflow permissions (`contents: write` only where needed),
  repository secrets for source credentials, and reviewed/pinned actions.
- Require the `main` ref and identical HEAD/origin main/origin release commits before
  source fetching; unpublished main changes stop before refresh/build.
- Stage only the explicit recent/current-year-history/trade allowlist. Never use `git add .`;
  never stage generated chart JS, unrelated posts, databases, or raw responses.
- Create a commit only when the validated snapshot changes. Push both refs with
  `git push --atomic`, without force. Normal blog/code changes retain manual promotion;
  merge release ancestry into main first if branches have diverged.
  If the branch advances, fail/retry from the new head rather than overwrite work.
- Do not bypass branch protection. If automated pushes are disallowed, explicitly
  choose an approved PR or deployment strategy before implementation.
- Validate in the refresh workflow itself: a push using `GITHUB_TOKEN` does not
  ordinarily trigger another GitHub Actions `push` workflow. Do not depend on the
  existing frontend CI to validate bot commits or add a broad PAT just to trigger it.
- Test that the actual Cloudflare Git integration deploys these bot pushes and
  includes the changed paths in its build settings. A successful Git push is not
  proof of publication; verify deployment status and the public snapshot in rollout.

On fetch, validation, or build failure, fail the job and leave the published site
alone. On deployment failure, Cloudflare should continue serving the previous
successful deployment; confirm that behavior in rollout. Configure failure
notifications and document manual retry/rollback. A published bad snapshot can be
rolled back to the last good deployment and corrected with a normal follow-up commit.

Distinguish a **committed snapshot** from a **successfully published snapshot**. If a
push succeeds but its Cloudflare build/deployment fails, a no-change pipeline rerun
will not repair publication. For the MVP, recovery is a separate manual operation:
inspect the failed deployment, fix its cause if needed, and retry the build for the
intended commit through Cloudflare's deployment controls. Confirm the public content
hash/coverage afterward. Document and test that operation during rollout; do not
manufacture a data change or timestamp-only commit to trigger deployment. If a newer
commit supersedes the failed one, deploy the intended current version rather than
blindly replaying an outdated snapshot. Automated deployment reconciliation can be
added later. The implemented read-only verifier checks public data/HTML even on
no-change publishing runs and fails on an old remote snapshot after 240 seconds;
it does not automatically retry Cloudflare. See [recovery](dashboard_publication.md).

The workflow uses **09:17 UTC daily** plus `workflow_dispatch` with boolean
`publish=false` by default. GitHub
scheduling is best effort, runs from the default branch, and may be delayed or
dropped under load. Public-repository schedules can be disabled after 60 days of
repository inactivity. Do not promise an exact update time or rely on successful
no-change runs to keep a repository active. See
[scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
and [workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Daily changed-output deployments fit a much smaller build budget than hourly ones.
Cloudflare currently documents 500 builds/month on Pages Free; include normal blog
and preview builds in the budget. Recheck limits before increasing cadence:
[Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

## 7. Implementation and acceptance checklist

1. Select the first topic/source; specify metrics, bounded display window, source
   release timing, license, and freshness expectations. Measure source-fetch cost.
2. Implement one narrow local entry point, fresh-database setup, selected dbt models,
   tests, deterministic exports, and the minimal dependency set.
3. Add the standalone dashboard page and dedicated charts, using the current site
   layout/theme. Add provenance, loading/error states where needed, and freshness UI.
4. Add the scheduled/manual workflow and guarded commit-based publication; verify
   token permissions, branch rules, Cloudflare behavior, and failure notifications.
5. Complete and record rollout checks below. The implementation contains the daily
   schedule; actual activation awaits merge to `main`, and first live deployment
   verification remains pending:

- [ ] A cold run succeeds without any previous database, data artifact, or cache.
- [ ] Running twice against fixed input fixtures/window produces byte-identical
      data; the second publication comparison creates no commit or deployment.
- [ ] Upstream revisions change the snapshot correctly without duplicate records.
- [ ] Empty, partial, malformed, and timed-out source responses fail safely.
- [ ] Tests cover keys, coverage, units, determinism, and stale-data behavior.
- [ ] Chart-generation errors fail CI; frontend tests and `npm run build` pass from
      `frontend/`, and expected dashboard assets exist in the output.
- [ ] The public page shows the deployed snapshot; a failed update retains the
      previous working page, and old blog charts remain unchanged.
- [ ] A committed-but-unpublished snapshot can be recovered through a deployment
      retry even when the next pipeline run detects no data changes.
- [ ] A concurrent branch update cannot be overwritten; retries are safe.
- [ ] Cold/warm runtimes and payload size meet the measured budget.
- [ ] Manual rerun, rollback, and schedule reactivation are documented for the first
      dashboard, with no credentials in source control or logs.
