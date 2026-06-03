WITH strom_anteil AS (
    SELECT
        land,
        jahr,
        strom_anteil_prozent
    FROM
        {{ref('owid_strom_anteil_primaerenergie')}}
),
ev_anteil AS (
    SELECT
        Land as land,
        Jahr as jahr,
        ev_anteil_prozent
    FROM
        {{ref('owid_ev_share')}}
),
combined AS (
    SELECT
        e.land,
        e.jahr,
        s.strom_anteil_prozent,
        e.ev_anteil_prozent
    FROM
        ev_anteil AS e
    LEFT JOIN
        strom_anteil AS s ON e.land = s.land AND e.jahr = s.jahr
)
SELECT
    land,
    jahr,
    strom_anteil_prozent,
    ev_anteil_prozent,
    LAG(strom_anteil_prozent) OVER (PARTITION BY land ORDER BY jahr) AS strom_anteil_vorjahr,
    LAG(ev_anteil_prozent) OVER (PARTITION BY land ORDER BY jahr) AS ev_anteil_vorjahr,
    round(
        strom_anteil_prozent - LAG(strom_anteil_prozent) OVER (PARTITION BY land ORDER BY jahr), 2
    ) AS strom_anteil_veraenderung_prozentpunkte,
    round(
        ev_anteil_prozent - LAG(ev_anteil_prozent) OVER (PARTITION BY land ORDER BY jahr), 2
    ) AS ev_anteil_veraenderung_prozentpunkte
FROM
    combined
ORDER BY
    land, jahr
