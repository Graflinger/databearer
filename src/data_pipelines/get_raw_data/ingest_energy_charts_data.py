from __future__ import annotations

import logging
import yaml
import pandas as pd
import itertools

from src.tools.datasources.energy_charts.energy_charts_api_helper import get_energy_chart_table
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_energy_charts():
    with open("src/config/datasource_metadata/energy_charts_queries.yaml", 'r') as file:
        metadata = yaml.safe_load(file)

        for query in metadata["queries"]:
            logging.info(f"Processing query: {query['name']}")
            table_name = query["name"]
            params = query["api_params"]
            params_permutation = [dict(zip(params.keys(), x)) for x in itertools.product(*params.values())]

            df = pd.DataFrame()
            for param_dict in params_permutation:
                logging.info(f"Fetching data for {table_name} with params: {param_dict}")
                df_result = get_energy_chart_table(endpoint=table_name, params=param_dict)
                if df_result is not None:
                    df = pd.concat([df, df_result], ignore_index=True)

            with get_duckdb_connection() as con:

                con.sql(
                    f"CREATE OR REPLACE TABLE staging.energy_charts_{table_name} "
                    'AS SELECT * FROM df',
                )

                con.commit()

                logging.info(f"Table bnetza_{table_name} ingested into duckdb")


def main():
    ingest_energy_charts()


if __name__ == '__main__':
    main()
