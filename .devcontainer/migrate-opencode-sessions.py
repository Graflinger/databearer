#!/usr/bin/env python3
from __future__ import annotations

import os
import sqlite3
from pathlib import PurePosixPath
from typing import Iterable


CANONICAL_DIR = "/workspaces/databearer"
WORKSPACE_NAME = PurePosixPath(CANONICAL_DIR).name
DB_PATH = os.path.expanduser("~/.local/share/opencode/opencode.db")


def is_host_workspace_path(value: object) -> bool:
    if not isinstance(value, str):
        return False

    path = PurePosixPath(value)
    return value.startswith("/Users/") and path.name == WORKSPACE_NAME


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def columns_for(connection: sqlite3.Connection, table: str) -> list[str]:
    return [
        row["name"]
        for row in connection.execute(f"pragma table_info({quote_identifier(table)})")
    ]


def first_matching_column(columns: Iterable[str], names: set[str]) -> str | None:
    by_lower = {column.lower(): column for column in columns}
    for name in names:
        if name in by_lower:
            return by_lower[name]
    return None


def find_project_table(connection: sqlite3.Connection, tables: list[str]) -> tuple[str, str, str] | None:
    candidates = []
    for table in tables:
        columns = columns_for(connection, table)
        id_column = first_matching_column(columns, {"id"})
        directory_column = first_matching_column(columns, {"directory", "worktree"})
        if id_column and directory_column:
            candidates.append((table, id_column, directory_column))

    for candidate in candidates:
        if "project" in candidate[0].lower():
            return candidate
    return candidates[0] if candidates else None


def find_session_tables(connection: sqlite3.Connection, tables: list[str]) -> list[tuple[str, str, str, str]]:
    candidates = []
    for table in tables:
        columns = columns_for(connection, table)
        project_column = first_matching_column(columns, {"projectid", "project_id"})
        directory_column = first_matching_column(columns, {"directory", "worktree"})
        id_column = first_matching_column(columns, {"id"})
        if project_column and directory_column and id_column:
            candidates.append((table, id_column, project_column, directory_column))

    return [candidate for candidate in candidates if "session" in candidate[0].lower()]


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"OpenCode database does not exist yet: {DB_PATH}")
        return 0

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        tables = [
            row["name"]
            for row in connection.execute(
                "select name from sqlite_master where type = 'table' order by name"
            )
        ]
        project_table = find_project_table(connection, tables)
        if project_table is None:
            print("Could not find an OpenCode project table; no session migration applied")
            return 0

        project_table_name, project_id_column, project_directory_column = project_table
        project_rows = list(
            connection.execute(
                f"select {quote_identifier(project_id_column)} as id, "
                f"{quote_identifier(project_directory_column)} as directory "
                f"from {quote_identifier(project_table_name)}"
            )
        )
        canonical_project_ids = [
            row["id"] for row in project_rows if row["directory"] == CANONICAL_DIR
        ]
        if not canonical_project_ids:
            print(f"Could not find project record for {CANONICAL_DIR}; no session migration applied")
            return 0

        canonical_project_id = canonical_project_ids[0]
        global_project_ids = {
            row["id"]
            for row in project_rows
            if row["id"] == "global" or row["directory"] in (None, "", "global")
        }
        global_project_ids.add("global")

        updated = 0
        for table, id_column, project_column, directory_column in find_session_tables(connection, tables):
            table_sql = quote_identifier(table)
            rows = list(
                connection.execute(
                    f"select {quote_identifier(id_column)} as id, "
                    f"{quote_identifier(project_column)} as project_id, "
                    f"{quote_identifier(directory_column)} as directory "
                    f"from {table_sql} "
                    f"where {quote_identifier(directory_column)} is not null"
                )
            )
            for row in rows:
                if row["project_id"] not in global_project_ids:
                    continue
                if not is_host_workspace_path(row["directory"]):
                    continue

                connection.execute(
                    f"update {table_sql} set "
                    f"{quote_identifier(project_column)} = ?, "
                    f"{quote_identifier(directory_column)} = ? "
                    f"where {quote_identifier(id_column)} = ?",
                    (canonical_project_id, CANONICAL_DIR, row["id"]),
                )
                updated += 1

        connection.commit()
        print(f"Normalized {updated} OpenCode database path record(s) to {CANONICAL_DIR}")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
