# databearer

Monorepo for the **databearer** data-journalism blog (https://blog.databearer.de).

Public and open-sourced for reproducibility/transparency of the data analysis. A separate
**private** `video-generator` project (not in this repo) consumes the published site to produce videos.

## Structure

| Folder | What | Stack |
|--------|------|-------|
| [`pipeline/`](pipeline/) | Data pipeline — ingest, transform, export datasets/CSV | Python, DuckDB, dbt |
| [`frontend/`](frontend/) | The blog site (consumes the data, renders charts) | Eleventy (11ty) v3, Apache ECharts |
| [`image-generation/`](image-generation/) | Generates blog header/card images | Python, Azure FLUX |

Data flow: **pipeline** produces datasets → **frontend** renders them as posts/charts →
**image-generation** creates header images → finals land in `frontend/src/images/blog_card_images/`.

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

Hosting: **Cloudflare Pages**, built from this repo with **Root directory = `frontend`**,
served at `blog.databearer.de`.

## Image generation

```bash
cd image-generation
cp .env.example .env   # fill in AZURE_FLUX_API_KEY
# run image_generation_flux.ipynb
```

Generated images are written to `../generated-images/` (gitignored). Curate finals into
`frontend/src/images/blog_card_images/`.
