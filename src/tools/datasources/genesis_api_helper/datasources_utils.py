from __future__ import annotations

from yaml import safe_load


def get_datasource_information(type: str = 'tables'):
    with open('src/tools/datasources/genesis_api_helper/datasources_genesis.yaml') as file:
        datasources = safe_load(file)
        datasources = datasources[type]
    return datasources


class datasource_meta_information:

    def __init__(self, name: str, type: str = 'tables'):
        self.type = type
        self.datasources_information = self.get_datasource_information_by_name(
            name=name,
            type=type,
        )

    def get_datasource_information_by_name(self, name: str, type: str = 'tables'):
        datasources = get_datasource_information(type)

        for datasource in datasources:
            if datasource['name'] == name:
                return datasource

        raise ValueError(f"Datasource {name} not found in datasources.yaml")

    @property
    def index_columns(self):
        return self.datasources_information['index_columns']

    @property
    def table_database_name(self):
        return self.datasources_information['table_database_name']

    @property
    def index_table_type(self):
        return self.datasources_information['table_type']

    @property
    def api_params(self):
        return self.datasources_information['api_params']

    @property
    def value_adjustment(self):
        return self.datasources_information['value_adjustment']

    @property
    def pivot_columns(self):
        return self.datasources_information['pivot_columns']

    @property
    def begin_split_flag(self):
        return self.datasources_information['begin_split_flag']

    @property
    def where_clause(self):
        return self.datasources_information['where_clause']
