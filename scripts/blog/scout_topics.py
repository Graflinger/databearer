#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = REPO_ROOT / "pipeline" / ".data" / "duckdb.db"
NUMERIC_MARKERS = ("INT", "DOUBLE", "FLOAT", "REAL", "DECIMAL", "NUMERIC", "BIGINT", "HUGEINT")
TIME_MARKERS = ("date", "datum", "year", "jahr", "time", "monat")
CATEGORY_MARKERS = (
    "land",
    "ländercode",
    "laendercode",
    "country",
    "code",
    "region",
    "gruppe",
    "kategorie",
    "verfahren",
    "quelle",
)
DERIVED_HELPER_MARKERS = ("vorjahr", "letztes_jahr", "letztes_yahr", "previous")


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan curated DuckDB tables for possible blog topic signals.")
    parser.add_argument("--database", default=str(DEFAULT_DB), help="DuckDB database path.")
    parser.add_argument("--schema", default="prod_curated", help="Schema to scan.")
    parser.add_argument("--limit", type=int, default=8, help="Maximum candidates to print.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    result = scout_database(Path(args.database), schema=args.schema, limit=args.limit)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    else:
        print(format_markdown(result))
    return 0


def scout_database(database: Path, schema: str, limit: int) -> dict[str, Any]:
    if not database.exists():
        return {
            "database": str(database),
            "schema": schema,
            "candidates": [],
            "error": "DuckDB database not found. Run ingestion/dbt first from pipeline/.",
        }

    try:
        import duckdb
    except ImportError:
        return {
            "database": str(database),
            "schema": schema,
            "candidates": [],
            "error": "duckdb Python package is not installed in this environment.",
        }

    with duckdb.connect(str(database), read_only=True) as con:
        tables = con.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            ORDER BY table_name
            """,
            [schema],
        ).fetchall()
        candidates: list[dict[str, Any]] = []
        for (table_name,) in tables:
            candidates.extend(scan_table(con, schema, table_name))

    return {
        "database": str(database),
        "schema": schema,
        "candidates": sorted(candidates, key=lambda item: item["score"], reverse=True)[:limit],
        "error": "",
    }


def scan_table(con, schema: str, table_name: str) -> list[dict[str, Any]]:
    columns = con.execute(f"DESCRIBE {qident(schema)}.{qident(table_name)}").fetchall()
    column_types = {row[0]: str(row[1]).upper() for row in columns}
    time_column = choose_time_column(list(column_types))
    category_column = choose_category_column(list(column_types), time_column)
    numeric_columns = [
        column
        for column, dtype in column_types.items()
        if any(marker in dtype for marker in NUMERIC_MARKERS) and not is_derived_helper_column(column)
    ]
    if not time_column or not numeric_columns:
        return []

    candidates = []
    for column in numeric_columns:
        rows = latest_rows_for_metric(con, schema, table_name, time_column, column, category_column)
        if len(rows) < 2:
            continue
        latest_row, previous_row = rows[0], rows[1]
        latest_time = latest_row["time"]
        latest_value = latest_row["value"]
        previous_time = previous_row["time"]
        previous_value = previous_row["value"]
        category_value = latest_row.get("category") or ""
        if previous_value in (None, 0):
            continue

        min_value, max_value = con.execute(
            f"""
            SELECT MIN({qident(column)}), MAX({qident(column)})
            FROM {qident(schema)}.{qident(table_name)}
            WHERE {qident(column)} IS NOT NULL
            """
        ).fetchone()
        pct_change = (float(latest_value) - float(previous_value)) / abs(float(previous_value)) * 100
        record = "record high" if latest_value == max_value else "record low" if latest_value == min_value else ""
        score = abs(pct_change) + (50 if record else 0)
        if score < 10:
            continue

        candidates.append(
            {
                "title": candidate_title(table_name, column, record),
                "table": f"{schema}.{table_name}",
                "metric": column,
                "category_column": category_column,
                "category_value": str(category_value),
                "time_column": time_column,
                "latest_time": str(latest_time),
                "latest_value": float(latest_value),
                "previous_time": str(previous_time),
                "previous_value": float(previous_value),
                "pct_change": round(pct_change, 2),
                "record": record,
                "score": round(score, 2),
                "suggested_chart": f"Line chart of {column} by {time_column}",
                "caveat": "Check source definition, latest-period completeness, and units before drafting.",
            }
        )
    return candidates


def choose_time_column(columns: list[str]) -> str:
    for marker in TIME_MARKERS:
        for column in columns:
            if marker in column.lower():
                return column
    return ""


def choose_category_column(columns: list[str], time_column: str) -> str:
    candidates = [column for column in columns if column != time_column]
    for marker in CATEGORY_MARKERS:
        for column in candidates:
            if marker in column.lower():
                return column
    return ""


def is_derived_helper_column(column: str) -> bool:
    lowered = column.lower()
    return any(marker in lowered for marker in DERIVED_HELPER_MARKERS)


def latest_rows_for_metric(
    con,
    schema: str,
    table_name: str,
    time_column: str,
    metric_column: str,
    category_column: str,
) -> list[dict[str, Any]]:
    table_ref = f"{qident(schema)}.{qident(table_name)}"
    if category_column:
        rows = con.execute(
            f"""
            WITH latest_category AS (
                SELECT {qident(category_column)} AS category
                FROM {table_ref}
                WHERE {qident(time_column)} IS NOT NULL
                  AND {qident(metric_column)} IS NOT NULL
                  AND {qident(category_column)} IS NOT NULL
                ORDER BY {qident(time_column)} DESC, {qident(category_column)} ASC
                LIMIT 1
            )
            SELECT
                {qident(time_column)} AS time,
                {qident(metric_column)} AS value,
                {qident(category_column)} AS category
            FROM {table_ref}
            WHERE {qident(time_column)} IS NOT NULL
              AND {qident(metric_column)} IS NOT NULL
              AND {qident(category_column)} = (SELECT category FROM latest_category)
            ORDER BY {qident(time_column)} DESC
            LIMIT 2
            """
        ).fetchall()
        return [{"time": row[0], "value": row[1], "category": row[2]} for row in rows]

    rows = con.execute(
        f"""
        SELECT {qident(time_column)}, {qident(metric_column)}
        FROM {table_ref}
        WHERE {qident(time_column)} IS NOT NULL AND {qident(metric_column)} IS NOT NULL
        ORDER BY {qident(time_column)} DESC
        LIMIT 2
        """
    ).fetchall()
    return [{"time": row[0], "value": row[1]} for row in rows]


def candidate_title(table_name: str, column: str, record: str) -> str:
    readable_metric = column.replace("_", " ")
    readable_table = table_name.replace("fact_", "").replace("_", " ")
    if record:
        return f"{readable_metric} reaches a {record} in {readable_table}"
    return f"Notable change in {readable_metric} for {readable_table}"


def format_markdown(result: dict[str, Any]) -> str:
    lines = ["## Top Topic Candidates", ""]
    if result.get("error"):
        lines.append(f"Error: {result['error']}")
        return "\n".join(lines)

    if not result["candidates"]:
        lines.append("No strong candidates found with the current heuristic scan.")
        return "\n".join(lines)

    for index, candidate in enumerate(result["candidates"], start=1):
        lines.append(f"{index}. {candidate['title']}")
        lines.append(f"   Signal: {candidate['pct_change']}% change from {candidate['previous_time']} to {candidate['latest_time']}")
        lines.append(f"   Source table: {candidate['table']}")
        lines.append(f"   Metric: {candidate['metric']}")
        if candidate.get("category_value"):
            lines.append(f"   Segment: {candidate['category_column']} = {candidate['category_value']}")
        lines.append(f"   Latest value: {candidate['latest_value']}")
        if candidate["record"]:
            lines.append(f"   Record: {candidate['record']}")
        lines.append(f"   Suggested chart: {candidate['suggested_chart']}")
        lines.append(f"   Caveat: {candidate['caveat']}")
        lines.append("")
    return "\n".join(lines).strip()


def qident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


if __name__ == "__main__":
    raise SystemExit(main())
