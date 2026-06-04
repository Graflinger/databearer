from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_battery_pv_to_csv():
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
        SELECT
            ftwy.jahr,
            ftwy.batterie_preis_usd_pro_kwh AS 'Batterie Preis in USD pro kW',
            round(ftwy.solar_modul_kosten_usd_pro_watt * 1000, 2) AS 'Solar Modul Kosten in USD pro kWh',
            rechenleistung_flops AS 'Rechenleistung in gigaFLOPS'
            
        FROM
            prod_curated.fact_technology_world_yearly as ftwy
            )

        TO '.data/output/industriepolitik_battery_pv_flops.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/industriepolitik_battery_pv_flops.csv')
        
        con.sql(
            """
        COPY (
        WITH electricity_data AS (
            SELECT
                fetcy.jahr,
                fetcy.land,
                fetcy.strom_anteil_prozent
            FROM
                prod_curated.fact_energy_transition_by_country_yearly as fetcy
            WHERE land in ('European Union (27)', 'Norway','United States','China','Germany', 'World')    
             )
        PIVOT electricity_data
        ON land
        USING max(strom_anteil_prozent)   
        )
        TO '.data/output/industriepolitik_share_electricity.csv' (HEADER, DELIMITER ',');
        """,
        )
        
        logging.info('Exported data to .data/output/industriepolitik_share_electricity.csv')

        con.sql(
            """
        COPY (
        WITH ev_data AS (
        SELECT
            fetcy.jahr,
            fetcy.land,
            fetcy.ev_anteil_prozent
        FROM
            prod_curated.fact_energy_transition_by_country_yearly as fetcy
        WHERE land in ('European Union (27)', 'Norway','United States','China','Germany', 'World'))
        PIVOT ev_data
        ON land
        USING max(ev_anteil_prozent)
            )
        TO '.data/output/industriepolitik_ev_share.csv' (HEADER, DELIMITER ',');
        """,
        )
        logging.info('Exported data to .data/output/industriepolitik_ev_share.csv')


def main():
    export_battery_pv_to_csv()


if __name__ == '__main__':
    main()
