from __future__ import annotations

import logging

from src.tools.datasources.genesis_api_helper.datasources_utils import (
    datasource_meta_information,
)
from src.tools.datasources.genesis_api_helper.datasources_utils import (
    get_datasource_information,
)
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def clean_unpivoted_tables(name: str):
    with get_duckdb_connection() as con:

        table_meta_data = datasource_meta_information(name)
        table = con.table('staging.' + table_meta_data.table_database_name)
        cols_to_pivot = ','.join(
            column
            for column in table.columns
            if column not in table_meta_data.index_columns
        )
        con.sql(
            f"""
            CREATE OR REPLACE TABLE cleaned.{table_meta_data.table_database_name} AS
            WITH unpivoted_table AS
            (UNPIVOT staging.{table_meta_data.table_database_name}
            ON {cols_to_pivot}
            INTO
                NAME year
                VALUE value),
            cleaned AS(
                SELECT {",".join([f"replace(trim({x}), ' ', '_') AS {x}" for x in table_meta_data.index_columns])}
                ,CAST(year AS INTEGER) as year
                ,round(value * {table_meta_data.value_adjustment}, 2) as value
            FROM unpivoted_table),
            pivoted_by_index AS(
                PIVOT cleaned
                ON {",".join(table_meta_data.pivot_columns)}
                USING max(value)
            )
            SELECT
                *
            FROM
                pivoted_by_index
            WHERE
                {table_meta_data.where_clause}""",
        )

        con.commit()

        logging.info(f"Table cleaned.{table_meta_data.table_database_name} created")


def main():
    tables = get_datasource_information(type='tables')

    for table in tables:
        if table['table_type'] == 'pivoted':
            clean_unpivoted_tables(table['name'])


if __name__ == '__main__':
    main()
