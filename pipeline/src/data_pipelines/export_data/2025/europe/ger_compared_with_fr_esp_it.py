from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_ger_compared_to_fr_esp_it_to_csv():
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
        SELECT
            jahr AS Jahr
            ,land AS Land
            ,schulden_zu_bip_verhältnis AS Schuldenquote
        FROM
            prod_curated.fact_economy_europe_yearly
            where land in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
            AND jahr = 2024
                ORDER BY
            jahr ASC
            )

        TO '.data/output/kranker_mann/schuldenquoten.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/kranker_mann/schuldenquoten.csv')

        for year in [2000, 2021]:
            con.sql(
                f"""
            COPY (
            WITH debt_growth_rate AS (
            SELECT
                jahr AS Jahr
                ,land
                ,SUM(schulden_zu_bip_verhältnis_veränderung) OVER (PARTITION BY land ORDER BY jahr ASC) AS "Schulden zu BIP Verhältnis Veränderung kumuliert"
            FROM
                prod_curated.fact_economy_europe_yearly
                where land in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
                AND jahr > {year}
                )
            PIVOT debt_growth_rate ON land USING sum("Schulden zu BIP Verhältnis Veränderung kumuliert")
            ORDER BY Jahr ASC)

            TO '.data/output/kranker_mann/schuldenwachstum_von_{year}.csv' (HEADER, DELIMITER ',');
            """,
            )

            logging.info(f'Exported data to .data/output/kranker_mann/schuldenwachstum_{year}.csv')
            con.sql(
                f"""
            COPY (
            WITH gdp_growth AS (
            SELECT
                jahr AS Jahr
                ,land
                ,SUM(bip_wachstumsrate) OVER (PARTITION BY land ORDER BY jahr ASC) "BIP Wachstum kumuliert"
            FROM
                prod_curated.fact_economy_europe_yearly
                where land in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
                AND jahr > {year}
                )
            PIVOT gdp_growth ON land USING sum("BIP Wachstum kumuliert")
            ORDER BY Jahr asc)

            TO '.data/output/kranker_mann/Wirtschaftswachtum_von{year}.csv' (HEADER, DELIMITER ',');
            """,
            )

            logging.info(f'Exported data to .data/output/kranker_mann/Wirtschaftswachtum_von{year}.csv')


def main():
    export_ger_compared_to_fr_esp_it_to_csv()


if __name__ == '__main__':
    main()
