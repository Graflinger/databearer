WITH bnetza_windkraft_ausschreibung AS (
    SELECT
        bwa.gebotstermin as date,
        bwa.zuschlagsmenge_kw as zuschlagsmenge_wind_kw,
        gebotsmenge_kw as gebotsmenge_wind_kw,
        ausschreibungsvolumen_kw as ausschreibungsvolumen_kw,
        zuschlagswert_ct_kwh_gew_mittel as zuschlagswert_ct_kwh_gew_mittel
    FROM
        {{ref('bnetza_windkraft_ausschreibung')}} as bwa
)

SELECT
    bwa.date as datum,
    bwa.zuschlagsmenge_wind_kw,
    bwa.gebotsmenge_wind_kw,
    bwa.ausschreibungsvolumen_kw,
    bwa.zuschlagswert_ct_kwh_gew_mittel,
FROM
    bnetza_windkraft_ausschreibung AS bwa
