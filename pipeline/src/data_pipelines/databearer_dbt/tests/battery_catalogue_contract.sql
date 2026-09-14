-- Fail closed if the actual source export does not confirm these selections.
WITH expected(id, label, category, category_name) AS (
    VALUES (84, 'Deutschland', 6, 'Land'),
        (524, 'Batterie', 29, 'StromspeicherOhneWasserkraft'),
        (472, 'Aktiviert', 19, 'Systemstatus'),
        (35, 'In Betrieb', 4, 'Betriebsstatus'),
        (31, 'In Planung', 4, 'Betriebsstatus'),
        (2954, 'Geprüft', 175, 'NBPStatusFilter'),
        (2955, 'In Prüfung', 175, 'NBPStatusFilter')
)
SELECT e.id
FROM expected AS e
LEFT JOIN {{ ref('mastr_katalogwerte') }} AS k ON e.id = k.katalogwert_id
GROUP BY e.id, e.label, e.category, e.category_name
HAVING COUNT(k.katalogwert_id) <> 1
    OR MIN(k.katalogwert) IS DISTINCT FROM e.label
    OR MIN(k.katalogkategorie_id) IS DISTINCT FROM e.category
    OR MIN(k.katalogkategorie) IS DISTINCT FROM e.category_name
    OR MIN(k.category_row_count) IS DISTINCT FROM 1
