from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_gross_debt_and_debt_gdp_ratio_to_csv():
    with get_duckdb_connection() as con:
        result = con.sql(
            """
        COPY (
        SELECT
            feey.year AS Jahr,
            feey.country AS Land,
            feey.gross_public_debt AS Staatsverchuldung,
            feey.GDP_current_prices AS 'BIP nominell',
            feey.debt_to_gdp_ratio AS 'Schulden zu BIP Verhältnis (%)',
            feey.yearly_new_debt AS 'Jährliche Neuverschuldung',
        FROM
            curated.fact_europe_economics_yearly feey
        WHERE country = 'Deutschland'
        ORDER BY
            feey.country ASC,
            feey.year ASC


            )

        TO '.data/output/schulden_richtig_messen/deutschland_übersicht.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/schulden_richtig_messen/deutschland_übersicht.csv')


def main():
    export_gross_debt_and_debt_gdp_ratio_to_csv()


if __name__ == '__main__':
    main()
