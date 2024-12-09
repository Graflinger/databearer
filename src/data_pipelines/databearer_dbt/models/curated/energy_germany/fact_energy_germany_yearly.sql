WITH selected_columns AS (
    SELECT
        date_part('year', bwa.gebotstermin) as jahr,
        bwa.verfahren,
        SUM(bwa.zuschlagsmenge_kw) as zuschlagsmenge_kw
    FROM
        {{ref('bnetza_windkraft_ausschreibung')}} as bwa
    GROUP BY
        jahr, bwa.verfahren
)
SELECT
    jahr,
    verfahren,
    zuschlagsmenge_kw
FROM
    selected_columns
