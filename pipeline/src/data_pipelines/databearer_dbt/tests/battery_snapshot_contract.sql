-- Revalidate source provenance at test time, including stale model materializations.
{% set snapshot = '' %}
{% if execute %}
    {% set snapshot = var('battery_snapshot_date') %}
    {% if not modules.re.fullmatch('[0-9]{4}-[0-9]{2}-[0-9]{2}', snapshot | string) %}
        {{ exceptions.raise_compiler_error('battery_snapshot_date must be explicit YYYY-MM-DD') }}
    {% endif %}
{% endif %}

SELECT 'source_snapshot' AS failed_relation
FROM {{ source('staging', 'mastr_snapshot') }}
HAVING COUNT(*) <> 1
    OR MIN(TRY_CAST(snapshot_date AS DATE)) IS DISTINCT FROM DATE '{{ snapshot }}'
    OR MIN(NULLIF(TRIM(source_url), '')) IS NULL
    OR MIN(NULLIF(TRIM(filename), '')) IS NULL
    OR COALESCE(BOOL_AND(REGEXP_FULL_MATCH(archive_sha256, '[0-9a-fA-F]{64}')), FALSE) = FALSE
UNION ALL
SELECT 'cleaned_snapshot'
FROM {{ ref('mastr_battery_snapshot') }}
HAVING COUNT(*) <> 1 OR MIN(snapshot_date) IS DISTINCT FROM DATE '{{ snapshot }}'
UNION ALL
SELECT 'plant_provenance'
WHERE EXISTS (
    SELECT 1 FROM {{ ref('fact_battery_storage_germany_plants') }} AS p
    WHERE p.snapshot_date IS DISTINCT FROM DATE '{{ snapshot }}'
        OR NOT EXISTS (
            SELECT 1 FROM {{ source('staging', 'mastr_snapshot') }} AS s
            WHERE p.snapshot_date = s.snapshot_date AND p.source_url = s.source_url
                AND p.archive_sha256 = s.archive_sha256 AND p.source_filename = s.filename
        )
)
{% for model in ['mastr_katalogwerte', 'mastr_stromspeicher_einheiten', 'mastr_stromspeicher_anlagen'] %}
UNION ALL
SELECT '{{ model }}_provenance'
WHERE EXISTS (
    SELECT 1 FROM {{ ref(model) }} AS c
    WHERE NOT EXISTS (
        SELECT 1 FROM {{ source('staging', 'mastr_snapshot') }} AS s
        WHERE c.snapshot_date = s.snapshot_date AND c.archive_sha256 = s.archive_sha256
    )
)
{% endfor %}
