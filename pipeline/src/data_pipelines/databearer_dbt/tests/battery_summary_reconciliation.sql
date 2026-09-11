-- Compare every status/segment (including overall) to plants. FULL OUTER JOIN
-- detects removed planned rows, extra statuses and duplicate/doubled summaries.
WITH expected AS (
    SELECT snapshot_date, operating_status,
        CASE WHEN GROUPING(size_segment) = 1 THEN 'overall' ELSE size_segment END AS size_segment,
        COUNT(*) AS plant_count, SUM(unit_count) AS unit_count,
        SUM(power_kw) / 1e6 AS power_gw, SUM(energy_kwh) / 1e6 AS energy_gwh
    FROM {{ ref('fact_battery_storage_germany_plants') }}
    WHERE is_included OR is_planned_included
    GROUP BY GROUPING SETS ((snapshot_date, operating_status, size_segment), (snapshot_date, operating_status))
), actual AS (
    SELECT snapshot_date, operating_status, size_segment, COUNT(*) AS row_count,
        SUM(plant_count) AS plant_count, SUM(unit_count) AS unit_count,
        SUM(power_gw) AS power_gw, SUM(energy_gwh) AS energy_gwh
    FROM {{ ref('fact_battery_storage_germany_summary') }}
    GROUP BY ALL
)
SELECT COALESCE(e.operating_status, a.operating_status) AS operating_status,
    COALESCE(e.size_segment, a.size_segment) AS size_segment
FROM expected AS e
FULL OUTER JOIN actual AS a
    ON e.snapshot_date = a.snapshot_date AND e.operating_status = a.operating_status
    AND e.size_segment = a.size_segment
WHERE a.row_count IS DISTINCT FROM 1
    OR e.plant_count IS DISTINCT FROM a.plant_count
    OR e.unit_count IS DISTINCT FROM a.unit_count
    OR (e.power_gw IS NULL) IS DISTINCT FROM (a.power_gw IS NULL)
    OR (e.energy_gwh IS NULL) IS DISTINCT FROM (a.energy_gwh IS NULL)
    OR NOT COALESCE(ISFINITE(a.power_gw) AND ABS(e.power_gw - a.power_gw) <= 1e-9, FALSE)
    OR NOT COALESCE(ISFINITE(a.energy_gwh) AND ABS(e.energy_gwh - a.energy_gwh) <= 1e-9, FALSE)
