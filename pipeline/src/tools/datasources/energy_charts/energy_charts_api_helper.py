from __future__ import annotations

from io import StringIO

import pandas as pd
import requests as req


def get_energy_chart_table(endpoint: str, params: dict) -> pd.DataFrame:
    """
    Fetches a table from the Energy Charts API.

    Args:
        endpoint (str): The API endpoint to fetch data from.
        params (dict): Parameters to be passed to the API.

    Returns:
        pd.DataFrame: A DataFrame containing the data from the API.
    """
    url = f"https://api.energy-charts.info/{endpoint}"
    response = req.get(url, params=params)

    if response.status_code != 200:
        raise ValueError(f"Failed to fetch data: {response.status_code} - {response.text}")

    cleaned_data_string = response.text
    cleaned_data_string_io = StringIO(cleaned_data_string)

    return pd.read_json(cleaned_data_string_io)
