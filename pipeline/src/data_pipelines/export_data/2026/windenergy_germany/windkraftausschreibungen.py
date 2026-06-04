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
            fegy.datum,
            fegy.zuschlagsmenge_wind_kw as "Zuschlagsmenge in kw",
            fegy.gebotsmenge_wind_kw as "Gebotsmenge in kw",
            fegy.ausschreibungsvolumen_kw as "Ausschreibungsvolumen in kw",
            fegy.zuschlagswert_ct_kwh_gew_mittel as "Durchschnittlicher Zuschlagswert in ct/kWh"
        FROM
            prod_curated.fact_wind_energy_awarded fegy
        ORDER BY
            fegy.datum ASC
            )

        TO '.data/output/wind_energy_awarded.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/wind_energy_awarded.csv')


def main():
    export_income_expenses_bund_yearly_to_csv()


if __name__ == '__main__':
    main()
