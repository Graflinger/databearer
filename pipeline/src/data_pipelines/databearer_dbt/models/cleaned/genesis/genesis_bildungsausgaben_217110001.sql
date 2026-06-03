{% set index_columns = ["körperschaftsgruppen", "gruppe", "beschreibung", "einheit"] %}
{% set pivot_columns = ["gruppe", "beschreibung"] %}



WITH unpivoted_table AS
(UNPIVOT {{ source('staging', 'genesis_bildungsausgaben_217110001')}}
ON {{get_numerical_columns(table_name='genesis_bildungsausgaben_217110001', table_type='source')}}
INTO
    NAME year
    VALUE value),
cleaned AS(
    SELECT {{comma_seperated_col_list_cleaned(index_columns)}}
    ,CAST(year AS INTEGER) as year
    ,value
FROM unpivoted_table),
specific_clean_tasks AS (
SELECT
	körperschaftsgruppen,
	gruppe,
	CASE
		WHEN beschreibung = 'Ausgaben der öffentlichen Haushalte für Bildung' THEN 'ausgaben'
		WHEN beschreibung = 'Ausgaben der öff. Haushalte für Bildung je Einw.' THEN 'ausgaben_je_einw'
		WHEN beschreibung = 'Anteil d.Ausgaben d. öff. Haushalte f.Bild. am BIP' THEN 'ausgaben_am_bip_prozent'
		WHEN beschreibung = 'Anteil d.Ausgaben d. öff. Haushalte f.Bild. am BIP' THEN 'ausgaben_am_ges_haushalt_prozent'
	END AS beschreibung,
	year,
	CASE
		WHEN einheit = 'Tsd. EUR' THEN round(value * 1000,2)
		WHEN einheit = 'EUR' THEN value
		WHEN einheit = 'Prozent' THEN value
	END AS value
FROM
	cleaned
),
pivoted_by_index AS(
    PIVOT specific_clean_tasks
    ON {{comma_seperated_col_list_cleaned(pivot_columns, apply_trim=False, clean_name=False)}}
    ,USING max(value)
)
SELECT
    *
FROM
    pivoted_by_index
