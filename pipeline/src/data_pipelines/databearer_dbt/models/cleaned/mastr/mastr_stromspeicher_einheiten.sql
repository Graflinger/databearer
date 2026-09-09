WITH stromspeicher AS (
    SELECT
        "EinheitMastrNummer",
        "DatumLetzteAktualisierung",
        "LokationMaStRNummer",
        "NetzbetreiberpruefungStatus",
        "NetzbetreiberpruefungDatum",
        "AnlagenbetreiberMastrNummer",
        "Land",
        "Bundesland",
        "Landkreis",
        "Gemeinde",
        "Gemeindeschluessel",
        "Postleitzahl",
        "Ort",
        "Laengengrad",
        "Breitengrad",
        "Registrierungsdatum",
        "Inbetriebnahmedatum",
        "GeplantesInbetriebnahmedatum",
        "DatumEndgueltigeStilllegung",
        "DatumBeginnVoruebergehendeStilllegung",
        "DatumWiederaufnahmeBetrieb",
        "EinheitSystemstatus",
        "EinheitBetriebsstatus",
        "NameStromerzeugungseinheit",
        "Energietraeger",
        "Bruttoleistung",
        "Nettonennleistung",
        "FernsteuerbarkeitNb",
        "FernsteuerbarkeitDv",
        "Einspeisungsart",
        "Einsatzort",
        "AcDcKoppelung",
        "Batterietechnologie",
        "Notstromaggregat",
        "NettonennleistungDeutschland",
        "ZugeordnenteWirkleistungWechselrichter",
        "SpeMastrNummer",
        "EegMaStRNummer",
        "EegAnlagentyp",
        "Technologie",
        "GemeinsamRegistrierteSolareinheitMastrNummer",
        "NetzreserveZugeordnet",
        "DatumNetzreserve",
        "KapazitaetsreserveZugeordnet",
        "DatumKapazitaetsreserve",
        "InbetriebnahmedatumAmAktuellenStandort"
    FROM
        {{ source('staging', 'mastr_einheiten_strom_speicher') }}
),
katalogwerte AS (
    SELECT * FROM {{ ref('mastr_katalogwerte') }}
)
SELECT
    stromspeicher."EinheitMastrNummer" AS einheit_mastr_nummer,
    CAST(NULLIF(stromspeicher."DatumLetzteAktualisierung", '') AS TIMESTAMP) AS datum_letzte_aktualisierung,
    stromspeicher."LokationMaStRNummer" AS lokation_mastr_nummer,
    CAST(NULLIF(stromspeicher."NetzbetreiberpruefungStatus", '') AS INTEGER) AS netzbetreiberpruefung_status_id,
    netzbetreiberpruefung_status.katalogwert AS netzbetreiberpruefung_status,
    CAST(NULLIF(stromspeicher."NetzbetreiberpruefungDatum", '') AS DATE) AS netzbetreiberpruefung_datum,
    stromspeicher."AnlagenbetreiberMastrNummer" AS anlagenbetreiber_mastr_nummer,
    CAST(NULLIF(stromspeicher."Land", '') AS INTEGER) AS land_id,
    land.katalogwert AS land,
    CAST(NULLIF(stromspeicher."Bundesland", '') AS INTEGER) AS bundesland_id,
    bundesland.katalogwert AS bundesland,
    stromspeicher."Landkreis" AS landkreis,
    stromspeicher."Gemeinde" AS gemeinde,
    stromspeicher."Gemeindeschluessel" AS gemeindeschluessel,
    stromspeicher."Postleitzahl" AS postleitzahl,
    stromspeicher."Ort" AS ort,
    CAST(NULLIF(stromspeicher."Laengengrad", '') AS DOUBLE) AS laengengrad,
    CAST(NULLIF(stromspeicher."Breitengrad", '') AS DOUBLE) AS breitengrad,
    CAST(NULLIF(stromspeicher."Registrierungsdatum", '') AS DATE) AS registrierungsdatum,
    CAST(NULLIF(stromspeicher."Inbetriebnahmedatum", '') AS DATE) AS inbetriebnahmedatum,
    CAST(NULLIF(stromspeicher."GeplantesInbetriebnahmedatum", '') AS DATE) AS geplantes_inbetriebnahmedatum,
    CAST(NULLIF(stromspeicher."DatumEndgueltigeStilllegung", '') AS DATE) AS datum_endgueltige_stilllegung,
    CAST(NULLIF(stromspeicher."DatumBeginnVoruebergehendeStilllegung", '') AS DATE) AS datum_beginn_voruebergehende_stilllegung,
    CAST(NULLIF(stromspeicher."DatumWiederaufnahmeBetrieb", '') AS DATE) AS datum_wiederaufnahme_betrieb,
    CAST(NULLIF(stromspeicher."EinheitSystemstatus", '') AS INTEGER) AS einheit_systemstatus_id,
    einheit_systemstatus.katalogwert AS einheit_systemstatus,
    CAST(NULLIF(stromspeicher."EinheitBetriebsstatus", '') AS INTEGER) AS einheit_betriebsstatus_id,
    einheit_betriebsstatus.katalogwert AS einheit_betriebsstatus,
    stromspeicher."NameStromerzeugungseinheit" AS name_stromspeichereinheit,
    CAST(NULLIF(stromspeicher."Energietraeger", '') AS INTEGER) AS energietraeger_id,
    energietraeger.katalogwert AS energietraeger,
    CAST(NULLIF(stromspeicher."Bruttoleistung", '') AS DOUBLE) AS bruttoleistung_kw,
    CAST(NULLIF(stromspeicher."Nettonennleistung", '') AS DOUBLE) AS nettonennleistung_kw,
    CAST(NULLIF(stromspeicher."FernsteuerbarkeitNb", '') AS BOOLEAN) AS fernsteuerbarkeit_nb,
    CAST(NULLIF(stromspeicher."FernsteuerbarkeitDv", '') AS BOOLEAN) AS fernsteuerbarkeit_dv,
    CAST(NULLIF(stromspeicher."Einspeisungsart", '') AS INTEGER) AS einspeisungsart_id,
    einspeisungsart.katalogwert AS einspeisungsart,
    CAST(NULLIF(stromspeicher."Einsatzort", '') AS INTEGER) AS einsatzort_id,
    einsatzort.katalogwert AS einsatzort,
    CAST(NULLIF(stromspeicher."AcDcKoppelung", '') AS INTEGER) AS ac_dc_koppelung_id,
    ac_dc_koppelung.katalogwert AS ac_dc_koppelung,
    CAST(NULLIF(stromspeicher."Batterietechnologie", '') AS INTEGER) AS batterietechnologie_id,
    batterietechnologie.katalogwert AS batterietechnologie,
    CAST(NULLIF(stromspeicher."Notstromaggregat", '') AS BOOLEAN) AS notstromaggregat,
    CAST(NULLIF(stromspeicher."NettonennleistungDeutschland", '') AS DOUBLE) AS nettonennleistung_deutschland_kw,
    CAST(NULLIF(stromspeicher."ZugeordnenteWirkleistungWechselrichter", '') AS DOUBLE) AS zugeordnete_wirkleistung_wechselrichter_kw,
    stromspeicher."SpeMastrNummer" AS spe_mastr_nummer,
    stromspeicher."EegMaStRNummer" AS eeg_mastr_nummer,
    CAST(NULLIF(stromspeicher."EegAnlagentyp", '') AS INTEGER) AS eeg_anlagentyp_id,
    eeg_anlagentyp.katalogwert AS eeg_anlagentyp,
    CAST(NULLIF(stromspeicher."Technologie", '') AS INTEGER) AS technologie_id,
    technologie.katalogwert AS technologie,
    stromspeicher."GemeinsamRegistrierteSolareinheitMastrNummer" AS gemeinsam_registrierte_solareinheit_mastr_nummer,
    CAST(NULLIF(stromspeicher."NetzreserveZugeordnet", '') AS BOOLEAN) AS netzreserve_zugeordnet,
    CAST(NULLIF(stromspeicher."DatumNetzreserve", '') AS TIMESTAMP) AS datum_netzreserve,
    CAST(NULLIF(stromspeicher."KapazitaetsreserveZugeordnet", '') AS BOOLEAN) AS kapazitaetsreserve_zugeordnet,
    CAST(NULLIF(stromspeicher."DatumKapazitaetsreserve", '') AS TIMESTAMP) AS datum_kapazitaetsreserve,
    CAST(NULLIF(stromspeicher."InbetriebnahmedatumAmAktuellenStandort", '') AS TIMESTAMP) AS inbetriebnahmedatum_am_aktuellen_standort
