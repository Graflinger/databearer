-- Planned capacity is separately labelled and never contributes to operating sums.
SELECT snapshot_date,
    operating_status,
    CASE WHEN GROUPING(size_segment) = 1 THEN 'overall' ELSE size_segment END AS size_segment,
    COUNT(*) AS plant_count,
    SUM(unit_count) AS unit_count,
    SUM(power_kw) / 1e6 AS power_gw,
    SUM(energy_kwh) / 1e6 AS energy_gwh,
    MEDIAN(duration_hours) AS median_duration_hours,
    COUNT(*) FILTER (WHERE is_network_verified) AS network_verified_plant_count
FROM {{ ref('fact_battery_storage_germany_plants') }}
WHERE is_included OR is_planned_included
GROUP BY GROUPING SETS ((snapshot_date, operating_status, size_segment), (snapshot_date, operating_status))
