from __future__ import annotations

from io import StringIO

import pandas as pd
import requests as req

from src.credentials import genesis_password
from src.credentials import genesis_user
from src.tools.datasources.genesis_api_helper.datasources_utils import datasource_meta_information


def get_raw_response(name: str, endpoint: str = 'tables'):
    """
    Calls genesis API with defined endpoint and returns raw response

    Args:
        name (str): Name of the table
        endpoint (str, optional): Endpoint of the API. Defaults

    Returns:
        requests.models.Response: Raw response of the API
    """

    table_meta_data = datasource_meta_information(name)

    url = (
        f"https://www-genesis.destatis.de/genesisWS/rest/2020/data/{endpoint}"
        f"?username={genesis_user}&password={genesis_password}&name={name}"
    )

    result = req.get(url, params=table_meta_data.api_params)

    if result.status_code != 200:
        raise ValueError(f"Failed to fetch data: {result.status_code} - {result.text}")

    return result


def get_pandas_table(name: str, endpoint: str = 'table'):
    """
    Calls genesis API with defined endpoint and returns
    table as pandas DataFrame

    Args:
        name (str): Name of the table
        endpoint (str, optional): Endpoint of the API. Defaults

    Returns:
        pandas.DataFrame: Table as pandas DataFrame
    """
    response = get_raw_response(name, endpoint)
    raw_data = response.json()['Object']['Content']

    table_meta_data = datasource_meta_information(name)
    index_names = table_meta_data.index_columns
    begin_split_flag = table_meta_data.begin_split_flag

    # remove unneccessary metadata information
    cleaned_data_string = raw_data.split(begin_split_flag)[-1]

    cleaned_data_string = cleaned_data_string.split('\n__________')[0]

    # handle empty values represented as '-'
    cleaned_data_string = cleaned_data_string.replace(';-;', ';;')
    cleaned_data_string = cleaned_data_string.replace('-;', ';')
    cleaned_data_string = cleaned_data_string.replace(';-', ';')

    cleaned_data_string = cleaned_data_string.replace(',', '.')
    cleaned_data_string = cleaned_data_string.replace(';.', ';')

    cleaned_data_string_io = StringIO(cleaned_data_string)
    cleaned_df = pd.read_csv(cleaned_data_string_io, sep=';')

    cleaned_df = cleaned_df.reset_index()

    for i in range(0, len(index_names)):
        cleaned_df.columns.values[i] = index_names[i]

    return cleaned_df
