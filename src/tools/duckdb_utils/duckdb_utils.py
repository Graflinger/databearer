import duckdb

from src.config.parameter_handler import retrieve_parameter_value_by_name


def create_duckdb_conform_name(name: str) -> str:
    """
    manipulates the name of a table to be conform with the
    duckdb naming conventions

    Args:
        name: str: the name of the table

    Returns:
        str: the name of the table conform with the duckdb naming conventions

    """
    name = name.replace("-", "")

    return name


def get_duckdb_connection(
    duckdb_database: str = "duckdb_location",
) -> duckdb.DuckDBPyConnection:
    """
    Returns a connection to a duckdb database

    Args:
        duckdb_database: str: name of the duckdb
        database from config parameters

    Returns:
        duckdb.Connection: the connection to the duckdb database

    """
    duckdb_location = retrieve_parameter_value_by_name(duckdb_database)

    return duckdb.connect(duckdb_location)


def get_cols_from_table(
    table_name: str, con: duckdb.DuckDBPyConnection
) -> list:
    """
    Returns the columns of a table

    Args:
        table_name: str: the name of the table
        con: duckdb.Connection: the connection to the duckdb database

    Returns:
        list: the columns of the table

    """
    return con.table(table_name).columns