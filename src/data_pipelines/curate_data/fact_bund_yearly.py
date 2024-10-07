from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_fact_bund_yearly_table():
    with get_duckdb_connection() as con:

        con.sql(
            """
            CREATE OR REPLACE TABLE curated.fact_bund_yearly AS
            SELECT
                vgr_bund.*
            FROM cleaned.genesis_VGR_BUND_810000031 as vgr_bund
            """,
        )

        con.commit()

        logging.info('Table curated.fact_bund_yearly created')


def main():
    create_fact_bund_yearly_table()


if __name__ == '__main__':
    main()
