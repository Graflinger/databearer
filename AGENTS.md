# Databearer agent guidance

This repository contains the Python/DuckDB/dbt data pipeline in `pipeline/`, the
Eleventy/ECharts frontend in `frontend/`, and image helpers in `image-generation/`.
Follow directory-specific guidance, including [frontend/AGENTS.md](frontend/AGENTS.md),
when working in those areas. Load the relevant project skills under `.opencode/skills/`.

Repository-level documentation lives in [`docs/`](docs/). Keep `README.md` and this
`AGENTS.md` at the repository root; place new cross-project documentation in `docs/`.

## Dashboard architecture

Before implementing or changing dashboard ingestion, scheduling, exports, or
publication, read:

- [Dashboard architecture](docs/dashboard_architecture.md): the default design and
  acceptance checklist for one daily, stateless dashboard using the existing stack.
- [Dashboard publication](docs/dashboard_publication.md): authorized daily data-only
  publication, released-base guards, public verification, and recovery.
- [Plan B](docs/plan_b.md): optional paths for independent publishing, durable history,
  managed databases, scheduled compute, or a server. Do not introduce these without
  an explicit need and agreement on the trade-offs.
- [German electricity history](docs/german_electricity_history.md): approved exception
  storing validated daily history in yearly Git-tracked partitions. Refresh only the
  current year's correction window; closed years require explicit reconciliation.
- [Monthly electricity trade](docs/electricity_trade.md): DE–LU commercial imports
  and exports from 2019. Use source monthly aggregates and the bounded three-month
  correction window; do not derive trade from generation minus load.
- [Annual electricity supplements](docs/electricity_annual.md): frozen official
  SMARD annual aggregates for 2016/2018 complete the annual charts only. Never infer
  missing daily observations from them or fetch these years during routine refreshes.
- [Electricity progress](docs/electricity_progress.md): separately refreshed SMARD
  compact capacity and congestion data. Keep net capacity and statutory targets
  separate; no target-attainment ratios. Do not add this monthly/manual source to
  the daily refresh or treat congestion measures as outages or renewable losses.

Dashboard runs are stateless by default; the approved electricity history uses validated
repository snapshots as durable state. All runs must remain idempotent and select only
necessary sources/models. Do not persist the DuckDB database between
runs. Keep dependencies, source requests, and runtime bounded; publish only validated,
compact exports. Preserve frozen blog-post datasets and the last working dashboard
on failure. Refresh recent electricity data before history and validate their overlap,
then refresh monthly trade. Build long-term generation trends from existing history
without additional source requests.
Daily production data publication is authorized in `dashboard-refresh.yml` at 09:17
UTC; activation awaits merge to `main` and live deployment verification. Manual
dispatch defaults to `publish=false`. Publishing requires the `main` ref and
`HEAD == origin/main == origin/releases/cloudflare` before source fetching. Commit
only validated recent/current-year-history/trade allowlist changes and push both refs
atomically, without force. Unpublished main changes must stop before refresh/build.
Normal blog/code and monthly/manual progress changes retain manual promotion;
merge release ancestry into main first if branches have diverged. Verify public
data/HTML after publishing, including no-change runs; Git push success is not a
deployment guarantee. Preserve the ten-minute total job budget and explicit
history/trade reconciliation at rollover; never auto-correct closed years.

## Working conventions

- Run pipeline commands from `pipeline/`, with that directory on `PYTHONPATH`.
- Run frontend commands from `frontend/`; use `npm test` and `npm run build` for
  frontend changes. Follow pipeline skill guidance for focused dbt selection/tests.
- Keep `.data/`, raw downloads, and credentials out of Git. Preserve unrelated work.
- Do not commit, push, or deploy unless requested; the authorized scheduled workflow
  does not authorize an agent to publish during an unrelated task.
