from __future__ import annotations

import pandas as pd
import requests as req
import io
import zipfile

from src.credentials import genesis_password
from src.credentials import genesis_user
from src.tools.datasources.genesis_api_helper.datasources_utils import (
    datasource_meta_information,
)


def csvUnZip(response):
    """
    Unzips the csv file from genesis API response
    """
    filebytes = io.BytesIO(response.content)
    zipFile = zipfile.ZipFile(filebytes)
    csvFile = zipFile.open(zipFile.namelist()[0])
    return csvFile


def get_pandas_table(table_name: str, endpoint: str = "table"):
    """
    Calls genesis API with defined endpoint and returns
    table as pandas DataFrame

    Args:
        table_name (str): Name of the table
        endpoint (str, optional): Endpoint of the API. Defaults

    Returns:
        pandas.DataFrame: Table as pandas DataFrame
    """
    table_meta_data = datasource_meta_information(table_name)

    url = "https://www-genesis.destatis.de/genesisWS/rest/2020/"

    langPref = "de"

    data = {
        "name": table_name,
        "compress": "true",
        "format": "ffcsv",
        "transpose": "true",
        "language": langPref,
    }
    data = data | table_meta_data.api_params

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "username": genesis_user,
        "password": genesis_password,
    }

    response = req.post(url + "data/tablefile", headers=headers, data=data)

    if response.status_code != 200:
        raise ValueError(
            f"Failed to fetch data: {response.status_code} - {response.text}"
        )

    csvFile = csvUnZip(response)
    df = pd.read_csv(
        csvFile, delimiter=";", decimal=",", na_values=["...", ".", "-", "/", "x"]
    )

    columns = table_meta_data.index_columns.copy()
    columns.append(table_meta_data.year_column)
    columns.append(table_meta_data.value_column)

    df_subset = df[columns]
    df_subset = df_subset.reset_index(drop=True)

    df_pivoted = df_subset.pivot_table(
        index=table_meta_data.index_columns,
        columns=table_meta_data.year_column,
        values=table_meta_data.value_column,
        aggfunc="sum",
    )

    df_pivoted = df_pivoted.reset_index()
    df_pivoted.columns.name = None

    df_pivoted.columns = table_meta_data.index_columns_renamed + list(
        df_pivoted.columns[len(table_meta_data.index_columns_renamed):]
    )

    return df_pivoted
