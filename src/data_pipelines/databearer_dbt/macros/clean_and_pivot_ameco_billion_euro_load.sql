{% macro clean_and_pivot_ameco_billion_euro_load(table_name) %}

WITH unpivoted_table AS
(UNPIVOT {{source('staging', table_name)}}
ON {{ get_numerical_columns(table_name, 'source') }}
INTO
    NAME year
    VALUE value),
cleaned AS(
SELECT
    country as land,
    label,
    'EUR' as einheit,
    CAST(year AS INTEGER) as jahr,
    round(value * 1000000000, 0) as wert
FROM unpivoted_table)
SELECT
    *
FROM
    unpivoted_table
{% endmacro %}
