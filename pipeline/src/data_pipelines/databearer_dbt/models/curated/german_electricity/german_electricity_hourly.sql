{{ config(enabled=(target.name == 'dashboard'), tags=['german_electricity']) }}

{% set series = ['biomass', 'hydro', 'wind_offshore', 'wind_onshore', 'solar',
                 'other_renewables', 'lignite', 'hard_coal', 'gas',
                 'other_conventional', 'pumped_storage', 'load', 'price'] %}

select
    timestamp_ms as timestamp,
    {% for column in series %}
    max(case when series = '{{ column }}' then value end) as {{ column }}{% if not loop.last %},{% endif %}
    {% endfor %}
from {{ ref('smard_hourly_cleaned') }}
group by timestamp_ms
