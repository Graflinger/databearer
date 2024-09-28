def create_duckdb_conform_name(name: str) -> str:
    """
    manipulates the name of a table to be conform with the
    duckdb naming conventions 

    Args:
        name: str: the name of the table

    Returns:
        str: the name of the table conform with the duckdb naming conventions

    """
    name = name.replace("-", "")

    return name
