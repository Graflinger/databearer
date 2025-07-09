from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_renewable_statistics():
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
            SELECT 
                datum,
                anteil_eeg as "Anteil EEG in %",
            FROM
                prod_curated.fact_energy_germany_monthly
            )
        
        TO '.data/output/energy_germany_monthly.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/energy_germany_monthly.csv')
        
        con.sql(
            """
        COPY (
            SELECT 
                jahr,
                anteil_eeg as "Anteil EEG in %",
            FROM
                prod_curated.fact_energy_germany_yearly
            )
        
        TO '.data/output/energy_germany_yearly.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/energy_germany_yearly.csv')


def main():
    export_renewable_statistics()


if __name__ == '__main__':
    main()
