from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_income_expenses_bund_yearly_to_csv():
    with get_duckdb_connection() as con:
        result = con.sql(
            """
            COPY (
            SELECT
                fby.year,
                fby.Ausgaben_des_Staates,
                fby.Einnahmen_des_Staates
            FROM
                curated.fact_bund_yearly fby
                )
            TO '.data/output/output.csv' (HEADER, DELIMITER ',');
            """,
        )


def main():
    export_income_expenses_bund_yearly_to_csv()


if __name__ == '__main__':
    main()
