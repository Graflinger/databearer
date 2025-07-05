from __future__ import annotations

import pandas as pd
import requests
import yaml


def get_world_bank_climate_change_knowledge_pandas_table(query: str) -> pd.DataFrame:
    """
    Fetches a table from the World Bank API for a given variable.

    Args:
        query (str): The query to fetch from the World Bank API.

    Returns:
        pd.DataFrame: A DataFrame containing the data for the specified variable.
    """
    result = requests.get(
        f'https://cckpapi.worldbank.org/cckp/v1/{query}?_format=json'
    )
    
    if result.status_code != 200:
        raise ValueError(f"Failed to fetch data: {result.status_code} - {result.text}")

    df = pd.DataFrame.from_dict(result.json()["data"], orient="index")

    df = df.rename(columns={col: col[:4] for col in df.columns}).reset_index()

    return df


def read_metadata_from_yaml() -> dict:
    """
    Reads metadata from a YAML file.

    Args:
        None

    Returns:
        dict: A dictionary containing the metadata.
    """

    with open("src/config/datasource_metadata/world_bank_climate_queries.yaml", 'r') as file:
        return yaml.safe_load(file)
