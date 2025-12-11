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
            feey.jahr AS Jahr,
            feey.land AS Land,
            feey.bruttostaatsverschuldung AS Staatsverchuldung,
            feey.bip_nominal AS 'BIP nominell',
            feey.schulden_zu_bip_verhältnis AS 'Schulden zu BIP Verhältnis (%)',
            feey.neuverschuldung AS 'Jährliche Neuverschuldung',
        FROM
            prod_curated.fact_economy_europe_yearly feey
        WHERE feey.land = 'Deutschland'
        ORDER BY
            feey.land ASC,
            feey.jahr ASC


            )

        TO '.data/output/schulden_richtig_messen/deutschland_übersicht.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/schulden_richtig_messen/deutschland_übersicht.csv')


def main():
    export_gross_debt_and_debt_gdp_ratio_to_csv()


if __name__ == '__main__':
    main()
