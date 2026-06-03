{% set index_columns = ["beschreibung", "einheit"] %}
{% set pivot_columns = ["beschreibung"] %}



WITH unpivoted_table AS
(UNPIVOT {{ source('staging', 'genesis_VGR_BUND_810000031')}}
ON {{get_numerical_columns(table_name='genesis_VGR_BUND_810000031', table_type='source')}}
INTO
    NAME year
    VALUE value),
cleaned AS(
    SELECT {{comma_seperated_col_list_cleaned(index_columns)}}
    ,CAST(year AS INTEGER) as year
    ,round(value * {{ billion() }}, 2) as value
FROM unpivoted_table),
pivoted_by_index AS(
    PIVOT cleaned
    ON {{comma_seperated_col_list_cleaned(pivot_columns, apply_trim=False, clean_name=False)}}
    ,USING max(value)
)
SELECT
    *
FROM
    pivoted_by_index
