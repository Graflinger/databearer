from __future__ import annotations

import logging

from src.tools.datasources.genesis_api_helper.datasources_utils import (
    get_datasource_information,
)
from src.tools.datasources.genesis_api_helper.genesis_api_helper import get_pandas_table
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_genesis_tables():
    datasources = get_datasource_information(type='tables')

    with get_duckdb_connection() as con:

        con.sql('USE staging')

        for table in datasources:

            name = table['name']

            df = get_pandas_table(name)

            con.sql(
                f"CREATE OR REPLACE TABLE {table["table_database_name"]} "
                'AS SELECT * FROM df',
            )

            con.commit()

            logging.info(f"Table {table["table_database_name"]} ingested into duckdb")


def main():
    ingest_genesis_tables()


if __name__ == '__main__':
    main()
