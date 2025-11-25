SELECT
    entities as Land,
    years as Jahr,
    electric_car_sales_share as ev_anteil_prozent
FROM
    {{source('staging','ev_share')}} as bwa