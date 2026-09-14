-- Usable capacity belongs to this grain, never to each linked unit.
SELECT
    ROW_NUMBER() OVER () AS source_row_number,
    NULLIF(TRIM("MaStRNummer"), '') AS spe_mastr_nummer,
    "NutzbareSpeicherkapazitaet" AS raw_nutzbare_speicherkapazitaet,
    TRY_CAST(NULLIF(TRIM("NutzbareSpeicherkapazitaet"), '') AS DOUBLE) AS nutzbare_speicherkapazitaet_kwh,
    NULLIF(TRIM("VerknuepfteEinheitenMaStRNummern"), '') AS verknuepfte_einheiten_mastr_nummern,
    "AnlageBetriebsstatus" AS raw_anlage_betriebsstatus,
    TRY_CAST("AnlageBetriebsstatus" AS INTEGER) AS anlage_betriebsstatus_id,
    TRY_CAST("DatumLetzteAktualisierung" AS TIMESTAMP) AS datum_letzte_aktualisierung,
    provenance.snapshot_date,
    provenance.archive_sha256
FROM {{ source('staging', 'mastr_anlagen_strom_speicher') }}
CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS provenance
