import requests as req
import pandas as pd
from src.credentials import genesis_user, genesis_password
from io import StringIO


def get_raw_response(name: str, endpoint: str = "table"):
    """
    Calls genesis API with defined endpoint and returns raw response

    Args:
        name (str): Name of the table
        endpoint (str, optional): Endpoint of the API. Defaults

    Returns:
        requests.models.Response: Raw response of the API
    """

    url = (
        f"https://www-genesis.destatis.de/genesisWS/rest/2020/data/{endpoint}"
        f"?username={genesis_user}&password={genesis_password}&name={name}"
    )

    response = req.get(url)

    return response


def get_pandas_table(name: str, endpoint: str = "table"):
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
    # get data content from response
    raw_data = response.json()["Object"]["Content"]

    # remove unneccessary metadata information
    # which makes the data unparsable for a flat table

    # remove front part of string which is not needed
    cleaned_data = raw_data.split("\n;;")[-1] 

    # remove back part of string which is not needed
    cleaned_data = cleaned_data.split("\n__________")[0] 

    # convert data string to stringIO object and read it as a pandas dataframe
    cleaned_data_str = StringIO(cleaned_data) 
    cleaned_df = pd.read_csv(cleaned_data_str, sep=";")

    # reset index and rename columns
    cleaned_df = cleaned_df.reset_index()
    cleaned_df.rename(
        columns={"level_0": "Measure", "level_1": "Year"},
        inplace=True)

    return cleaned_df
