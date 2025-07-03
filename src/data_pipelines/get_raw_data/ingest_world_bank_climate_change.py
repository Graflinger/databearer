from __future__ import annotations

import logging

from src.tools.datasources.world_bank_api_helper.world_bank_api_helper import (
    get_world_bank_climate_change_knowledge_pandas_table,
    read_metadata_from_yaml,
)
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_world_bank_climate_change_tables():
    """
    Ingests climate change data from the World Bank API into a DuckDB database.
    """
    queries = read_metadata_from_yaml()

    for query in queries['queries']:
        name = query["name"]
        df = get_world_bank_climate_change_knowledge_pandas_table(query["value"])

        with get_duckdb_connection() as con:
            con.sql('USE staging')

            con.sql(
                f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM df",
            )

            con.commit()

            logging.info(f"Table {name} ingested into DuckDB")


def main():
    ingest_world_bank_climate_change_tables()


if __name__ == '__main__':
    main()
