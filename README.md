# databaerer blog
Creating transparency through open sourcing the code used to create the data analysis for my blog

# technologies used

- Devcontainer for easy reusability and maintainability
- DuckDB as compute engine
- DBT for organising data transformation
- Datawrapper for visualisation

# release process
Each blog entry which relys on data will get release notes and a associated tag


# run the pipeline
## prerequities
make sure a .data folder exisits in your root folder

## use the dev container
every requirement is already installed/configured with the usage of the devcontainer

## setup duckdb
python src/data_pipelines/setup/duckdb_setup.py 

sets up an empty database with the staging schema

## import
python src/data_pipelines/get_raw_data/<python_file>

## dbt pipeline
dbt run --profiles-dir src/data_pipelines/databearer_dbt/ --project-dir src/data_pipelines/databearer_dbt/

## export data
python src/data_pipelines/export_data/<python_file>
