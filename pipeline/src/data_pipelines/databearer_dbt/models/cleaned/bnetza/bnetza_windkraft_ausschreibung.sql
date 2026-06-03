SELECT
    Verfahren as verfahren,
    CAST(Gebotstermin AS DATE) as gebotstermin,
    "Zuschlagsmenge (kW)" as zuschlagsmenge_kw,
    "Gebotsmenge (kW)" as gebotsmenge_kw,
    "Ausschreibungsvolumen (kW)" as ausschreibungsvolumen_kw,
    "Zuschlagswert (ct/kWh)_Gew. Mittel" as zuschlagswert_ct_kwh_gew_mittel
FROM
    {{ source('staging', 'bnetza_windkraft_ausschreibung') }}
