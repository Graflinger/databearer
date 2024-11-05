from __future__ import annotations

import logging

from src.tools.ameco_api_helper.ameco_api_utils import get_ameco_pandas_table
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_ameco_tables():
    tables = {
        'gross_public_debt': '1.0.99.0.UDGG',
        'GDP_current_prices': '1.0.99.0.UVGD',
        'GDP_constant_prices': '1.1.0.0.OVGD',
    }

    with get_duckdb_connection() as con:
        con.sql('USE staging')
        for table_name, ameco_variable in tables.items():

            df = get_ameco_pandas_table(ameco_variable)

            con.sql(
                f"CREATE OR REPLACE TABLE ameco_{table_name} "
                'AS SELECT * FROM df',
            )

            con.commit()

            logging.info(f"Table {table_name} ingested into duckdb")


def main():
    ingest_ameco_tables()


if __name__ == '__main__':
    main()
