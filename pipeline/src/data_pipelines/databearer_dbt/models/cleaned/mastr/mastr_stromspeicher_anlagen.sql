WITH anlagen AS (
    SELECT
        "MaStRNummer",
        "Registrierungsdatum",
        "DatumLetzteAktualisierung",
        "NutzbareSpeicherkapazitaet",
        "VerknuepfteEinheitenMaStRNummern",
        "AnlageBetriebsstatus"
    FROM
        {{ source('staging', 'mastr_anlagen_strom_speicher') }}
),
katalogwerte AS (
    SELECT * FROM {{ ref('mastr_katalogwerte') }}
)
SELECT
    anlagen."MaStRNummer" AS spe_mastr_nummer,
    CAST(NULLIF(anlagen."Registrierungsdatum", '') AS DATE) AS registrierungsdatum,
    CAST(NULLIF(anlagen."DatumLetzteAktualisierung", '') AS TIMESTAMP) AS datum_letzte_aktualisierung,
    CAST(NULLIF(anlagen."NutzbareSpeicherkapazitaet", '') AS DOUBLE) AS nutzbare_speicherkapazitaet_kwh,
    anlagen."VerknuepfteEinheitenMaStRNummern" AS verknuepfte_einheiten_mastr_nummern,
    CAST(NULLIF(anlagen."AnlageBetriebsstatus", '') AS INTEGER) AS anlage_betriebsstatus_id,
    anlage_betriebsstatus.katalogwert AS anlage_betriebsstatus
FROM
    anlagen
LEFT JOIN katalogwerte AS anlage_betriebsstatus
    ON CAST(NULLIF(anlagen."AnlageBetriebsstatus", '') AS INTEGER) = anlage_betriebsstatus.katalogwert_id
