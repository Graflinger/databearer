WITH selected_columns AS (
SELECT
    CAST(gross_public_debt.jahr AS INTEGER) as jahr,
    gross_public_debt.land,
    gross_public_debt.wert as bruttostaatsverschuldung,
    gdp_current_prices.wert as bip_nominal,
    gdp_constant_prices.wert as bip_inflationsbereinigt
FROM
    {{ ref('ameco_gross_public_debt') }} as gross_public_debt
LEFT JOIN
    {{ ref('ameco_GDP_current_prices')}} as gdp_current_prices
    ON gdp_current_prices.jahr = gross_public_debt.jahr
        and gdp_current_prices.land = gross_public_debt.land
LEFT JOIN
    {{ref('ameco_GDP_constant_prices')}} as gdp_constant_prices
    ON gdp_constant_prices.jahr = gross_public_debt.jahr
        and gdp_constant_prices.land = gross_public_debt.land
)
SELECT
    *,
    LAG(bip_inflationsbereinigt) OVER (PARTITION BY land ORDER BY jahr ASC) AS bip_inflationsbereinigt_letztes_yahr,
    LAG(bruttostaatsverschuldung) OVER (PARTITION BY land ORDER BY jahr ASC) AS schulden_letztes_jahr,
    round((bruttostaatsverschuldung / bip_nominal) *100, 2) AS schulden_zu_bip_verhältnis,
    LAG(schulden_zu_bip_verhältnis) OVER (PARTITION BY land ORDER BY jahr ASC) AS schulden_zu_bip_verhältnis_letztes_jahr,
    bruttostaatsverschuldung - schulden_letztes_jahr AS neuverschuldung,
    round((bip_inflationsbereinigt - bip_inflationsbereinigt_letztes_yahr) /
            bip_inflationsbereinigt_letztes_yahr * 100, 2) AS bip_wachstumsrate,
    (schulden_zu_bip_verhältnis - schulden_zu_bip_verhältnis_letztes_jahr) AS schulden_zu_bip_verhältnis_veränderung

FROM
    selected_columns
