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
            fby.Sozialbeiträge_an_den_Staat,
            fby.Steuereinnahmen_des_Bundes,
            fby.Sozialbeiträge_an_den_Staat + fby.Steuereinnahmen_des_Bundes as Steuern_Sozialbeiträge_kombiniert,
            fby.Bruttoinlandsprodukt,
            round (fby.Sozialbeiträge_an_den_Staat / fby.Bruttoinlandsprodukt * 100 , 4) as Anteil_Steuern_am_BIP,
            round (fby.Steuereinnahmen_des_Bundes / fby.Bruttoinlandsprodukt * 100, 4)
            as Anteil_Sozialbeiträge_am_BIP,
            round ((fby.Sozialbeiträge_an_den_Staat + fby.Steuereinnahmen_des_Bundes)
            / fby.Bruttoinlandsprodukt * 100, 4) as Anteil_Steuern_Sozialbeiträge_kombiniert_am_BIP

        FROM
            curated.fact_bund_yearly fby
        ORDER BY
            fby.year ASC
            )

        TO '.data/output/output.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/output.csv')


def main():
    export_income_expenses_bund_yearly_to_csv()


if __name__ == '__main__':
    main()
