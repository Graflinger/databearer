from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def clean_tables():
    with get_duckdb_connection() as con:

        # bnetza_windkraft_ausschreibung
        con.sql("""CREATE OR REPLACE TABLE cleaned.bnetza_windkraft_ausschreibung AS
                SELECT
                    Verfahren as procedure,
                    CAST(Gebotstermin AS DATE) as bid_date,
                    "Zuschlagsmenge (kW)" as awarded_quantity_kw
                FROM
                    staging.bnetza_windkraft_ausschreibung""")

        logging.info('Table cleaned.bnetza_windkraft_ausschreibung created')

        con.commit()


def main():
    clean_tables()


if __name__ == '__main__':
    main()
