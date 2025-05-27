{% macro comma_seperated_col_list_cleaned(column_list, apply_trim=True, clean_name=True) %}
{%- for col in column_list -%}
{% if apply_trim %}  trim({{ col  }}) {% else %}  {{ col }} {% endif %} {% if clean_name %} AS {{col |replace(" ", "_") }}{% endif %}{% if not loop.last %},{% endif %}
{%- endfor -%}
{% endmacro %}
