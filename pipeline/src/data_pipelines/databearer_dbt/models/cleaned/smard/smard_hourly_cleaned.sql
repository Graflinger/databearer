{{ config(enabled=(target.name == 'dashboard'), tags=['german_electricity']) }}

-- SMARD hour values are interval MWh: MWh / 1h / 1000 = average GW.
-- Prices already represent EUR/MWh; preserve negative prices and true zeroes.
select
    cast(series as varchar) as series,
    cast(timestamp_ms as bigint) as timestamp_ms,
    case when series = 'price' then cast(value as double)
         else cast(value as double) / 1000.0 end as value
from {{ source('smard', 'smard_hourly') }}
cross join {{ source('smard', 'smard_window') }}
where timestamp_ms >= start_ms and timestamp_ms < end_ms
