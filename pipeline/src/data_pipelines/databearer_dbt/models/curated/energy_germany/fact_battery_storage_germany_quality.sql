-- Relation rows are exhaustive, mutually exclusive dispositions. Reason rows
-- overlap and MUST NOT be added together. Known positive totals are not estimates
-- for missing data; an all-unknown total remains NULL. Duplicate plant capacities
-- have no defensible selected kWh value and are deliberately not summed.
WITH dispositions AS (
    SELECT *, CASE
        WHEN is_included THEN 'included_operating'
        WHEN is_planned_included THEN 'included_planned'
        ELSE 'excluded'
    END AS disposition
    FROM {{ ref('fact_battery_storage_germany_plants') }}
), report_rows AS (
    SELECT *, 'relation' AS report_type, disposition AS reason FROM dispositions
    UNION ALL
    SELECT *, 'reason' AS report_type, UNNEST(quality_reasons) AS reason FROM dispositions
)
SELECT snapshot_date, report_type, reason,
    COUNT(*) AS relation_count,
    COUNT(DISTINCT spe_mastr_nummer) AS identified_plant_count,
    SUM(COALESCE(unit_count, 0)) AS unit_row_count,
    SUM(COALESCE(plant_row_count, 0)) AS plant_row_count,
    SUM(COALESCE(selected_operating_unit_count, 0)) AS selected_operating_unit_count,
    SUM(power_kw) FILTER (WHERE ISFINITE(power_kw) AND power_kw > 0) / 1e6 AS known_power_gw,
    SUM(energy_kwh) FILTER (WHERE ISFINITE(energy_kwh) AND energy_kwh > 0) / 1e6 AS known_energy_gwh,
    SUM(known_positive_unit_power_kw) / 1e6 AS known_positive_unit_power_gw,
    COUNT(*) FILTER (WHERE power_kw IS NULL OR NOT ISFINITE(power_kw)) AS unknown_or_nonfinite_power_count,
    COUNT(*) FILTER (WHERE energy_kwh IS NULL OR NOT ISFINITE(energy_kwh)) AS unknown_or_nonfinite_energy_count
FROM report_rows
GROUP BY ALL
