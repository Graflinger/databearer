WITH batterie_ncm AS (
    SELECT
        date_part('year', CAST(datum AS DATE)) as jahr,
        preis_usd_pro_kwh as batterie_preis_ncm_usd_pro_kwh
    FROM
        {{ref('batterie_zellpreise')}}
    WHERE
        batterie_chemie = 'NCM'
),
solar_preise AS (
    SELECT
        jahr,
        kosten_usd_pro_watt as solar_modul_kosten_usd_pro_watt
    FROM
        {{ref('solar_modul_preise')}}
),
supercomputer AS (
    SELECT
        jahr,
        rechenleistung_flops
    FROM
        {{ref('supercomputer_rechenleistung')}}
),
combined AS (
    SELECT
        s.jahr,
        b.batterie_preis_ncm_usd_pro_kwh,
        s.solar_modul_kosten_usd_pro_watt,
        sc.rechenleistung_flops
    FROM
        solar_preise AS s
    LEFT JOIN
        batterie_ncm AS b ON s.jahr = b.jahr
    LEFT JOIN
        supercomputer AS sc ON s.jahr = sc.jahr
)
SELECT
    jahr,
    batterie_preis_ncm_usd_pro_kwh,
    solar_modul_kosten_usd_pro_watt,
    rechenleistung_flops,
    LAG(batterie_preis_ncm_usd_pro_kwh) OVER (ORDER BY jahr) AS batterie_preis_vorjahr,
    LAG(solar_modul_kosten_usd_pro_watt) OVER (ORDER BY jahr) AS solar_kosten_vorjahr,
    LAG(rechenleistung_flops) OVER (ORDER BY jahr) AS rechenleistung_vorjahr,
    round(
        (batterie_preis_ncm_usd_pro_kwh - LAG(batterie_preis_ncm_usd_pro_kwh) OVER (ORDER BY jahr)) /
        NULLIF(LAG(batterie_preis_ncm_usd_pro_kwh) OVER (ORDER BY jahr), 0) * 100, 2
    ) AS batterie_preis_veraenderung_prozent,
    round(
        (solar_modul_kosten_usd_pro_watt - LAG(solar_modul_kosten_usd_pro_watt) OVER (ORDER BY jahr)) /
        NULLIF(LAG(solar_modul_kosten_usd_pro_watt) OVER (ORDER BY jahr), 0) * 100, 2
    ) AS solar_kosten_veraenderung_prozent,
    round(
        (rechenleistung_flops - LAG(rechenleistung_flops) OVER (ORDER BY jahr)) /
        NULLIF(LAG(rechenleistung_flops) OVER (ORDER BY jahr), 0) * 100, 2
    ) AS rechenleistung_wachstum_prozent
FROM
    combined
ORDER BY
    jahr
