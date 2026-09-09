WITH battery_units AS (
    SELECT *
    FROM {{ ref('fact_battery_storage_germany_units') }}
    WHERE
        ist_deutschland
        AND ist_batteriespeicher
),
unit_by_state AS (
    SELECT
        bundesland,
        COUNT(*) AS batteriespeicher_anzahl,
        COUNT(*) FILTER (WHERE ist_in_betrieb) AS batteriespeicher_in_betrieb_anzahl,
        SUM(bruttoleistung_kw) AS bruttoleistung_kw,
        SUM(bruttoleistung_kw) FILTER (WHERE ist_in_betrieb) AS bruttoleistung_in_betrieb_kw,
        SUM(nettonennleistung_kw) AS nettonennleistung_kw,
        SUM(nettonennleistung_kw) FILTER (WHERE ist_in_betrieb) AS nettonennleistung_in_betrieb_kw,
        SUM(nettonennleistung_deutschland_kw) AS nettonennleistung_deutschland_kw,
        SUM(nettonennleistung_deutschland_kw) FILTER (WHERE ist_in_betrieb) AS nettonennleistung_deutschland_in_betrieb_kw,
        COUNT(*) FILTER (WHERE ist_mit_solar_gemeinsam_registriert) AS batteriespeicher_mit_solar_anzahl,
        COUNT(*) FILTER (
            WHERE ist_in_betrieb AND ist_mit_solar_gemeinsam_registriert
        ) AS batteriespeicher_mit_solar_in_betrieb_anzahl
    FROM
        battery_units
    GROUP BY
        bundesland
),
storage_plants_by_state AS (
    SELECT
        spe_mastr_nummer,
        bundesland,
        MAX(nutzbare_speicherkapazitaet_kwh) AS nutzbare_speicherkapazitaet_kwh,
        MAX(CASE WHEN ist_in_betrieb THEN 1 ELSE 0 END) = 1 AS ist_in_betrieb
    FROM
        battery_units
    WHERE
        spe_mastr_nummer IS NOT NULL
    GROUP BY
        spe_mastr_nummer,
        bundesland
),
capacity_by_state AS (
    SELECT
        bundesland,
        SUM(nutzbare_speicherkapazitaet_kwh) AS nutzbare_speicherkapazitaet_kwh,
        SUM(nutzbare_speicherkapazitaet_kwh) FILTER (WHERE ist_in_betrieb) AS nutzbare_speicherkapazitaet_in_betrieb_kwh
    FROM
        storage_plants_by_state
    GROUP BY
        bundesland
)
SELECT
    COALESCE(unit_by_state.bundesland, capacity_by_state.bundesland) AS bundesland,
    COALESCE(unit_by_state.batteriespeicher_anzahl, 0) AS batteriespeicher_anzahl,
    COALESCE(unit_by_state.batteriespeicher_in_betrieb_anzahl, 0) AS batteriespeicher_in_betrieb_anzahl,
    COALESCE(unit_by_state.bruttoleistung_kw, 0) AS bruttoleistung_kw,
    COALESCE(unit_by_state.bruttoleistung_in_betrieb_kw, 0) AS bruttoleistung_in_betrieb_kw,
    COALESCE(unit_by_state.nettonennleistung_kw, 0) AS nettonennleistung_kw,
    COALESCE(unit_by_state.nettonennleistung_in_betrieb_kw, 0) AS nettonennleistung_in_betrieb_kw,
    COALESCE(unit_by_state.nettonennleistung_deutschland_kw, 0) AS nettonennleistung_deutschland_kw,
    COALESCE(unit_by_state.nettonennleistung_deutschland_in_betrieb_kw, 0) AS nettonennleistung_deutschland_in_betrieb_kw,
    COALESCE(capacity_by_state.nutzbare_speicherkapazitaet_kwh, 0) AS nutzbare_speicherkapazitaet_kwh,
    COALESCE(capacity_by_state.nutzbare_speicherkapazitaet_in_betrieb_kwh, 0) AS nutzbare_speicherkapazitaet_in_betrieb_kwh,
    COALESCE(unit_by_state.batteriespeicher_mit_solar_anzahl, 0) AS batteriespeicher_mit_solar_anzahl,
    COALESCE(unit_by_state.batteriespeicher_mit_solar_in_betrieb_anzahl, 0) AS batteriespeicher_mit_solar_in_betrieb_anzahl
FROM
    unit_by_state
FULL OUTER JOIN
    capacity_by_state
ON
    unit_by_state.bundesland = capacity_by_state.bundesland
