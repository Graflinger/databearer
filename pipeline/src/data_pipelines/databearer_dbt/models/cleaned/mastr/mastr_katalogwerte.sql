SELECT
    CAST(katalogwerte."Id" AS INTEGER) AS katalogwert_id,
    katalogwerte."Wert" AS katalogwert,
    CAST(katalogwerte."KatalogKategorieId" AS INTEGER) AS katalogkategorie_id,
    katalogkategorien."Name" AS katalogkategorie
FROM
    {{ source('staging', 'mastr_katalogwerte') }} AS katalogwerte
LEFT JOIN
    {{ source('staging', 'mastr_katalogkategorien') }} AS katalogkategorien
ON
    CAST(katalogwerte."KatalogKategorieId" AS INTEGER) = CAST(katalogkategorien."Id" AS INTEGER)
