SELECT
    chemistry as batterie_chemie,
    year(CAST(battery_prices.date AS Date)) as jahr,
    min(price) as preis_usd_pro_kwh
FROM
    {{source('staging','owid_battery_cell_prices_combined')}} as battery_prices
GROUP BY
    batterie_chemie,
    jahr
