SELECT
    chemistry as batterie_chemie,
    date as datum,
    price as preis_usd_pro_kwh
FROM
    {{source('staging','battery_cell_prices_combined')}}
