WITH selected_columns AS (
SELECT
    gross_public_debt.year,
    gross_public_debt.country,
    gross_public_debt.value as gross_public_debt,
    gdp_current_prices.value as GDP_current_prices,
    gdp_constant_prices.value as GDP_constant_prices
FROM
    {{ ref('ameco_gross_public_debt') }} as gross_public_debt
LEFT JOIN
    {{ ref('ameco_GDP_current_prices')}} as gdp_current_prices
    ON gdp_current_prices.year = gross_public_debt.year
        and gdp_current_prices.country = gross_public_debt.country
LEFT JOIN
    {{ref('ameco_GDP_constant_prices')}} as gdp_constant_prices
    ON gdp_constant_prices.year = gross_public_debt.year
        and gdp_constant_prices.country = gross_public_debt.country
)
SELECT
    *,
    LAG(GDP_constant_prices) OVER (PARTITION BY country ORDER BY year ASC) AS previous_year_constant_gdp,
    LAG(gross_public_debt) OVER (PARTITION BY country ORDER BY year ASC) AS previous_year_debt,
    round((gross_public_debt / gdp_current_prices) *100, 2) AS debt_to_gdp_ratio,
    LAG(debt_to_gdp_ratio) OVER (PARTITION BY country ORDER BY year ASC) AS previous_year_debt_to_gdp_ratio,
    gross_public_debt - previous_year_debt AS yearly_new_debt,
    round((GDP_constant_prices - previous_year_constant_gdp) /
            previous_year_constant_gdp * 100, 2) AS gdp_growth_rate,
    (debt_to_gdp_ratio - previous_year_debt_to_gdp_ratio) AS debt_to_gdp_growth_rate

FROM
    selected_columns
