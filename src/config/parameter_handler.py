from yaml import safe_load


def retrieve_parameters():
    """
    Returns the parameters from the parameters.yaml file
    """
    with open("src/config/parameters.yaml") as file:
        parameters = safe_load(file)
    return parameters["Parameters"]


def retrieve_parameter_value_by_name(name: str):
    """
    Returns the parameter with the given name from the parameters.yaml file
    """
    parameters = retrieve_parameters()
    return parameters[name]["value"]
