from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_fact_energy_germany_yearly_table():
    with get_duckdb_connection() as con:

        con.sql(
            """
            CREATE OR REPLACE TABLE curated.fact_energy_germany_yearly AS
            WITH selected_columns AS (
            SELECT
                date_part('year', bwa.bid_date) as year,
                bwa.procedure,
                SUM(bwa.awarded_quantity_kw) as awarded_quantity_kw

            FROM
                cleaned.bnetza_windkraft_ausschreibung as bwa
            GROUP BY
                year, bwa.procedure
            )
            SELECT
                year,
                procedure,
                awarded_quantity_kw
            FROM
                selected_columns
            """,
        )

        con.commit()

        logging.info('Table curated.fact_energy_germany_yearly created')


def main():
    create_fact_energy_germany_yearly_table()


if __name__ == '__main__':
    main()
