# databearer

Monorepo for the **databearer** data-journalism blog (https://blog.databearer.de).

Public and open-sourced for reproducibility/transparency of the data analysis. A separate
**private** `video-generator` project (not in this repo) consumes the published site to produce videos.

## Documentation

- [Dashboard architecture](docs/dashboard_architecture.md): the daily dashboard design and approved history extension.
- [Dashboard publication](docs/dashboard_publication.md): authorized daily data-only publication, branch guards, rollout status, and recovery.
- [Plan B](docs/plan_b.md): alternatives for persistent history, independent publishing, and servers.
- [German electricity dashboard](docs/german_electricity_data.md): SMARD licensing, methodology, refresh commands, and validation.
- [Electricity history](docs/german_electricity_history.md): yearly data from 2015, YTD, rolling corrections, and reconciliation.
- [Electricity trade](docs/electricity_trade.md): monthly commercial DE–LU imports and exports from 2019, definitions and runtime budget.
- [Annual supplements](docs/electricity_annual.md): official 2016/2018 annual totals without inventing missing daily observations.
- [Capacity and congestion](docs/electricity_progress.md): separately refreshed power-capacity trends, statutory milestones, storage power, and congestion management; source rights and limitations.
- [Agent guidance](AGENTS.md): repository-wide working conventions.

Paths and shell commands below are relative to the repository root.

## Structure

| Folder | What | Stack |
|--------|------|-------|
| [`pipeline/`](pipeline/) | Data pipeline — ingest, transform, export datasets/CSV | Python, DuckDB, dbt |
| [`frontend/`](frontend/) | The blog site (consumes the data, renders charts) | Eleventy (11ty) v3, Apache ECharts |
| [`image-generation/`](image-generation/) | Generates blog header/card images | Python, Azure FLUX |

Data flow: **pipeline** produces datasets → **frontend** renders them as posts/charts →
**image-generation** creates header images → finals land in `frontend/src/images/blog_card_images/`.

## Branching & deployment

Production is deployed by **Cloudflare Pages from the `releases/cloudflare` branch** — not from
`main`. Blog/code changes retain an explicit manual promotion gate. The authorized
daily dashboard publisher can advance both branches with validated data-only changes
only when they already point at the same released commit.

| Branch | Role |
|--------|------|
| `feature/*`, `bugfix/*` | Day-to-day work. Open a PR into `main`. |
| `main` | Integration / trunk. Always buildable; PRs merge here. Code changes require manual production promotion. |
| `releases/cloudflare` | **Production.** Cloudflare Pages builds & deploys from here (Root directory = `frontend`). |

**Manual blog/code publish flow:** first merge any production-only release ancestry
into `main` through the reviewed process. The recorded production squash caused
divergence; another squash will not reconcile that ancestry. After review and checks:

```bash
# 1. develop on a feature branch -> PR -> merge into main
# 2. when ready to go live, promote main to production:
git switch releases/cloudflare
git merge --ff-only main      # fast-forward production to the reviewed main
git push origin releases/cloudflare   # Cloudflare Pages picks it up and deploys
```

Keep `releases/cloudflare` a fast-forward of `main` (don't commit directly to it) so production is
always an exact, reviewed snapshot of trunk.

**Daily data publication:** `dashboard-refresh.yml` schedules 09:17 UTC daily;
manual dispatch has `publish=false` by default. Publishing requires the `main` ref
and `HEAD == origin/main == origin/releases/cloudflare` before source fetching.
Only validated recent data, current-year history, and monthly trade may be committed
and pushed to both refs with `git push --atomic`, without force. Unpublished `main`
changes stop the run before refresh/build. Monthly/manual capacity and congestion
and frozen annual supplements are outside the daily refresh.

Implementation is enabled in the workflow; activation awaits merge to `main` and
the first live Cloudflare Git-integration check remains pending. A successful atomic
push is not proof of deployment: publishing runs, including no-change runs, verify
public snapshots/HTML for up to 240 seconds. See the
[publication runbook](docs/dashboard_publication.md) for rollout and recovery.

## Important: running the pipeline

The pipeline code uses repo-relative paths (`src/config/...`, `.data/output/...`) and
`from src...` imports. After the monorepo move it must be run **from the `pipeline/` directory**
(so `pipeline/` is the working dir and on `PYTHONPATH`). The devcontainer is preconfigured for this
(`PYTHONPATH=${containerWorkspaceFolder}/pipeline`).

```bash
cd pipeline
pip install -r requirements.txt
# run pipeline scripts from here
```

## Frontend

```bash
cd frontend
npm install
npm start          # dev server + hot reload
npm run build      # production build -> _site
```

Hosting: **Cloudflare Pages**, built from the **`releases/cloudflare`** branch with
**Root directory = `frontend`**, served at `blog.databearer.de` (see
[Branching & deployment](#branching--deployment)).

## Image generation

```bash
cd image-generation
cp .env.example .env   # fill in AZURE_FLUX_API_KEY
# run image_generation_flux.ipynb
```

Generated images are written to `../generated-images/` (gitignored). Curate finals into
`frontend/src/images/blog_card_images/`.
