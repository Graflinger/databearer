import duckdb
import logging

from src.tools.genesis_api_helper.genesis_api_helper import get_pandas_table
from src.tools.genesis_api_helper.datasources_retrieval import (
    get_datasource_information,
)
from src.tools.duckdb_utils.duckdb_utils import create_duckdb_conform_name
from src.config.parameter_handler import retrieve_parameter_value_by_name


def ingest_genesis_tables():
    """
    Ingests data from the genesis API and stores it in the duckdb database
    """
    # get datasources
    datasources = get_datasource_information(type="tables")

    # get duckdb location
    duckdb_location = retrieve_parameter_value_by_name("duckdb_location")

    # connect to duckdb
    with duckdb.connect(duckdb_location) as con:

        # use staging schema
        con.sql("USE staging")

        # iterate over tables
        for table in datasources:
            # get name of the datasource
            name = table["name"]

            # get pandas table
            df = get_pandas_table(name)
            
            table_name = create_duckdb_conform_name(name)

            # store table in duckdb
            duckdb.sql(f"CREATE TABLE genesis_{table_name}"
                       " AS SELECT * FROM df")

            con.commit()

            logging.info(f"Table staging.{table_name} ingested into duckdb")


def main():
    ingest_genesis_tables()


if __name__ == "__main__":
    main()
