from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_heat_projection_yearly_to_csv():
    with get_duckdb_connection() as con:
        result = con.sql(
            """
        WITH selection AS (
            SELECT
                Jahr,
                Ländercode AS Land,
                Hitzetageprognose
            FROM
                prod_curated.fact_climate_projections_yearly_by_country
                WHERE Ländercode in ('FRA', 'DEU', 'UK', 'ESP', 'ITA')
            )
        PIVOT selection
        on Land
        using sum(Hitzetageprognose)
        """
        )

        df = result.df()

        df = df.rename(columns={
            'FRA': 'Frankreich',
            'DEU': 'Deutschland',
            'UK': 'Vereinigtes Königreich',
            'ESP': 'Spanien',
            'ITA': 'Italien',
        })

        df.to_csv(".data/output/heat_projection_europe.csv", index=False)
        logging.info("Exported data to .data/output/heat_projection_europe.csv")


def main():
    export_heat_projection_yearly_to_csv()


if __name__ == '__main__':
    main()