FROM
    stromspeicher
LEFT JOIN katalogwerte AS netzbetreiberpruefung_status
    ON CAST(NULLIF(stromspeicher."NetzbetreiberpruefungStatus", '') AS INTEGER) = netzbetreiberpruefung_status.katalogwert_id
LEFT JOIN katalogwerte AS land
    ON CAST(NULLIF(stromspeicher."Land", '') AS INTEGER) = land.katalogwert_id
LEFT JOIN katalogwerte AS bundesland
    ON CAST(NULLIF(stromspeicher."Bundesland", '') AS INTEGER) = bundesland.katalogwert_id
LEFT JOIN katalogwerte AS einheit_systemstatus
    ON CAST(NULLIF(stromspeicher."EinheitSystemstatus", '') AS INTEGER) = einheit_systemstatus.katalogwert_id
LEFT JOIN katalogwerte AS einheit_betriebsstatus
    ON CAST(NULLIF(stromspeicher."EinheitBetriebsstatus", '') AS INTEGER) = einheit_betriebsstatus.katalogwert_id
LEFT JOIN katalogwerte AS energietraeger
    ON CAST(NULLIF(stromspeicher."Energietraeger", '') AS INTEGER) = energietraeger.katalogwert_id
LEFT JOIN katalogwerte AS einspeisungsart
    ON CAST(NULLIF(stromspeicher."Einspeisungsart", '') AS INTEGER) = einspeisungsart.katalogwert_id
LEFT JOIN katalogwerte AS einsatzort
    ON CAST(NULLIF(stromspeicher."Einsatzort", '') AS INTEGER) = einsatzort.katalogwert_id
LEFT JOIN katalogwerte AS ac_dc_koppelung
    ON CAST(NULLIF(stromspeicher."AcDcKoppelung", '') AS INTEGER) = ac_dc_koppelung.katalogwert_id
LEFT JOIN katalogwerte AS batterietechnologie
    ON CAST(NULLIF(stromspeicher."Batterietechnologie", '') AS INTEGER) = batterietechnologie.katalogwert_id
LEFT JOIN katalogwerte AS eeg_anlagentyp
    ON CAST(NULLIF(stromspeicher."EegAnlagentyp", '') AS INTEGER) = eeg_anlagentyp.katalogwert_id
LEFT JOIN katalogwerte AS technologie
    ON CAST(NULLIF(stromspeicher."Technologie", '') AS INTEGER) = technologie.katalogwert_id
