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
            year AS Jahr
            ,country AS Land
            ,debt_to_gdp_ratio AS Schuldenquote
        FROM
            duckdb.curated.fact_europe_economics_yearly
            where country in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
            AND year = 2024
                ORDER BY
            year ASC
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
                year AS Jahr
                ,country
                ,SUM(debt_to_gdp_growth_rate) OVER (PARTITION BY country ORDER BY YEAR ASC) AS debt_to_gdp_growth_rate
            FROM
                duckdb.curated.fact_europe_economics_yearly
                where country in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
                AND year > {year}
                )
            PIVOT debt_growth_rate ON country USING sum(debt_to_gdp_growth_rate)
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
                year AS Jahr
                ,country
                ,SUM(gdp_growth_rate) OVER (PARTITION BY country ORDER BY YEAR ASC) gdp_growth_cumulated
            FROM
                duckdb.curated.fact_europe_economics_yearly
                where country in ('Deutschland', 'Frankreich', 'Italien', 'Spanien')
                AND year > {year}
                )
            PIVOT gdp_growth ON country USING sum(gdp_growth_cumulated)
            ORDER BY Jahr asc)

            TO '.data/output/kranker_mann/Wirtschaftswachtum_von{year}.csv' (HEADER, DELIMITER ',');
            """,
            )

            logging.info(f'Exported data to .data/output/kranker_mann/Wirtschaftswachtum_von{year}.csv')


def main():
    export_ger_compared_to_fr_esp_it_to_csv()


if __name__ == '__main__':
    main()
