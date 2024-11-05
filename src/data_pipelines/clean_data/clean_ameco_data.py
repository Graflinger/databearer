from __future__ import annotations

import logging

from src.tools.clean_utils.clean_utils import translate_countries
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def clean_unpivoted_tables_with_billion_euro_unit(table_name: str):
    with get_duckdb_connection() as con:

        table_columns = con.table('staging.' + table_name).columns

        year_columns = [col for col in table_columns if col.isnumeric()]

        table_df = con.table('staging.' + table_name).to_df()

        table_df = translate_countries(table_df)

        con.sql(
            f"""
            CREATE OR REPLACE TABLE cleaned.{table_name} AS
            WITH unpivoted_table AS
            (UNPIVOT table_df
            ON {",".join(year_columns)}
            INTO
                NAME year
                VALUE value),
            cleaned AS(
            SELECT
                country,
                label,
                'EUR' as unit,
                year,
                round(value * 1000000000, 0) as value
            FROM unpivoted_table)
            SELECT
                *
            FROM
                cleaned""",
        )

        con.commit()

        logging.info(f"Table cleaned.{table_name} created")


def main():
    billion_euro_tables = ['GDP_current_prices', 'GDP_constant_prices', 'gross_public_debt']

    for table in billion_euro_tables:
        clean_unpivoted_tables_with_billion_euro_unit('ameco_' + table)


if __name__ == '__main__':
    main()
