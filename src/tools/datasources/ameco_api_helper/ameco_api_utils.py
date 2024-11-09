from __future__ import annotations

from io import StringIO

import pandas as pd
import requests


def get_ameco_pandas_table(variable) -> pd.DataFrame:
    result = requests.get(
        f'https://ec.europa.eu/economy_finance/ameco/wq/series?fullVariable={variable}&defaultCountries=1',
    )
    cleaned_data_string = result.text
    cleaned_data_string_io = StringIO(cleaned_data_string)

    return pd.read_html(cleaned_data_string_io)[0]
