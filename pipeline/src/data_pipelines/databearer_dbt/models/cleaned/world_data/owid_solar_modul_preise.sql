SELECT
    year as jahr,
    cost as kosten_usd_pro_watt
FROM
    {{source('staging','owid_solar_photovoltaic_module_prices')}}
