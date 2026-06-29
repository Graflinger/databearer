---
name: blog-topic-scout
description: Use when scanning Databearer's existing DuckDB/dbt pipeline data for possible blog topics, anomalies, records, trend breaks, or chartable signals.
compatibility: opencode
metadata:
  project: databearer
  area: research
---

# Databearer blog topic scout skill

## When to use this skill

Use this skill when the user wants ideas from the data already in this project,
for example:

- "Find topic ideas."
- "Scan the data for interesting changes."
- "What could I write about next?"
- "Is there anything notable in the current curated tables?"

This skill is for local project data. For external source discovery, use
`data-source-scout`.

## Local data locations

The pipeline is under `pipeline/` and uses DuckDB plus dbt.

Important paths:

- DuckDB database: `pipeline/.data/duckdb.db`
- Source metadata: `pipeline/src/config/datasource_metadata/`
- Curated dbt models: `pipeline/src/data_pipelines/databearer_dbt/models/curated/`
- Frontend chart CSVs: `frontend/src/data_ingestion/data/`
- Blog posts: `frontend/src/posts/<year>/`

The preferred curated schema is `prod_curated` after a production-target dbt run.

## Helper script

Use the local scout script when available:

```bash
python scripts/blog/scout_topics.py --schema prod_curated --limit 8
```

If the database is missing or stale, suggest running the relevant ingestion and
dbt steps from `pipeline/` instead of guessing from old data.

## What to look for

Good Databearer topics usually have at least one of these signals:

- record high or record low
- sudden year-over-year or period-over-period change
- trend reversal after several years
- Germany vs Europe comparison
- energy transition, public finance, industry, or society relevance
- a chart that communicates the story quickly
- a clear caveat that makes the analysis more credible

Avoid weak topic candidates where:

- the signal is tiny or purely noise
- the latest observation is incomplete
- the source definition is unclear
- the chart would not add much beyond a single number
- the likely claim is stronger than the data supports

## Editorial scoring

Use this rough scoring:

- Strong: clear data signal, recent relevance, easy chart, credible caveat.
- Possible: usable data, but needs more context or another source.
- Weak: data exists but does not support a compelling post yet.

## Output format

Return a ranked list:

```markdown
## Top Topic Candidates

1. Working title
   Signal: ...
   Source table: ...
   Why now: ...
   Suggested chart: ...
   Caveat: ...
   Potential: strong / possible / weak

## Follow-Up Checks

- Additional source or model checks before drafting.
```

Always keep the tone exploratory. Topic scouting proposes candidates; it does
not publish claims.
