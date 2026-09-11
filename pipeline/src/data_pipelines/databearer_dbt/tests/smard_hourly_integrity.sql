{{ config(enabled=(target.name == 'dashboard'), tags=['german_electricity']) }}

-- Enforce uniqueness before the curated pivot could hide duplicate observations.
select series, timestamp_ms
from {{ ref('smard_hourly_cleaned') }}
group by series, timestamp_ms
having count(*) <> 1
    or count(value) <> 1
    or min(timestamp_ms) % 3600000 <> 0
    or not bool_and(isfinite(value))
    or min(value) < case when series = 'price' then -10000 else 0 end
    or max(value) > case when series = 'price' then 10000 else 200 end
