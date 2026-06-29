#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.owid import search_charts, search_indicators, search_pages


SOURCE_METADATA_DIR = REPO_ROOT / "pipeline" / "src" / "config" / "datasource_metadata"


def main() -> int:
    parser = argparse.ArgumentParser(description="Scout external data sources for a Databearer topic idea.")
    parser.add_argument("topic", help="Topic idea or claim to test.")
    parser.add_argument("--limit", type=int, default=8, help="Maximum OWID results per category.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    result = scout_topic(args.topic, limit=args.limit)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(format_markdown(result))
    return 0


def scout_topic(topic: str, limit: int = 8) -> dict:
    charts = _safe_call(search_charts, topic, limit)
    chart_query = topic
    if isinstance(charts, dict) and not charts.get("results"):
        fallback_query = remove_country_terms(topic)
        if fallback_query != topic:
            charts = _safe_call(search_charts, fallback_query, limit)
            chart_query = fallback_query
    indicators = _safe_call(search_indicators, topic, limit)
    pages = _safe_call(search_pages, topic, min(limit, 5))
    local_matches = find_local_source_matches(topic)
    ranked_charts = rank_charts(topic, charts.get("results", []) if isinstance(charts, dict) else [])
    ranked_indicators = rank_indicators(indicators.get("results", []) if isinstance(indicators, dict) else [])

    strong_count = len(ranked_charts[:3]) + len(ranked_indicators[:3]) + len(local_matches)
    verdict = "strong" if strong_count >= 4 else "possible" if strong_count else "weak"

    return {
        "topic": topic,
        "chart_query": chart_query,
        "verdict": verdict,
        "local_matches": local_matches,
        "charts": ranked_charts,
        "indicators": ranked_indicators,
        "pages": pages.get("results", []) if isinstance(pages, dict) else [],
        "errors": [
            value.get("error")
            for value in (charts, indicators, pages)
            if isinstance(value, dict) and value.get("error")
        ],
    }


def find_local_source_matches(topic: str) -> list[dict[str, str]]:
    terms = [term for term in topic.lower().replace("-", " ").split() if len(term) > 3]
    matches: list[dict[str, str]] = []
    if not SOURCE_METADATA_DIR.exists():
        return matches

    for path in SOURCE_METADATA_DIR.glob("*.yaml"):
        text = path.read_text(encoding="utf-8")
        lowered = text.lower()
        matched_terms = sorted({term for term in terms if term in lowered})
        if matched_terms:
            matches.append(
                {
                    "file": str(path.relative_to(REPO_ROOT)),
                    "matched_terms": ", ".join(matched_terms),
                }
            )
    return matches


def remove_country_terms(topic: str) -> str:
    country_terms = {
        "germany",
        "german",
        "deutschland",
        "deutsche",
        "europe",
        "european",
        "europa",
        "europaeisch",
        "europäisch",
    }
    terms = [term for term in topic.split() if term.lower().strip(",.;:") not in country_terms]
    return " ".join(terms).strip() or topic


def rank_charts(topic: str, charts: list[dict]) -> list[dict]:
    terms = [term for term in topic.lower().replace("-", " ").split() if len(term) > 3]
    ranked = []
    for chart in charts:
        text = " ".join(
            str(chart.get(key, "")) for key in ("title", "subtitle", "variantName")
        ).lower()
        entities = chart.get("availableEntities", [])
        tabs = chart.get("availableTabs", [])
        score = sum(2 for term in terms if term in text)
        score += 2 if any(entity in entities for entity in ("Germany", "World", "Europe")) else 0
        score += 1 if any(tab in tabs for tab in ("LineChart", "Table", "WorldMap")) else 0
        score += 1 if chart.get("updatedAt") else 0
        ranked.append({**chart, "databearer_score": score})
    return sorted(ranked, key=lambda item: item.get("databearer_score", 0), reverse=True)


def rank_indicators(indicators: list[dict]) -> list[dict]:
    return sorted(
        indicators,
        key=lambda item: (item.get("score") or 0) + (item.get("popularity") or 0),
        reverse=True,
    )


def format_markdown(result: dict) -> str:
    lines = [
        "## Data Availability Verdict",
        "",
        f"{result['verdict'].capitalize()} candidate for: {result['topic']}",
        "",
    ]

    if result.get("errors"):
        lines.extend(["## API Warnings", ""])
        for error in result["errors"]:
            lines.append(f"- {error}")
        lines.append("")

    lines.extend(["## Existing Databearer Source Matches", ""])
    if result["local_matches"]:
        for item in result["local_matches"]:
            lines.append(f"- {item['file']} ({item['matched_terms']})")
    else:
        lines.append("- No configured source metadata matched the topic terms.")
    lines.append("")

    lines.extend(["## Best OWID Charts", ""])
    if result.get("chart_query") and result["chart_query"] != result["topic"]:
        lines.append(f"Fallback chart search query: {result['chart_query']}")
        lines.append("")
    for item in result["charts"][:5]:
        lines.append(f"- {item.get('title', '')}")
        lines.append(f"  URL: {item.get('url', '')}")
        lines.append(f"  Subtitle: {item.get('subtitle', '')}")
        lines.append(f"  Updated: {item.get('updatedAt', '')}")
        lines.append(f"  Score: {item.get('databearer_score', 0)}")
    if not result["charts"]:
        lines.append("- No OWID charts found.")
    lines.append("")

    lines.extend(["## Best OWID Indicators", ""])
    for item in result["indicators"][:5]:
        metadata = item.get("metadata", {}) or {}
        lines.append(f"- {item.get('title', '')}")
        lines.append(f"  Indicator ID: {item.get('indicator_id', '')}")
        lines.append(f"  Unit: {metadata.get('unit', '')}")
        lines.append(f"  Catalog path: {item.get('catalog_path', '')}")
        if metadata.get("parquet_url"):
            lines.append(f"  Parquet: {metadata.get('parquet_url')}")
    if not result["indicators"]:
        lines.append("- No OWID semantic indicators found.")
    lines.append("")

    lines.extend(
        [
            "## Suggested Next Steps",
            "",
            "- Inspect the top chart metadata with `scripts/research/check_owid_chart.py`.",
            "- Confirm units, coverage, and citation before drafting claims.",
            "- If the source is strong, add ingestion/dbt/export work through the data pipeline.",
        ]
    )
    return "\n".join(lines).strip()


def _safe_call(function, *args):
    try:
        return function(*args)
    except Exception as exc:  # pragma: no cover - CLI resilience
        return {"error": str(exc)}


if __name__ == "__main__":
    raise SystemExit(main())
