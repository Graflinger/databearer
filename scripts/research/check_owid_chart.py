#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.owid import summarize_chart


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect an OWID Grapher chart's metadata and CSV structure.")
    parser.add_argument("slug_or_url", help="OWID Grapher slug or URL.")
    parser.add_argument("--sample-rows", type=int, default=300, help="CSV rows to sample for coverage inference.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    summary = summarize_chart(args.slug_or_url, rows=args.sample_rows)
    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print(_format_markdown(summary))
    return 0


def _format_markdown(summary: dict) -> str:
    lines = [
        f"# {summary.get('title') or summary.get('slug')}",
        "",
        f"URL: {summary.get('url', '')}",
        f"Subtitle: {summary.get('subtitle', '')}",
        f"Citation: {summary.get('citation', '')}",
        f"Downloaded metadata date: {summary.get('date_downloaded', '')}",
        "",
        "## Coverage",
        "",
        f"Time column: {summary.get('time_column', '')}",
        f"Time range in sample: {summary.get('time_min', '')} to {summary.get('time_max', '')}",
        f"Entities in sample: {summary.get('sample_entity_count', 0)}",
        f"Sample entities: {', '.join(summary.get('sample_entities', []))}",
        "",
        "## Data Columns",
        "",
    ]
    for column in summary.get("columns", []):
        lines.append(f"- {column}")
    return "\n".join(lines).strip()


if __name__ == "__main__":
    raise SystemExit(main())
