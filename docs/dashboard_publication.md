# Daily electricity dashboard publication

Repository paths are relative to the repository root.

## Rollout status

**Authorized and enabled in the workflow implementation; activation awaits merge
to `main`.** `.github/workflows/dashboard-refresh.yml` contains the daily schedule
and guarded data publisher. This status does not establish that a scheduled run or
Cloudflare deployment has succeeded. Record the first live run and public
verification here after rollout.

Production remains Cloudflare Pages' Git integration on `releases/cloudflare`, with
root directory `frontend`. Normal blog/code changes require manual promotion.
The approved exception publishes only validated daily electricity exports from an
already released commit, keeping both branches at the same new data commit.

## Trigger, branch gate, and publication scope

- Schedule: **09:17 UTC daily**, cron `17 9 * * *` (10:17 MEZ / 11:17 MESZ).
  Scheduling is best effort, not a promised publication time.
- Manual `workflow_dispatch`: boolean **`publish`, default `false`**. The default
  runs validation and retains a seven-day review artifact. Set `publish=true` on
  `main` for an explicitly requested production refresh using the same guards.
- Publishing requires **`github.ref == refs/heads/main`** and a clean checkout with
  **`HEAD == origin/main == origin/releases/cloudflare`**. The initial guard fetches
  current Git refs and checks equality **before fetching source data, installing
  pipeline dependencies, or building**. If `main` is ahead or branches diverge,
  publication stops; the daily job must not build or release unpublished code.
- Runs share a serialized concurrency group, with no cancellation of an in-progress
  publisher. Recheck the released base before committing; a competing branch update
  must fail safely rather than be overwritten.

Only these changed paths may enter the automated commit:

| Path | Permitted daily change |
| --- | --- |
| `frontend/src/_data/germanElectricity.json` | Validated recent hourly snapshot |
| `frontend/src/_data/germanElectricityTrade.json` | Validated monthly trade; current-year, three-completed-month correction window |
| `frontend/src/data-history/german-electricity/manifest.json` | Validated current-year history references/coverage; prior year may be marked frozen at rollover |
| `frontend/src/data-history/german-electricity/YEAR.<sha256>.json` | Current **Europe/Berlin calendar year** only: new immutable referenced partition and bounded removal of superseded retention files |

Closed-year partition bytes and trade rows stay frozen. Annual supplements and
monthly/manual progress data are outside this write allowlist, as are generated
JavaScript/CSS, templates, posts, workflows, raw downloads, and databases. An
unexpected changed path or staged change fails publication; never use `git add .`.

`scripts/dashboard_publish.py` checks the base and changed paths. Following all
data and frontend checks, it commits only changed allowlisted exports and performs
one **`git push --atomic`**, without force, advancing `main` and
`releases/cloudflare` to the same commit. A rejected ref update rejects both.
No-change output creates no commit and triggers no new Git-based Cloudflare build.

**Atomic Git publication is not atomic Cloudflare deployment.** A successful push
only establishes the repository commit; the external build and public content
still need verification.

## Refresh and validation order

1. Check the released base for a publishing run.
2. Install the narrow Python 3.11 dashboard runtime and run all offline electricity
   Python tests (`test_german_electricity*.py`). Tests for annual/progress use
   fixtures; they do not authorize live refreshes of those sources.
3. Refresh recent hourly data in a fresh temporary DuckDB database with the focused
   dbt selection and tests.
4. Refresh current-year daily history, checking its overlap with the recent export.
5. Refresh monthly DE–LU commercial trade against the validated history cutoff.
6. Use **Node 20** for frontend tests, lint, and production build. The build validates
   recent/history overlap, hashes, trends, progress, and rendered exports/HTML.
   The current workflow also runs these checks on unchanged data.
7. Retain the validated review artifact. For publishing runs, apply the allowlist,
   commit changed exports, atomically push both refs, and verify public deployment.

Long-term trends use existing history, trade, and the frozen 2016/2018 annual
supplements without extra source requests. **Never fetch annual supplements in the
daily run.** Capacity/congestion progress is refreshed separately by hand, at most
monthly, and promoted through the normal manual release process. Checking its
published hash each day does not refresh its source or advance its observation dates.

The total Actions job budget is **10 minutes**, including installation, tests,
refresh, build, and up to 240 seconds of public verification. Individual source
deadlines are additional bounds, not additive entitlements beyond that job timeout.
Measure runner time and external Cloudflare builds on rollout. No-change runs still
cost validation time; changed data causes the pre-publication build plus Cloudflare's
external build. Keep daily cadence and account for ordinary blog/preview builds.

## Public deployment verification

`scripts/verify_dashboard_deployment.py` polls the public HTTPS site for at most
**240 seconds**, at ten-second intervals. It compares the intended local snapshots
with:

- `/data/german-electricity.json`: content, hash, and observation cutoff;
- `/data/history/german-electricity/manifest.json` and the latest referenced yearly
  partition, including that partition's **raw-byte SHA-256**;
