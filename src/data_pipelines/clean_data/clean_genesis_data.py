from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

from src.tools.genesis_api_helper.datasources_utils import (
    datasource_meta_information,
    get_datasource_information,
)


def clean_unpivoted_tables(name: str):
    with get_duckdb_connection as con:

        table_meta_data = datasource_meta_information(name)

        cols_to_pivot = ",".join(
            x
            for x in con.table("staging," + table_meta_data.table_database_name).columns
            if x not in table_meta_data.index_columns
        )
        con.sql(
            f"""
                WITH unpivoted_table AS 
                (UNPIVOT staging.genesis_810000415
                ON {cols_to_pivot}
                INTO
                    NAME year
                    VALUE value),
                cleaned AS(SELECT {",".join(table_meta_data.index_columns)}, CAST(year AS INTEGER) as year,  CAST(replace(value, ',', '.') AS DOUBLE) * {table_meta_data.value_adjustment} as value
                FROM unpivoted_table)
                CREATE TABLE cleaned.{table_meta_data.table_database_name} AS SELECT * FROM cleaned"""
        )


def main():
    tables = get_datasource_information(type="tables")

    for table in tables:
        if table["table_type"] == "pivoted_table":
            clean_unpivoted_tables(table["name"])


if __name__ == "__main__":
    main()
