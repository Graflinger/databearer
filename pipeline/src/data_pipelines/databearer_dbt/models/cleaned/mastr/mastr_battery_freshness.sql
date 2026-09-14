{{ config(materialized='ephemeral') }}
-- Executed inline for curated-only runs: never relabel stale cleaned data with
-- the latest archive hash. Ingestion changes the source hash atomically with data.
-- Aggregate checks examine every row, not just row counts or MIN(hash).
WITH freshness AS (
    {% for model in ['mastr_katalogwerte', 'mastr_stromspeicher_einheiten', 'mastr_stromspeicher_anlagen'] %}
    SELECT '{{ model }}' AS relation_name,
        COALESCE(BOOL_AND(
            c.snapshot_date IS NOT DISTINCT FROM p.snapshot_date
            AND c.archive_sha256 IS NOT DISTINCT FROM p.archive_sha256
        ), TRUE) AS is_fresh
    FROM {{ ref(model) }} AS c
    CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS p
    {% if not loop.last %}UNION ALL{% endif %}
    {% endfor %}
), source_freshness AS (
    SELECT COUNT(*) = 1 AND COALESCE(BOOL_AND(
        s.snapshot_date IS NOT DISTINCT FROM p.snapshot_date
        AND s.archive_sha256 IS NOT DISTINCT FROM p.archive_sha256
        AND s.source_url IS NOT DISTINCT FROM p.source_url
        AND s.filename IS NOT DISTINCT FROM p.source_filename
    ), FALSE) AS is_fresh
    FROM {{ source('staging', 'mastr_snapshot') }} AS s
    CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS p
)
SELECT p.*,
    CASE WHEN (SELECT BOOL_AND(is_fresh) FROM freshness)
        AND (SELECT is_fresh FROM source_freshness)
    THEN TRUE ELSE ERROR('Stale MaStR cleaned provenance; rebuild snapshot and all cleaned models') END AS is_fresh
FROM {{ ref('mastr_battery_snapshot') }} AS p
