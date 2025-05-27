{% macro comma_seperated_col_list_cleaned(column_list, clean=True) %}
{%- for col in column_list -%}
    {{col  }} {% if clean %} AS {{col |replace(" ", "_") }}{% endif %}{% if not loop.last %},{% endif %}
{%- endfor -%}
{% endmacro %}
