-- Reconciliation alone can pass when every output is empty. This source is a
-- national battery snapshot and must yield usable operating plants and totals.
SELECT 'included_operating_plants' AS failed_relation
WHERE NOT EXISTS (
    SELECT 1 FROM {{ ref('fact_battery_storage_germany_plants') }} WHERE is_included
)
{% for model in ['fact_battery_storage_germany_yearly', 'fact_battery_storage_germany_monthly',
    'fact_battery_storage_germany_by_state', 'fact_battery_storage_germany_summary'] %}
UNION ALL
SELECT '{{ model }}' AS failed_relation
WHERE NOT EXISTS (
    SELECT 1 FROM {{ ref(model) }}
    WHERE size_segment = 'overall' AND plant_count > 0
        AND ISFINITE(power_gw) AND power_gw > 0
        AND ISFINITE(energy_gwh) AND energy_gwh > 0
        AND ISFINITE(median_duration_hours) AND median_duration_hours BETWEEN 0.1 AND 12
        {% if model == 'fact_battery_storage_germany_summary' %}AND operating_status = 'operating'{% endif %}
)
{% endfor %}
