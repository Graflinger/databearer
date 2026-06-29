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


def main() -> int:
    parser = argparse.ArgumentParser(description="Search Our World in Data charts, pages, and indicators.")
    parser.add_argument("query", help="Search query, e.g. 'solar module prices Germany'.")
    parser.add_argument("--limit", type=int, default=8, help="Maximum results per category.")
    parser.add_argument("--countries", help="Optional OWID country filter, separated with '~'.")
    parser.add_argument("--topics", help="Optional OWID topic filter for chart search.")
    parser.add_argument("--include-pages", action="store_true", help="Also search OWID pages/articles.")
    parser.add_argument("--json", action="store_true", help="Print raw JSON summary.")
    args = parser.parse_args()

    result = {
        "query": args.query,
        "charts": _safe_call(
            search_charts,
            args.query,
            args.limit,
            args.countries,
            args.topics,
        ),
        "indicators": _safe_call(search_indicators, args.query, args.limit),
        "pages": _safe_call(search_pages, args.query, min(args.limit, 5)) if args.include_pages else None,
    }

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(_format_markdown(result))
    return 0


def _safe_call(function, *args):
    try:
        return function(*args)
    except Exception as exc:  # pragma: no cover - CLI resilience
        return {"error": str(exc)}


def _format_markdown(result: dict) -> str:
    lines = [f"# OWID Search: {result['query']}", ""]

    lines.extend(["## Charts", ""])
    charts = result.get("charts") or {}
    if charts.get("error"):
        lines.append(f"Error: {charts['error']}")
    else:
        for item in charts.get("results", []):
            lines.append(f"- {item.get('title', '')}")
            lines.append(f"  URL: {item.get('url', '')}")
            lines.append(f"  Subtitle: {item.get('subtitle', '')}")
            lines.append(f"  Updated: {item.get('updatedAt', '')}")
            lines.append(f"  Tabs: {', '.join(item.get('availableTabs', []))}")
    lines.append("")

    lines.extend(["## Semantic Indicators", ""])
    indicators = result.get("indicators") or {}
    if indicators.get("error"):
        lines.append(f"Error: {indicators['error']}")
    else:
        for item in indicators.get("results", []):
            metadata = item.get("metadata", {}) or {}
            lines.append(f"- {item.get('title', '')}")
            lines.append(f"  Indicator ID: {item.get('indicator_id', '')}")
            lines.append(f"  Score: {item.get('score', '')}")
            lines.append(f"  Unit: {metadata.get('unit', '')}")
            lines.append(f"  Catalog path: {item.get('catalog_path', '')}")
            if metadata.get("parquet_url"):
                lines.append(f"  Parquet: {metadata.get('parquet_url')}")
    lines.append("")

    pages = result.get("pages")
    if pages is not None:
        lines.extend(["## Pages", ""])
        if pages.get("error"):
            lines.append(f"Error: {pages['error']}")
        else:
            for item in pages.get("results", []):
                lines.append(f"- {item.get('title', '')}")
                lines.append(f"  URL: {item.get('url', '')}")
                lines.append(f"  Date: {item.get('date', '')}")

    return "\n".join(lines).strip()


if __name__ == "__main__":
    raise SystemExit(main())
