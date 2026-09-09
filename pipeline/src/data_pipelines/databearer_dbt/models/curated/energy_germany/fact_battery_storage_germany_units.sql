SELECT
    einheiten.einheit_mastr_nummer,
    einheiten.spe_mastr_nummer,
    einheiten.eeg_mastr_nummer,
    einheiten.lokation_mastr_nummer,
    einheiten.registrierungsdatum,
    einheiten.inbetriebnahmedatum,
    date_part('year', einheiten.inbetriebnahmedatum) AS jahr_inbetriebnahme,
    einheiten.geplantes_inbetriebnahmedatum,
    einheiten.datum_endgueltige_stilllegung,
    einheiten.datum_letzte_aktualisierung,
    einheiten.land_id,
    einheiten.land,
    einheiten.bundesland_id,
    einheiten.bundesland,
    einheiten.landkreis,
    einheiten.gemeinde,
    einheiten.gemeindeschluessel,
    einheiten.postleitzahl,
    einheiten.ort,
    einheiten.laengengrad,
    einheiten.breitengrad,
    einheiten.einheit_systemstatus_id,
    einheiten.einheit_systemstatus,
    einheiten.einheit_betriebsstatus_id,
    einheiten.einheit_betriebsstatus,
    einheiten.name_stromspeichereinheit,
    einheiten.energietraeger_id,
    einheiten.energietraeger,
    einheiten.technologie_id,
    einheiten.technologie,
    einheiten.batterietechnologie_id,
    einheiten.batterietechnologie,
    einheiten.bruttoleistung_kw,
    einheiten.nettonennleistung_kw,
    einheiten.nettonennleistung_deutschland_kw,
    anlagen.nutzbare_speicherkapazitaet_kwh,
    einheiten.einspeisungsart,
    einheiten.einsatzort,
    einheiten.ac_dc_koppelung,
    einheiten.fernsteuerbarkeit_nb,
    einheiten.fernsteuerbarkeit_dv,
    einheiten.notstromaggregat,
    einheiten.gemeinsam_registrierte_solareinheit_mastr_nummer,
    einheiten.netzreserve_zugeordnet,
    einheiten.kapazitaetsreserve_zugeordnet,
    COALESCE(
        einheiten.land_id = 84
        OR LOWER(einheiten.land) = 'deutschland',
        false
    ) AS ist_deutschland,
    COALESCE(
        einheiten.batterietechnologie_id IS NOT NULL
        OR LOWER(einheiten.batterietechnologie) LIKE '%batter%'
        OR LOWER(einheiten.technologie) LIKE '%batter%'
        OR LOWER(einheiten.energietraeger) LIKE '%batter%',
        false
    ) AS ist_batteriespeicher,
    COALESCE(
        einheiten.einheit_betriebsstatus_id = 35
        OR LOWER(einheiten.einheit_betriebsstatus) = 'in betrieb',
        false
    ) AS ist_in_betrieb,
    einheiten.gemeinsam_registrierte_solareinheit_mastr_nummer IS NOT NULL AS ist_mit_solar_gemeinsam_registriert
FROM
    {{ ref('mastr_stromspeicher_einheiten') }} AS einheiten
LEFT JOIN
    {{ ref('mastr_stromspeicher_anlagen') }} AS anlagen
ON
    einheiten.spe_mastr_nummer = anlagen.spe_mastr_nummer
