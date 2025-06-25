WITH selected_columns AS (
    SELECT
        date_part('year', bwa.gebotstermin) as jahr,
        SUM(bwa.zuschlagsmenge_kw) as zuschlagsmenge_wind_kw
    FROM
        {{ref('bnetza_windkraft_ausschreibung')}} as bwa
    GROUP BY
        jahr, bwa.verfahren
)
SELECT
    jahr,
    zuschlagsmenge_wind_kw
FROM
    selected_columns
