-- Segment counts/capacity must partition overall in each output, including plans.
{% for model, dimensions in [
    ('fact_battery_storage_germany_yearly', 'snapshot_date, commissioning_year'),
    ('fact_battery_storage_germany_monthly', 'snapshot_date, commissioning_month'),
    ('fact_battery_storage_germany_by_state', 'snapshot_date, state'),
    ('fact_battery_storage_germany_summary', 'snapshot_date, operating_status')
] %}
SELECT '{{ model }}' AS failed_relation
FROM {{ ref(model) }}
GROUP BY {{ dimensions }}
HAVING SUM(plant_count) FILTER (WHERE size_segment <> 'overall')
        IS DISTINCT FROM SUM(plant_count) FILTER (WHERE size_segment = 'overall')
    OR ABS(SUM(power_gw) FILTER (WHERE size_segment <> 'overall')
        - SUM(power_gw) FILTER (WHERE size_segment = 'overall')) > 1e-9
    OR ABS(SUM(energy_gwh) FILTER (WHERE size_segment <> 'overall')
        - SUM(energy_gwh) FILTER (WHERE size_segment = 'overall')) > 1e-9
{% if not loop.last %}UNION ALL{% endif %}
{% endfor %}

{% for model in ['fact_battery_storage_germany_yearly', 'fact_battery_storage_germany_monthly', 'fact_battery_storage_germany_by_state'] %}
UNION ALL
SELECT '{{ model }}_plant_totals' AS failed_relation
WHERE (SELECT COALESCE(SUM(plant_count), 0) FROM {{ ref(model) }} WHERE size_segment = 'overall')
        <> (SELECT COUNT(*) FROM {{ ref('fact_battery_storage_germany_plants') }} WHERE is_included)
    OR ABS((SELECT SUM(power_gw) FROM {{ ref(model) }} WHERE size_segment = 'overall')
        - (SELECT SUM(power_kw) / 1e6 FROM {{ ref('fact_battery_storage_germany_plants') }} WHERE is_included)) > 1e-9
    OR ABS((SELECT SUM(energy_gwh) FROM {{ ref(model) }} WHERE size_segment = 'overall')
        - (SELECT SUM(energy_kwh) / 1e6 FROM {{ ref('fact_battery_storage_germany_plants') }} WHERE is_included)) > 1e-9
{% endfor %}
