{% macro get_numerical_columns(table_name, table_type="ref") %}
{% if table_type == 'ref' %}
{% set all_columns = adapter.get_columns_in_relation(ref(table_name)) %}
{% else %}
{% set all_columns = adapter.get_columns_in_relation(source('staging', table_name) ) %}
{% endif %}
{%- for col in all_columns -%}
{%- if modules.re.match('^(([0-9]*)|(([0-9]*)\.([0-9]*)))$', col.name) -%}
    {{col.name}}{% if not loop.last %},{% endif %}
{%- endif -%}
{%- endfor -%}
{% endmacro %}
