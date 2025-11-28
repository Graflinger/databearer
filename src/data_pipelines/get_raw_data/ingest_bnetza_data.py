from __future__ import annotations

import logging

import pandas as pd

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


urls = {
    'windkraft_ausschreibung': 'https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Ausschreibungen/_DL/Statistiken/Statistik_Onshore.xlsx?__blob=publicationFile&v=11',
}


def ingest_windkraft_ausschreibung():
    table_name = 'windkraft_ausschreibung'
    df = pd.read_excel(urls['windkraft_ausschreibung'], sheet_name='Übersicht', skiprows=6)

    df = df[['Verfahren', 'Gebotstermin', 'Zuschlagsmenge (kW)']].where(df['Verfahren'] == 'EEG Wind').dropna()

    with get_duckdb_connection() as con:

        con.sql(
            f"CREATE OR REPLACE TABLE staging.bnetza_{table_name} "
            'AS SELECT * FROM df',
        )

        con.commit()

        logging.info(f"Table bnetza_{table_name} ingested into duckdb")


def main():
    ingest_windkraft_ausschreibung()


if __name__ == '__main__':
    main()
