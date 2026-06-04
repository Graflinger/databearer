from __future__ import annotations

import duckdb

from src.config.parameter_handler import retrieve_parameter_value_by_name


def create_duckdb_conform_name(name: str) -> str:
    name = name.replace('-', '')

    return name


def get_duckdb_connection(
    duckdb_database: str = 'duckdb_location',
) -> duckdb.DuckDBPyConnection:
    duckdb_location = retrieve_parameter_value_by_name(duckdb_database)

    return duckdb.connect(duckdb_location)
