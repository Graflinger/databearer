# databearer blog

Creating transparency through open sourcing the code used to create the data analysis for my blog

## Technologies Used

- **Devcontainer** for easy reusability and maintainability
- **DuckDB** as compute engine
- **dbt** for organizing data transformation
- **Dagster** for pipeline orchestration
- **Datawrapper** for visualization

## Data Sources

- **GENESIS**: German statistical office (VGR, taxes, education)
- **AMECO**: EU economic indicators (debt, GDP)
- **BNetzA**: German Federal Network Agency (wind auctions)
- **Energy Charts**: Fraunhofer ISE (renewable energy data)
- **World Bank**: Climate projections
- **Our World in Data**: Global statistics

## Project Structure

```
src/
├── config/                      # Configuration and metadata
├── data_pipelines/
│   ├── setup/                   # Database initialization
│   ├── get_raw_data/            # Data ingestion scripts
│   ├── databearer_dbt/          # dbt transformation project
│   └── export_data/             # CSV/Json export scripts
└── tools/                       # Utility modules
```

## Quick Start

### Prerequisites

1. Ensure a `.data/` folder exists in your root folder
2. Use the devcontainer (all requirements pre-installed)

### Run Manually

If you prefer to run steps individually:

#### 1. Setup DuckDB

```bash
python src/data_pipelines/setup/duckdb_setup.py
```

Sets up an empty database with the staging schema.

#### 2. Import Raw Data

```bash
# Run individual ingestion scripts
python src/data_pipelines/get_raw_data/ingest_genesis_data.py
python src/data_pipelines/get_raw_data/ingest_ameco_data.py
python src/data_pipelines/get_raw_data/ingest_bnetza_data.py
python src/data_pipelines/get_raw_data/ingest_energy_charts_data.py
python src/data_pipelines/get_raw_data/ingest_world_bank_climate_change.py
python src/data_pipelines/get_raw_data/ingest_our_world_in_data.py
```

#### 3. Run dbt Transformations

```bash
dbt run --profiles-dir src/data_pipelines/databearer_dbt/ --project-dir src/data_pipelines/databearer_dbt/
```

#### 4. Export Data

```bash
# Run individual export scripts
python src/data_pipelines/export_data/energy/germany/wind_energy_awarded_germany.py
python src/data_pipelines/export_data/economic/germany/income_increases_record_highs.py
# ... other export scripts
```

## Data Pipeline Architecture

The pipeline follows a **medallion architecture**:

```
External APIs/Datasources → Staging → Cleaned → Curated → Exports
```

- **Staging**: Raw data as ingested (minimal transformations)
- **Cleaned**: Standardized data (unpivoted, renamed, type-cast)
- **Curated**: Usage-ready fact tables (aggregated, enriched)

## Release Process

Each blog entry which relies on data will get release notes and an associated tag

## Contributing

This project is open-sourced to provide transparency for blog data analysis. Feel free to explore the code and provide feedback!
