from __future__ import annotations

import logging

from src.tools.datasources.our_world_in_data.datasource_utils import (
    CatalogDataSource,
    ChartDataSource,
)
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection
from owid.catalog import charts


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_our_world_in_data():
    """
    Ingests climate change data from the World Bank API into a DuckDB database.
    """
    logging.info("Starting ingestion of Our World in Data datasets")
    catalog_datasources = CatalogDataSource.load_catalogs()
    chart_datasources = ChartDataSource.load_charts()
    
    for ds in catalog_datasources:
        with get_duckdb_connection() as con:
            con.sql('USE staging')
            con.execute(
                f"""
                CREATE OR REPLACE TABLE owid_{ds.name} AS
                SELECT * FROM read_parquet('{ds.get_catalog_url()}.parquet')
                """
            )
            con.commit()
            logging.info(f"Table owid_{ds.name} ingested into duckdb")

    for ds in chart_datasources:
        df = charts.get_data(ds.citation_url)
        with get_duckdb_connection() as con:
            con.sql('USE staging')
            con.execute(
                f"""
                CREATE OR REPLACE TABLE owid_{ds.name} AS
                SELECT * FROM df
                """
            )
            con.commit()
            logging.info(f"Chart data owid_{ds.name} ingested into duckdb")


def main():
    ingest_our_world_in_data()


if __name__ == '__main__':
    main()
