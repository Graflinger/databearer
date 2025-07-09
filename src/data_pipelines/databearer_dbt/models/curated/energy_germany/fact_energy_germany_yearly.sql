WITH bnetza_windkraft_ausschreibung AS (
    SELECT
        date_part('year', bwa.gebotstermin) as jahr,
        SUM(bwa.zuschlagsmenge_kw) as zuschlagsmenge_wind_kw
    FROM
        {{ref('bnetza_windkraft_ausschreibung')}} as bwa
    GROUP BY
        jahr, bwa.verfahren
),
ren_share_daily_avg AS (
    SELECT
        date_part('year', rda.date) as jahr,
        AVG(rda.anteil_eeg) as anteil_eeg
    FROM
        {{ref('ren_share_daily_avg')}} as rda
    GROUP BY
        jahr
)
SELECT
    rda.jahr,
    bwa.zuschlagsmenge_wind_kw,
    rda.anteil_eeg
FROM
    ren_share_daily_avg AS rda
LEFT JOIN
    bnetza_windkraft_ausschreibung AS bwa
ON
    rda.jahr = bwa.jahr
