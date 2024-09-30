from __future__ import annotations

import duckdb

duckdb_conn = duckdb.connect('.data/duckdb.db')

# create schemas
duckdb_conn.sql('CREATE SCHEMA IF NOT EXISTS staging')
duckdb_conn.sql('CREATE SCHEMA IF NOT EXISTS cleaned')
duckdb_conn.sql('CREATE SCHEMA IF NOT EXISTS curated')
duckdb_conn.commit()

duckdb_conn.close()
