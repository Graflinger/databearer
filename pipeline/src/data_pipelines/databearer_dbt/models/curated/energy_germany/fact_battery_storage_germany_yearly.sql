WITH battery_units AS (
    SELECT *
    FROM {{ ref('fact_battery_storage_germany_units') }}
    WHERE
        ist_deutschland
        AND ist_batteriespeicher
        AND inbetriebnahmedatum IS NOT NULL
),
unit_yearly AS (
    SELECT
        jahr_inbetriebnahme AS jahr,
        COUNT(*) AS neue_batteriespeicher_anzahl,
        COUNT(*) FILTER (WHERE ist_in_betrieb) AS neue_batteriespeicher_in_betrieb_anzahl,
        SUM(bruttoleistung_kw) AS neue_bruttoleistung_kw,
        SUM(bruttoleistung_kw) FILTER (WHERE ist_in_betrieb) AS neue_bruttoleistung_in_betrieb_kw,
        SUM(nettonennleistung_kw) AS neue_nettonennleistung_kw,
        SUM(nettonennleistung_kw) FILTER (WHERE ist_in_betrieb) AS neue_nettonennleistung_in_betrieb_kw,
        SUM(nettonennleistung_deutschland_kw) AS neue_nettonennleistung_deutschland_kw,
        SUM(nettonennleistung_deutschland_kw) FILTER (WHERE ist_in_betrieb) AS neue_nettonennleistung_deutschland_in_betrieb_kw,
        COUNT(*) FILTER (WHERE ist_mit_solar_gemeinsam_registriert) AS neue_batteriespeicher_mit_solar_anzahl,
        COUNT(*) FILTER (
            WHERE ist_in_betrieb AND ist_mit_solar_gemeinsam_registriert
        ) AS neue_batteriespeicher_mit_solar_in_betrieb_anzahl
    FROM
        battery_units
    GROUP BY
        jahr
),
storage_plants AS (
    SELECT
        spe_mastr_nummer,
        date_part('year', MIN(inbetriebnahmedatum)) AS jahr,
        MAX(nutzbare_speicherkapazitaet_kwh) AS nutzbare_speicherkapazitaet_kwh,
        MAX(CASE WHEN ist_in_betrieb THEN 1 ELSE 0 END) = 1 AS ist_in_betrieb,
        MAX(CASE WHEN ist_mit_solar_gemeinsam_registriert THEN 1 ELSE 0 END) = 1 AS ist_mit_solar_gemeinsam_registriert
    FROM
        battery_units
    WHERE
        spe_mastr_nummer IS NOT NULL
    GROUP BY
        spe_mastr_nummer
),
capacity_yearly AS (
    SELECT
        jahr,
        COUNT(*) AS neue_batteriespeicher_anlagen_anzahl,
        COUNT(*) FILTER (WHERE ist_in_betrieb) AS neue_batteriespeicher_anlagen_in_betrieb_anzahl,
        SUM(nutzbare_speicherkapazitaet_kwh) AS neue_nutzbare_speicherkapazitaet_kwh,
        SUM(nutzbare_speicherkapazitaet_kwh) FILTER (WHERE ist_in_betrieb) AS neue_nutzbare_speicherkapazitaet_in_betrieb_kwh,
        COUNT(*) FILTER (WHERE ist_mit_solar_gemeinsam_registriert) AS neue_batteriespeicher_anlagen_mit_solar_anzahl,
        COUNT(*) FILTER (
            WHERE ist_in_betrieb AND ist_mit_solar_gemeinsam_registriert
        ) AS neue_batteriespeicher_anlagen_mit_solar_in_betrieb_anzahl
    FROM
        storage_plants
    GROUP BY
        jahr
),
combined AS (
    SELECT
        COALESCE(unit_yearly.jahr, capacity_yearly.jahr) AS jahr,
        COALESCE(unit_yearly.neue_batteriespeicher_anzahl, 0) AS neue_batteriespeicher_anzahl,
        COALESCE(unit_yearly.neue_batteriespeicher_in_betrieb_anzahl, 0) AS neue_batteriespeicher_in_betrieb_anzahl,
        COALESCE(unit_yearly.neue_bruttoleistung_kw, 0) AS neue_bruttoleistung_kw,
        COALESCE(unit_yearly.neue_bruttoleistung_in_betrieb_kw, 0) AS neue_bruttoleistung_in_betrieb_kw,
        COALESCE(unit_yearly.neue_nettonennleistung_kw, 0) AS neue_nettonennleistung_kw,
        COALESCE(unit_yearly.neue_nettonennleistung_in_betrieb_kw, 0) AS neue_nettonennleistung_in_betrieb_kw,
        COALESCE(unit_yearly.neue_nettonennleistung_deutschland_kw, 0) AS neue_nettonennleistung_deutschland_kw,
        COALESCE(unit_yearly.neue_nettonennleistung_deutschland_in_betrieb_kw, 0) AS neue_nettonennleistung_deutschland_in_betrieb_kw,
        COALESCE(unit_yearly.neue_batteriespeicher_mit_solar_anzahl, 0) AS neue_batteriespeicher_mit_solar_anzahl,
        COALESCE(unit_yearly.neue_batteriespeicher_mit_solar_in_betrieb_anzahl, 0) AS neue_batteriespeicher_mit_solar_in_betrieb_anzahl,
        COALESCE(capacity_yearly.neue_batteriespeicher_anlagen_anzahl, 0) AS neue_batteriespeicher_anlagen_anzahl,
        COALESCE(capacity_yearly.neue_batteriespeicher_anlagen_in_betrieb_anzahl, 0) AS neue_batteriespeicher_anlagen_in_betrieb_anzahl,
        COALESCE(capacity_yearly.neue_nutzbare_speicherkapazitaet_kwh, 0) AS neue_nutzbare_speicherkapazitaet_kwh,
        COALESCE(capacity_yearly.neue_nutzbare_speicherkapazitaet_in_betrieb_kwh, 0) AS neue_nutzbare_speicherkapazitaet_in_betrieb_kwh,
        COALESCE(capacity_yearly.neue_batteriespeicher_anlagen_mit_solar_anzahl, 0) AS neue_batteriespeicher_anlagen_mit_solar_anzahl,
        COALESCE(capacity_yearly.neue_batteriespeicher_anlagen_mit_solar_in_betrieb_anzahl, 0) AS neue_batteriespeicher_anlagen_mit_solar_in_betrieb_anzahl
    FROM
        unit_yearly
    FULL OUTER JOIN
        capacity_yearly
    ON
        unit_yearly.jahr = capacity_yearly.jahr
)
SELECT
    jahr,
    neue_batteriespeicher_anzahl,
    neue_batteriespeicher_in_betrieb_anzahl,
    SUM(neue_batteriespeicher_anzahl) OVER (ORDER BY jahr) AS kumulierte_batteriespeicher_anzahl,
    SUM(neue_batteriespeicher_in_betrieb_anzahl) OVER (ORDER BY jahr) AS kumulierte_batteriespeicher_in_betrieb_anzahl,
    neue_bruttoleistung_kw,
    neue_bruttoleistung_in_betrieb_kw,
    SUM(neue_bruttoleistung_kw) OVER (ORDER BY jahr) AS kumulierte_bruttoleistung_kw,
    SUM(neue_bruttoleistung_in_betrieb_kw) OVER (ORDER BY jahr) AS kumulierte_bruttoleistung_in_betrieb_kw,
    neue_nettonennleistung_kw,
    neue_nettonennleistung_in_betrieb_kw,
    SUM(neue_nettonennleistung_kw) OVER (ORDER BY jahr) AS kumulierte_nettonennleistung_kw,
    SUM(neue_nettonennleistung_in_betrieb_kw) OVER (ORDER BY jahr) AS kumulierte_nettonennleistung_in_betrieb_kw,
    neue_nettonennleistung_deutschland_kw,
    neue_nettonennleistung_deutschland_in_betrieb_kw,
    SUM(neue_nettonennleistung_deutschland_kw) OVER (ORDER BY jahr) AS kumulierte_nettonennleistung_deutschland_kw,
    SUM(neue_nettonennleistung_deutschland_in_betrieb_kw) OVER (ORDER BY jahr) AS kumulierte_nettonennleistung_deutschland_in_betrieb_kw,
    neue_batteriespeicher_mit_solar_anzahl,
    neue_batteriespeicher_mit_solar_in_betrieb_anzahl,
    neue_batteriespeicher_anlagen_anzahl,
    neue_batteriespeicher_anlagen_in_betrieb_anzahl,
    neue_nutzbare_speicherkapazitaet_kwh,
    neue_nutzbare_speicherkapazitaet_in_betrieb_kwh,
    SUM(neue_nutzbare_speicherkapazitaet_kwh) OVER (ORDER BY jahr) AS kumulierte_nutzbare_speicherkapazitaet_kwh,
    SUM(neue_nutzbare_speicherkapazitaet_in_betrieb_kwh) OVER (ORDER BY jahr) AS kumulierte_nutzbare_speicherkapazitaet_in_betrieb_kwh,
    neue_batteriespeicher_anlagen_mit_solar_anzahl,
    neue_batteriespeicher_anlagen_mit_solar_in_betrieb_anzahl
FROM
    combined
ORDER BY
    jahr
