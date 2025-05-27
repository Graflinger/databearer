
SELECT
    fegy.jahr as Jahr,
    fegy.zuschlagsmenge_kw as 'Zuschlagsmenge (kW)'
FROM
    {{ref('fact_energy_germany')}} as fegy
ORDER BY
    fegy.jahr ASC


    --    .data/output/wind_energy_awarded.csv
