-- Recovered from 53b4954, with tolerant casts and a non-multiplying category join.
WITH categories AS (
    SELECT
        TRY_CAST("Id" AS INTEGER) AS id,
        CASE WHEN COUNT(*) = 1 THEN MIN("Name") END AS name,
        COUNT(*) AS category_row_count
    FROM {{ source('staging', 'mastr_katalogkategorien') }}
    GROUP BY 1
)
SELECT
    TRY_CAST(k."Id" AS INTEGER) AS katalogwert_id,
    NULLIF(TRIM(k."Wert"), '') AS katalogwert,
    TRY_CAST(k."KatalogKategorieId" AS INTEGER) AS katalogkategorie_id,
    c.name AS katalogkategorie,
    c.category_row_count,
    provenance.snapshot_date,
    provenance.archive_sha256
FROM {{ source('staging', 'mastr_katalogwerte') }} AS k
LEFT JOIN categories AS c ON TRY_CAST(k."KatalogKategorieId" AS INTEGER) = c.id
CROSS JOIN {{ ref('mastr_battery_snapshot') }} AS provenance
