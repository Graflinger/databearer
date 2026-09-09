from __future__ import annotations

import logging

from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def export_battery_storage_germany_yearly_to_csv() -> None:
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
        SELECT
            jahr AS "Jahr",
            neue_batteriespeicher_anzahl AS "Neue Batteriespeicher",
            kumulierte_batteriespeicher_anzahl AS "Batteriespeicher kumuliert",
            neue_batteriespeicher_in_betrieb_anzahl AS "Neue Batteriespeicher in Betrieb",
            kumulierte_batteriespeicher_in_betrieb_anzahl AS "Batteriespeicher in Betrieb kumuliert",
            neue_bruttoleistung_kw AS "Neue Bruttoleistung in kW",
            kumulierte_bruttoleistung_kw AS "Bruttoleistung kumuliert in kW",
            neue_nettonennleistung_kw AS "Neue Nettonennleistung in kW",
            kumulierte_nettonennleistung_kw AS "Nettonennleistung kumuliert in kW",
            neue_nutzbare_speicherkapazitaet_kwh AS "Neue nutzbare Speicherkapazitaet in kWh",
            kumulierte_nutzbare_speicherkapazitaet_kwh AS "Nutzbare Speicherkapazitaet kumuliert in kWh",
            neue_batteriespeicher_mit_solar_anzahl AS "Neue gemeinsam mit Solar registrierte Batteriespeicher",
            neue_batteriespeicher_mit_solar_in_betrieb_anzahl AS "Neue gemeinsam mit Solar registrierte Batteriespeicher in Betrieb"
        FROM
            prod_curated.fact_battery_storage_germany_yearly
        ORDER BY
            jahr ASC
            )

        TO '.data/output/battery_storage_germany_yearly.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/battery_storage_germany_yearly.csv')


def export_battery_storage_germany_by_state_to_csv() -> None:
    with get_duckdb_connection() as con:
        con.sql(
            """
        COPY (
        SELECT
            bundesland AS "Bundesland",
            batteriespeicher_anzahl AS "Batteriespeicher",
            batteriespeicher_in_betrieb_anzahl AS "Batteriespeicher in Betrieb",
            bruttoleistung_kw AS "Bruttoleistung in kW",
            bruttoleistung_in_betrieb_kw AS "Bruttoleistung in Betrieb in kW",
            nettonennleistung_kw AS "Nettonennleistung in kW",
            nettonennleistung_in_betrieb_kw AS "Nettonennleistung in Betrieb in kW",
            nutzbare_speicherkapazitaet_kwh AS "Nutzbare Speicherkapazitaet in kWh",
            nutzbare_speicherkapazitaet_in_betrieb_kwh AS "Nutzbare Speicherkapazitaet in Betrieb in kWh",
            batteriespeicher_mit_solar_anzahl AS "Gemeinsam mit Solar registrierte Batteriespeicher",
            batteriespeicher_mit_solar_in_betrieb_anzahl AS "Gemeinsam mit Solar registrierte Batteriespeicher in Betrieb"
        FROM
            prod_curated.fact_battery_storage_germany_by_state
        ORDER BY
            batteriespeicher_in_betrieb_anzahl DESC
            )

        TO '.data/output/battery_storage_germany_by_state.csv' (HEADER, DELIMITER ',');
        """,
        )

        logging.info('Exported data to .data/output/battery_storage_germany_by_state.csv')


def main() -> None:
    export_battery_storage_germany_yearly_to_csv()
    export_battery_storage_germany_by_state_to_csv()


if __name__ == '__main__':
    main()
