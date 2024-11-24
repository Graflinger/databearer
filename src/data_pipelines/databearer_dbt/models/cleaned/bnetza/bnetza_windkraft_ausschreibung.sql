SELECT
    Verfahren as verfahren,
    CAST(Gebotstermin AS DATE) as gebotstermin,
    "Zuschlagsmenge (kW)" as zuschlagsmenge_kw
FROM
    {{ source('staging', 'bnetza_windkraft_ausschreibung') }}
