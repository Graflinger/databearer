# Databearer Automation Scripts

These scripts support interactive OpenCode workflows for research, post work,
and social distribution. They are intentionally small and deterministic so an
agent can run them, inspect output, and make repo changes with clear context.

## Research

```bash
python scripts/research/search_owid.py "solar module prices" --limit 5
python scripts/research/check_owid_chart.py solar-pv-prices
python scripts/research/source_scout.py "solar module prices Germany"
```

## Blog Helpers

```bash
python scripts/blog/latest_post.py
python scripts/blog/scout_topics.py --schema prod_curated --limit 8
```

The topic scout expects `pipeline/.data/duckdb.db` to exist. If it is missing
or stale, run the relevant pipeline ingestion/dbt steps from `pipeline/` first.

## Social Copy Preparation

Preview copy:

```bash
python scripts/social/generate_social_copy.py --latest
python scripts/social/generate_social_copy.py --post frontend/src/posts/2026/example.md --json
```

There are intentionally no scripts for automated posting and no social media
credentials in this repository. Copy the generated text manually into each
platform.
