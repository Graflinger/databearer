from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_income_expenses_bund_yearly_to_csv():
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
        SELECT
            fegy.year as Jahr,
            fegy.awarded_quantity_kw as 'Zuschlagsmenge (kW)'
        FROM
            curated.fact_energy_germany_yearly fegy
        ORDER BY
            fegy.year ASC
            )

        TO '.data/output/wind_energy_awarded.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/output.csv')


def main():
    export_income_expenses_bund_yearly_to_csv()


if __name__ == '__main__':
    main()
