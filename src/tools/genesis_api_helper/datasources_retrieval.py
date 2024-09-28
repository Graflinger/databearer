from yaml import safe_load


def get_datasource_information(type: str):
    """
    Returns the datasources information from the datasources.yaml file
    """
    with open("src/tools/genesis_api_helper/datasources_genesis.yaml") as file:
        datasources = safe_load(file)
        datasources = datasources[type]
    return datasources
