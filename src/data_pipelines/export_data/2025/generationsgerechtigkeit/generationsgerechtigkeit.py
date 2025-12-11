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
            segy.jahr,
            segy.Insgesamt_ausgaben_am_bip_prozent AS 'Bildungsausgaben in Prozent vom BIP'
        FROM
            prod_curated.socio_economic_germany_yearly as segy
        LEFT JOIN
            prod_curated.fact_ecnonomy_germany_yearly as fegy
            ON segy.jahr = fegy.year

            )

        TO '.data/output/generationsgerechtigkeit.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/generationsgerechtigkeit.csv')


def main():
    export_income_expenses_bund_yearly_to_csv()


if __name__ == '__main__':
    main()
