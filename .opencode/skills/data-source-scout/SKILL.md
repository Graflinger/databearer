---
name: data-source-scout
description: Use when checking whether a blog topic has usable external data, especially Our World in Data, Energy Charts, GENESIS/Destatis, AMECO, World Bank climate data, or Bundesnetzagentur.
compatibility: opencode
metadata:
  project: databearer
  area: research
---

# Databearer data source scout skill

## When to use this skill

Use this skill when the user asks to find, validate, or compare external data
sources for a possible blog post, for example:

- "Is there data for this topic?"
- "Check Our World in Data for this idea."
- "Find datasets about solar costs."
- "Can we support this argument with data?"

If the user wants to mine already-ingested local data, combine or defer to the
`blog-topic-scout` skill. If the user wants to ingest a selected source, combine
with the `data-pipeline` skill.

## Source priority

Prefer sources that are public, reproducible, citeable, and easy to ingest:

1. Existing Databearer source metadata and dbt models.
2. Official public APIs and direct CSV/Parquet downloads.
3. Search/API endpoints for source discovery.
4. Browser interaction only as a fallback for pages without API access.

Do not rely on visual website browsing if an API endpoint exists. This project
already has Playwright configured, but for source scouting it should mainly be
used for messy JavaScript pages, download-button inspection, or rendered-page
verification.

## Existing Databearer sources

Configured source metadata lives in `pipeline/src/config/datasource_metadata/`:

- `world_in_data.yaml`: Our World in Data chart and catalog sources.
- `energy_charts_queries.yaml`: Energy Charts API queries.
- `datasources_genesis.yaml`: GENESIS/Destatis tables.
- `world_bank_climate_queries.yaml`: World Bank climate projection queries.

Known pipeline ingestion scripts live in `pipeline/src/data_pipelines/get_raw_data/`.
Curated dbt models live in
`pipeline/src/data_pipelines/databearer_dbt/models/curated/`.

## Our World in Data APIs

Use these endpoints for OWID discovery and validation:

```text
https://ourworldindata.org/api/search?q=<query>
https://ourworldindata.org/api/search?q=<query>&type=pages
https://search.owid.io/indicators?q=<query>&limit=10
https://ourworldindata.org/grapher/<slug>.csv
https://ourworldindata.org/grapher/<slug>.metadata.json
https://ourworldindata.org/grapher/<slug>.readme.md
https://catalog.ourworldindata.org/<channel>/<dataset>/<version>/<dataset>/<table>.parquet
```

Use the helper scripts when available:

```bash
python scripts/research/search_owid.py "solar module prices battery prices"
python scripts/research/check_owid_chart.py solar-pv-prices
python scripts/research/source_scout.py "industrial electricity prices Germany"
```

## Other source entry points

Energy Charts:

```text
https://api.energy-charts.info/
```

Use existing helper:

```text
pipeline/src/tools/datasources/energy_charts/energy_charts_api_helper.py
```

GENESIS/Destatis:

```text
pipeline/src/tools/datasources/genesis_api_helper/
pipeline/src/config/datasource_metadata/datasources_genesis.yaml
```

AMECO:

```text
pipeline/src/tools/datasources/ameco_api_helper/
```

World Bank climate:

```text
pipeline/src/tools/datasources/world_bank_api_helper/
pipeline/src/config/datasource_metadata/world_bank_climate_queries.yaml
```

Bundesnetzagentur:

```text
pipeline/src/data_pipelines/get_raw_data/ingest_bnetza_data.py
pipeline/src/data_pipelines/databearer_dbt/models/cleaned/bnetza/
```

## Workflow

1. Restate the topic idea and identify the factual claim that needs support.
2. Search existing project source metadata first.
3. Search OWID chart/content APIs and semantic indicators for broader data.
4. Check promising chart metadata before recommending a source.
5. Inspect a CSV sample or Parquet query when the chart looks promising.
6. Evaluate whether the source supports a Databearer-style article.
7. Return a short verdict and next ingestion/post steps.

## Evaluation criteria

Score a source higher when it has:

- clear title, unit, citation, and methodology metadata
- enough history for trend analysis
- Germany, Europe, World, or relevant country coverage
- recent update date
- chartable time series or country comparison structure
- direct CSV/Parquet/API access
- a caveat that can be explained honestly

Score a source lower when it has:

- unclear units or hidden methodology
- one-off snapshots without trend context
- non-redistributable data
- weak relevance to energy, economy, or politics/society
- data that only indirectly supports the user's intended claim

## Output format

Use this structure by default:

```markdown
## Data Availability Verdict

Strong / possible / weak.

## Best Data Sources

1. Source title
   Source: ...
   URL/API: ...
   Coverage: ...
   Unit: ...
   Updated: ...
   Citation: ...
   Caveat: ...

## Databearer Angle

Suggested claim or story angle, written cautiously.

## Suggested Charts

- Chart idea 1
- Chart idea 2

## Ingestion Steps

- Add/update source metadata if needed.
- Add ingestion or reuse existing helper.
- Add cleaned/curated dbt model.
- Export frontend CSV.

## Risks

- Methodological or interpretation caveats.
```

Never present a data source as support for a strong claim unless the metadata
and data sample actually support that claim.
