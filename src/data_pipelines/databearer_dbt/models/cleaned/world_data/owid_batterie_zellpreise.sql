SELECT
    chemistry as batterie_chemie,
    date as datum,
    price as preis_usd_pro_kwh
FROM
    {{source('staging','owid_battery_cell_prices_combined')}}
