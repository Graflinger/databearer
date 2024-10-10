from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_fact_bund_yearly_table():
    with get_duckdb_connection() as con:

        con.sql(
            """
            CREATE OR REPLACE TABLE curated.fact_bund_yearly AS
            SELECT
                vgr_bund.year,
                vgr_bund.Sozialbeiträge_an_den_Staat,
                steuern_einnahmen.Steuereinnahmen_des_Bundes,
                bip_yearly.Bruttoinlandsprodukt
            FROM
                cleaned.genesis_VGR_BUND_810000031 as vgr_bund
            LEFT JOIN
                cleaned.genesis_steuern_einnahmen_712110002 as steuern_einnahmen
                ON vgr_bund.year = steuern_einnahmen.year
            LEFT JOIN
                cleaned.genesis_VGR_BUND_810000001 as bip_yearly
                ON vgr_bund.year = bip_yearly.year
            """,
        )

        con.commit()

        logging.info('Table curated.fact_bund_yearly created')


def main():
    create_fact_bund_yearly_table()


if __name__ == '__main__':
    main()
