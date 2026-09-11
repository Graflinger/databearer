-- Same survivor/earliest-date caveat as yearly; no zero-filled missing periods.
WITH cohorts AS (
    SELECT snapshot_date, commissioning_month,
        CASE WHEN GROUPING(size_segment) = 1 THEN 'overall' ELSE size_segment END AS size_segment,
        COUNT(*) AS plant_count,
        SUM(unit_count) AS unit_count,
        SUM(power_kw) / 1e6 AS power_gw,
        SUM(energy_kwh) / 1e6 AS energy_gwh,
        MEDIAN(duration_hours) AS median_duration_hours,
        COUNT(*) FILTER (WHERE has_commissioning_spread) AS plants_with_commissioning_spread,
        COUNT(*) FILTER (WHERE is_network_verified) AS network_verified_plant_count
    FROM {{ ref('fact_battery_storage_germany_plants') }}
    WHERE is_included
    GROUP BY GROUPING SETS ((snapshot_date, commissioning_month, size_segment), (snapshot_date, commissioning_month))
)
SELECT *,
    SUM(plant_count) OVER cohort AS cumulative_plant_count,
    SUM(power_gw) OVER cohort AS cumulative_power_gw,
    SUM(energy_gwh) OVER cohort AS cumulative_energy_gwh
FROM cohorts
WINDOW cohort AS (PARTITION BY snapshot_date, size_segment ORDER BY commissioning_month ROWS UNBOUNDED PRECEDING)
