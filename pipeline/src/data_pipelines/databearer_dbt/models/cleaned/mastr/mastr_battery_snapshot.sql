-- Fail before downstream materialization if the explicit analysis date does not
-- describe the atomically ingested source tables, including their catalogue.
{# Parse-only placeholder; selected compilation always requires the explicit var. #}
{% set snapshot = '' %}
{% if execute %}
    {% set snapshot = var('battery_snapshot_date') %}
    {% if not modules.re.fullmatch('[0-9]{4}-[0-9]{2}-[0-9]{2}', snapshot | string) %}
        {{ exceptions.raise_compiler_error('battery_snapshot_date must be explicit YYYY-MM-DD') }}
    {% endif %}
{% endif %}

SELECT
    CASE WHEN COUNT(*) = 1
        AND MIN(TRY_CAST(snapshot_date AS DATE)) = DATE '{{ snapshot }}'
        AND MIN(NULLIF(TRIM(source_url), '')) IS NOT NULL
        AND MIN(NULLIF(TRIM(filename), '')) IS NOT NULL
        AND COALESCE(BOOL_AND(REGEXP_FULL_MATCH(archive_sha256, '[0-9a-fA-F]{64}')), FALSE)
        THEN MIN(TRY_CAST(snapshot_date AS DATE))
        ELSE ERROR('MaStR provenance must have exactly one complete row matching battery_snapshot_date')
    END AS snapshot_date,
    MIN(source_url) AS source_url,
    MIN(archive_sha256) AS archive_sha256,
    MIN(filename) AS source_filename
FROM {{ source('staging', 'mastr_snapshot') }}
