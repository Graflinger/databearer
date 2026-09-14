-- Focused recovery of 53b4954's source contract. Preserve bad values for audit.
WITH typed AS (
    SELECT
        ROW_NUMBER() OVER () AS source_row_number,
        NULLIF(TRIM("EinheitMastrNummer"), '') AS einheit_mastr_nummer,
        NULLIF(TRIM("SpeMastrNummer"), '') AS spe_mastr_nummer,
        "Nettonennleistung" AS raw_nettonennleistung,
        TRY_CAST(NULLIF(TRIM("Nettonennleistung"), '') AS DOUBLE) AS nettonennleistung_kw,
        "Inbetriebnahmedatum" AS raw_inbetriebnahmedatum,
        TRY_CAST("Inbetriebnahmedatum" AS DATE) AS inbetriebnahmedatum,
        TRY_CAST("GeplantesInbetriebnahmedatum" AS DATE) AS geplantes_inbetriebnahmedatum,
        TRY_CAST("DatumLetzteAktualisierung" AS TIMESTAMP) AS datum_letzte_aktualisierung,
        "Land" AS raw_land,
        "Technologie" AS raw_technologie,
        "EinheitSystemstatus" AS raw_systemstatus,
        "EinheitBetriebsstatus" AS raw_betriebsstatus,
        TRY_CAST("Land" AS INTEGER) AS land_id,
        TRY_CAST("Technologie" AS INTEGER) AS technologie_id,
        TRY_CAST("EinheitSystemstatus" AS INTEGER) AS einheit_systemstatus_id,
        TRY_CAST("EinheitBetriebsstatus" AS INTEGER) AS einheit_betriebsstatus_id,
        TRY_CAST("Bundesland" AS INTEGER) AS bundesland_id,
        TRY_CAST("NetzbetreiberpruefungStatus" AS INTEGER) AS netzbetreiberpruefung_status_id
    FROM {{ source('staging', 'mastr_einheiten_strom_speicher') }}
), catalogue AS (
    -- An ambiguous catalogue ID must never multiply units or decode by accident.
    SELECT katalogwert_id, MIN(katalogwert) AS label, MIN(katalogkategorie_id) AS category
    FROM {{ ref('mastr_katalogwerte') }}
    GROUP BY katalogwert_id
    HAVING COUNT(*) = 1 AND MIN(category_row_count) = 1
), catalogue_freshness AS (
    SELECT CASE WHEN COUNT(*) > 0 AND BOOL_AND(
        k.snapshot_date IS NOT DISTINCT FROM p.snapshot_date
        AND k.archive_sha256 IS NOT DISTINCT FROM p.archive_sha256
    ) THEN TRUE ELSE ERROR('Stale MaStR catalogue provenance; rebuild cleaned models') END AS is_fresh
    FROM {{ ref('mastr_katalogwerte') }} AS k
    CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS p
)
SELECT
    u.*,
    provenance.snapshot_date,
    provenance.archive_sha256,
    COUNT(*) OVER (PARTITION BY einheit_mastr_nummer) AS identifier_row_count,
    land.label AS land,
    technology.label AS technologie,
    system_status.label AS einheit_systemstatus,
    operating_status.label AS einheit_betriebsstatus,
    state.label AS bundesland,
    verification.label AS netzbetreiberpruefung_status,
    COALESCE(land_id = 84 AND land.label = 'Deutschland'
        AND technologie_id = 524 AND technology.label = 'Batterie'
        AND einheit_systemstatus_id = 472 AND system_status.label = 'Aktiviert', FALSE)
        AS is_active_german_battery,
    CASE
        WHEN einheit_betriebsstatus_id = 35 AND operating_status.label = 'In Betrieb' THEN 'operating'
        WHEN einheit_betriebsstatus_id = 31 AND operating_status.label = 'In Planung' THEN 'planned'
        ELSE 'other_or_unknown'
    END AS operating_status,
    CASE WHEN verification.label IS NOT NULL
        THEN netzbetreiberpruefung_status_id = 2954 AND verification.label = 'Geprüft'
    END AS is_network_verified
FROM typed AS u
LEFT JOIN catalogue AS land ON u.land_id = land.katalogwert_id AND land.category = 6
LEFT JOIN catalogue AS technology ON u.technologie_id = technology.katalogwert_id AND technology.category = 29
LEFT JOIN catalogue AS system_status ON u.einheit_systemstatus_id = system_status.katalogwert_id AND system_status.category = 19
LEFT JOIN catalogue AS operating_status ON u.einheit_betriebsstatus_id = operating_status.katalogwert_id AND operating_status.category = 4
LEFT JOIN catalogue AS state ON u.bundesland_id = state.katalogwert_id AND state.category = 101
LEFT JOIN catalogue AS verification ON u.netzbetreiberpruefung_status_id = verification.katalogwert_id AND verification.category = 175
CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS provenance
CROSS JOIN catalogue_freshness
WHERE catalogue_freshness.is_fresh
