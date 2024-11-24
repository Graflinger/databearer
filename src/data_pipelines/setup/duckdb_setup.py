from __future__ import annotations

import duckdb

with duckdb.connect('.data/duckdb.db') as duckdb_conn:
    duckdb_conn.sql('CREATE SCHEMA IF NOT EXISTS staging')
    duckdb_conn.commit()
