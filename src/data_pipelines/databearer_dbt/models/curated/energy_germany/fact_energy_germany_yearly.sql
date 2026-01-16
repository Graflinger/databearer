WITH bnetza_windkraft_ausschreibung AS (
    SELECT
        date_part('year', bwa.gebotstermin) as jahr,
        SUM(bwa.zuschlagsmenge_kw) as zuschlagsmenge_wind_kw,
        SUM(gebotsmenge_kw) as gebotsmenge_wind_kw,
        SUM(ausschreibungsvolumen_kw) as ausschreibungsvolumen_kw,
        AVG(zuschlagswert_ct_kwh_gew_mittel) as zuschlagswert_ct_kwh_gew_mittel
    FROM
        {{ref('bnetza_windkraft_ausschreibung')}} as bwa
    GROUP BY
        jahr, bwa.verfahren
),
ren_share_daily_avg AS (
    SELECT
        date_part('year', rda.date) as jahr,
        round(AVG(rda.anteil_eeg), 2) as anteil_eeg
    FROM
        {{ref('ren_share_daily_avg')}} as rda
    GROUP BY
        jahr
)
SELECT
    rda.jahr,
    bwa.zuschlagsmenge_wind_kw,
    bwa.gebotsmenge_wind_kw,
    bwa.ausschreibungsvolumen_kw,
    bwa.zuschlagswert_ct_kwh_gew_mittel,
    rda.anteil_eeg
FROM
    ren_share_daily_avg AS rda
LEFT JOIN
    bnetza_windkraft_ausschreibung AS bwa
ON
    rda.jahr = bwa.jahr
