from __future__ import annotations

import logging

import pandas as pd

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)


urls = {
    "windkraft_ausschreibung": "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Ausschreibungen/_DL/Statistiken/Statistik_Onshore.xlsx?__blob=publicationFile&v=11",
}


def ingest_windkraft_ausschreibung():
    table_name = "windkraft_ausschreibung"
    df = pd.read_excel(
        urls["windkraft_ausschreibung"],
        sheet_name="Übersicht",
        skiprows=6,
        header=[0, 1],
    )

    columns = []
    for col in df.columns:
        if "Unnamed" in col[1]:
            columns.append(col[0])
        else:
            columns.append(f"{col[0]}_{col[1]}")

    df.columns = columns

    selected_columns = [
        "Verfahren",
        "Gebotstermin",
        "Zuschlagsmenge (kW)",
        "Gebotsmenge (kW)",
        "Ausschreibungsvolumen (kW)",
        "Zuschlagswert (ct/kWh)_Gew. Mittel",
    ]

    df = df[selected_columns].where(df["Verfahren"] == "EEG Wind")

    # remove rows with only any NaN values
    df = df.dropna(how="all", axis="rows")

    # get rid of empty columns
    df = df.dropna(axis="columns", how="any")

    with get_duckdb_connection() as con:

        con.sql(
            f"CREATE OR REPLACE TABLE staging.bnetza_{table_name} "
            "AS SELECT * FROM df",
        )

        con.commit()

        logging.info(f"Table bnetza_{table_name} ingested into duckdb")


def main():
    ingest_windkraft_ausschreibung()


if __name__ == "__main__":
    main()
