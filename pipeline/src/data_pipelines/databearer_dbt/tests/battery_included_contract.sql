SELECT analysis_id
FROM {{ ref('fact_battery_storage_germany_plants') }}
WHERE (is_included AND is_planned_included)
    OR ((is_included OR is_planned_included) AND (
        NOT identifiers_valid OR NOT plant_unit_join_valid OR NOT selection_status_valid
        OR NOT ISFINITE(power_kw) OR power_kw <= 0.3
        OR NOT ISFINITE(energy_kwh) OR energy_kwh <= 0.3
        OR NOT ISFINITE(duration_hours) OR duration_hours NOT BETWEEN 0.1 AND 12
        OR size_segment IS NULL OR LENGTH(quality_reasons) <> 0
        OR state_count > 1
    ))
    OR (is_included AND (operating_status <> 'operating' OR NOT commissioning_valid
        OR commissioning_date IS NULL OR commissioning_date < DATE '1990-01-01'
        OR latest_unit_commissioning_date > snapshot_date))
    OR (is_planned_included AND operating_status <> 'planned')
    OR (NOT is_included AND NOT is_planned_included AND LENGTH(quality_reasons) = 0)
    OR ((is_included OR is_planned_included) AND size_segment IS DISTINCT FROM CASE
        WHEN power_kw < 30 AND energy_kwh < 30 THEN 'small'
        WHEN power_kw >= 1000 OR energy_kwh >= 1000 THEN 'large'
        ELSE 'medium' END)
