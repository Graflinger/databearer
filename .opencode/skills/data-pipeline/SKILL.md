---
name: data-pipeline
description: Explains and guides work on the databearer Python/DuckDB/dbt data pipeline, including adding new data sources, medallion layers, running ingestion/dbt/export steps, and preparing frontend CSV outputs.
compatibility: opencode
metadata:
  project: databearer
  area: pipeline
---

# Databearer data pipeline skill

## When to use this skill

Use this skill when the task touches `databearer/pipeline/`, including:

- Adding or updating a data source.
- Creating or changing dbt staging, cleaned, or curated models.
- Exporting datasets for frontend charts.
- Explaining how the medallion setup works.
- Running or debugging the local DuckDB/dbt pipeline.

## Core architecture

The pipeline is a Python + DuckDB + dbt project. Always run commands from `databearer/pipeline/`
because imports and paths are repo-relative to that folder (`from src...`, `src/config/...`,
`.data/...`).

```text
External APIs / files
  → Python ingestion scripts (`src/data_pipelines/get_raw_data/`)
  → DuckDB staging schema
  → dbt cleaned models
  → dbt curated models
  → Python export scripts (`src/data_pipelines/export_data/`)
  → `.data/output/*.csv`
  → frontend `src/data_ingestion/data/`
```

The local DuckDB database location is configured in `src/config/parameters.yaml` as
`.data/duckdb.db`. The `.data/` folder is gitignored and may contain the database and generated CSVs.

## Medallion setup

- **Staging**: Raw or near-raw tables created by ingestion scripts in DuckDB. Use minimal changes:
  source-shaped columns, original grain, enough metadata to trace the source.
- **Cleaned**: dbt SQL models under `src/data_pipelines/databearer_dbt/models/cleaned/`.
  Standardize names, types, units, pivots/unpivots, and source-specific quirks.
- **Curated**: dbt SQL models under `src/data_pipelines/databearer_dbt/models/curated/`.
  Analysis-ready fact tables for blog posts and reusable thematic datasets.
- **Exports**: Python scripts copy selected curated data to CSV files in `.data/output/` for charts.

dbt configuration lives in `src/data_pipelines/databearer_dbt/`:

- `profiles.yml`: DuckDB profile, with dev/prod schemas and `.data/duckdb.db` path.
- `dbt_project.yml`: model folders and schema mapping (`cleaned`, `curated`).
- `models/staging/*.yml`: source declarations for ingested staging tables.
- `models/cleaned/**/*.sql`: standardized intermediate tables.
- `models/curated/**/*.sql`: blog-ready fact tables.

Existing export scripts usually query `prod_curated.*`, so run dbt with `--target prod` before
exporting unless you also adapt the export SQL to the dev schema.

## Adding new data

1. **Identify source type and metadata**
   - Existing metadata lives in `src/config/datasource_metadata/`.
   - Add entries there when using an existing helper/source pattern, for example GENESIS, AMECO,
     Energy Charts, World Bank Climate, or Our World in Data.
   - If the source requires secrets, do not commit them. Use local ignored config only.

2. **Create or extend ingestion**
   - Use `src/data_pipelines/get_raw_data/` for ingestion scripts.
   - Prefer existing helper modules in `src/tools/datasources/` when possible.
   - Connect via `get_duckdb_connection()` from `src/tools/duckdb_utils/duckdb_utils.py`.
   - Write raw tables to the `staging` schema with stable, DuckDB-safe names.
   - Include a `main()` guard so the script can run directly.

3. **Declare staging source for dbt**
   - Add or update the relevant YAML file under `models/staging/`.
   - Keep source/table names aligned with ingestion output.

4. **Create cleaned models**
   - Add SQL under `models/cleaned/<source_or_domain>/`.
   - Rename columns to consistent, readable names.
   - Cast dates and numbers explicitly.
   - Normalize units and document non-obvious calculations in SQL comments or schema YAML.

5. **Create curated models**
   - Add SQL under `models/curated/<domain>/`.
   - Model the table at the grain needed by posts/charts, e.g. yearly country facts,
     monthly energy facts, or article-specific metrics.
   - Prefer reusable fact tables over one-off exports when the data may support future posts.

6. **Export CSV for frontend**
   - Add an export script under `src/data_pipelines/export_data/<year>/<topic>/` or the existing
     thematic folder pattern.
   - Use DuckDB `COPY (...) TO '.data/output/<name>.csv' (HEADER, DELIMITER ',');`.
   - Keep exported column names stable because frontend chart configs reference them exactly.
   - Copy the final CSV into `databearer/frontend/src/data_ingestion/data/` when it should be
     tracked with the frontend.

## Running the pipeline

From `databearer/pipeline/`:

```bash
pip install -r requirements.txt
python src/data_pipelines/setup/duckdb_setup.py

# Run the ingestion scripts you need, for example:
python src/data_pipelines/get_raw_data/ingest_genesis_data.py
python src/data_pipelines/get_raw_data/ingest_ameco_data.py
python src/data_pipelines/get_raw_data/ingest_bnetza_data.py
python src/data_pipelines/get_raw_data/ingest_energy_charts_data.py
python src/data_pipelines/get_raw_data/ingest_world_bank_climate_change.py
python src/data_pipelines/get_raw_data/ingest_our_world_in_data.py

dbt run \
  --target prod \
  --profiles-dir src/data_pipelines/databearer_dbt/ \
  --project-dir src/data_pipelines/databearer_dbt/

# Run the relevant export script, for example:
python src/data_pipelines/export_data/2026/windenergy_germany/windkraftausschreibungen.py
```

If available, use `dbt run --target prod --select <model_name>` for focused transformations before
exporting. Run `dbt test` only if tests are defined for the affected models.

## Quality checks

- Verify row counts and date/year ranges after ingestion and after dbt transformations.
- Check units carefully; several sources need scaling (for example thousands, billions, percent).
- Keep transformations reproducible and source-backed; avoid manual edits to generated outputs.
- Do not commit `.data/`, `logs/`, credentials, notebooks, or secrets.
- For frontend compatibility, preserve CSV headers referenced in chart configs or update the chart
  config and post embeds together.
