-- Full-outer audit relation must account for every ingested source row exactly once.
SELECT 'unit_rows' AS failed_relation
WHERE (SELECT COALESCE(SUM(unit_count), 0) FROM {{ ref('fact_battery_storage_germany_plants') }})
    <> (SELECT COUNT(*) FROM {{ ref('mastr_stromspeicher_einheiten') }})
UNION ALL
SELECT 'plant_rows'
WHERE (SELECT COALESCE(SUM(plant_row_count), 0) FROM {{ ref('fact_battery_storage_germany_plants') }})
    <> (SELECT COUNT(*) FROM {{ ref('mastr_stromspeicher_anlagen') }})
UNION ALL
SELECT 'quality_relations'
WHERE (SELECT COALESCE(SUM(relation_count), 0) FROM {{ ref('fact_battery_storage_germany_quality') }} WHERE report_type = 'relation')
    <> (SELECT COUNT(*) FROM {{ ref('fact_battery_storage_germany_plants') }})
