SELECT
    "EegMaStRNummer" AS eeg_mastr_nummer,
    CAST(NULLIF("Registrierungsdatum", '') AS DATE) AS registrierungsdatum,
    CAST(NULLIF("DatumLetzteAktualisierung", '') AS TIMESTAMP) AS datum_letzte_aktualisierung,
    CAST(NULLIF("EegInbetriebnahmedatum", '') AS DATE) AS eeg_inbetriebnahmedatum,
    "AnlagenschluesselEeg" AS anlagenschluessel_eeg,
    CAST(NULLIF("AusschreibungZuschlag", '') AS BOOLEAN) AS ausschreibung_zuschlag,
    "Zuschlagsnummer" AS zuschlagsnummer,
    "VerknuepfteEinheitenMaStRNummern" AS verknuepfte_einheiten_mastr_nummern
FROM
    {{ source('staging', 'mastr_anlagen_eeg_speicher') }}
