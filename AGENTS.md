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
- [Plan B](docs/plan_b.md): optional paths for independent publishing, durable history,
  managed databases, scheduled compute, or a server. Do not introduce these without
  an explicit need and agreement on the trade-offs.

Dashboard runs must reconstruct their required data from scratch, remain idempotent,
and select only necessary sources/models. Do not persist the DuckDB database between
runs. Keep dependencies, source requests, and runtime bounded; publish only validated,
compact exports. Preserve frozen blog-post datasets and the last working dashboard
on failure. The architecture documents describe planned work, not existing automation.

## Working conventions

- Run pipeline commands from `pipeline/`, with that directory on `PYTHONPATH`.
- Run frontend commands from `frontend/`; use `npm test` and `npm run build` for
  frontend changes. Follow pipeline skill guidance for focused dbt selection/tests.
- Keep `.data/`, raw downloads, and credentials out of Git. Preserve unrelated work.
- Do not commit, push, or deploy unless requested; documenting a future automated
  publication workflow does not authorize publishing during the current task.
