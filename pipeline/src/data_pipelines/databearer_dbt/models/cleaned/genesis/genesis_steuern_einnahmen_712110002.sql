{% set index_columns = ["steuerarten"] %}
{% set pivot_columns = ["steuerarten"] %}



WITH unpivoted_table AS
(UNPIVOT {{ source('staging', 'genesis_steuern_einnahmen_712110002')}}
ON {{get_numerical_columns(table_name='genesis_steuern_einnahmen_712110002', table_type='source')}}
INTO
    NAME year
    VALUE value),
cleaned AS(
    SELECT {{comma_seperated_col_list_cleaned(index_columns)}}
    ,CAST(year AS INTEGER) as year
    ,round(value * {{ thousand() }}, 2) as value
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