- `/data/german-electricity-trends.json`: history/trade/annual input identities and
  coverage;
- `/data/german-electricity-progress.json`: the separately maintained snapshot;
- `/dashboards/strom/`: snapshot markers, embedded manifest/trends/progress JSON,
  expected script links, and active dashboard navigation.

Missing, old, or mismatched remote data fails the run after the polling budget.
**No-change publishing runs still verify deployment.** Verification is read-only:
it does not retry Cloudflare builds, deploy, or manufacture timestamp-only changes.
It proves the checked public responses match the intended snapshot, not a general
availability guarantee or the health of every browser/CDN location.

From the repository root of the intended released checkout:

```bash
python3 scripts/verify_dashboard_deployment.py --timeout 240 --interval 10
```

## Permissions and first live rollout

The publisher uses the repository **`GITHUB_TOKEN`**, with least-scope
**`contents: write`** required to update the two refs. Do not bypass branch
protections or add a broad personal token to trigger CI. Token-authenticated pushes
do not trigger ordinary GitHub Actions `push` workflows, so validation must finish
inside the refresh job. PR checks should run all offline electricity Python tests,
publisher/verifier tests in `scripts/tests/`, and frontend tests/lint/build on Node 20.

Cloudflare's Git integration is external to Actions. Its reaction to these bot
pushes must be checked on the **first live run**, including project branch/path
filters, build status, public snapshot, and manifest/partition cache headers. Do
not infer successful deployment from Actions push-recursion behavior. No Cloudflare
API token is stored or required for this Git-based publication/read-only verification.

Rollout procedure:

1. Complete clean PR checks, review branch protections and token permissions, and
   merge the implementation into `main`.
2. **Reconcile release ancestry before promotion.** The recorded production squash
   left `main` and `releases/cloudflare` diverged. Merge the release branch's ancestry
   into `main` with a real merge (through the reviewed process; another squash does
   not preserve that ancestry), resolve/review differences, and rerun checks.
3. Manually fast-forward `releases/cloudflare` to the reviewed `main` and confirm the
   two remote refs are identical. The daily publisher does not perform this release.
4. Request a manual publishing run on `main` (or observe the first scheduled run).
   Confirm the allowed data-only commit reaches both refs, Cloudflare's external Git
   build runs, and public verification passes. Also exercise a no-change verification
   and document failed-deployment recovery before marking rollout verified.
5. Record run/deployment URLs, checked commit, public hashes/coverage, measured total
   runtime, and the outcome here. **These live results are currently pending.**

Normal subsequent blog/code promotion remains a reviewed fast-forward release.
While `main` holds unpublished changes, scheduled publication stops at the initial
gate. Release them deliberately before resuming daily data publication.

## Failure and recovery

- **Source, validation, or build failure:** fail without pushing. The last published
  snapshot remains the serving target; local intermediate outputs are not publication.
  Investigate the failing source/contract and rerun from the current released base.
- **Branch movement or rejected atomic push:** fetch/review current refs and start a
  new run once the released-base condition is restored. Do not force-push or retry a
  stale prepared commit over concurrent work.
- **Push succeeded, public verification failed:** the new commit can exist on both
  refs while Cloudflare still serves the old site. Inspect the external deployment
  for the intended commit; fix the cause and manually retry that deployment through
  Cloudflare's controls. Run the read-only verifier again from the intended checkout.
  A no-change refresh detects this condition but does not repair it automatically.
- **Bad published snapshot:** restore the last known-good complete Cloudflare
  deployment, preserving manifest and referenced files together. Prepare a reviewed
  corrective Git commit and manual promotion so subsequent runs target the intended
  fixed version. Do not blindly retry a superseded deployment.
- **Missed correction window / first year rollover:** explicitly reconcile the
  affected history/trade year using the commands below, review/test the complete
  result, and manually promote it. January may require manual completion of
  31 December in history and December in trade after SMARD makes them available.
  Routine refresh never fetches/corrects a prior closed year. Do not expand the daily
  allowlist, loosen overlap tolerances, or fill absent observations to avoid this stop.
- **Schedule inactivity:** inspect Actions failures and disabled schedules. GitHub
  can disable public-repository schedules after 60 days without activity; successful
  no-change runs are not a keepalive guarantee. Re-enable deliberately after checking
  refs and data coverage, using reconciliation if the correction window was missed.

From `pipeline/`, with the affected year explicitly selected:

```bash
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.history backfill --start-year YEAR --end-year YEAR --reconcile
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.history refresh
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.trade backfill --start-year YEAR --end-year YEAR --reconcile
PYTHONPATH=. python -m src.data_pipelines.dashboards.german_electricity.trade refresh
```

Choose only the affected reconciliation steps after inspecting coverage. See the
[history](german_electricity_history.md) and [trade](electricity_trade.md) contracts
for cutoff/continuity requirements. Recovery that changes closed years is a manual
reviewed release, not a daily publisher rerun.

References: [architecture](dashboard_architecture.md),
[frontend checks](../frontend/README-dashboard.md),
[GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
