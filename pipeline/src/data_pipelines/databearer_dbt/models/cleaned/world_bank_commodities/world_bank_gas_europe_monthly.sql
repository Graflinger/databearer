-- Source periods are YYYY-MM; missing observations ("…") stay absent, never zero.
select
    cast(strptime(period || '-01', '%Y-%m-%d') as date) as month,
    cast(usd_per_mmbtu as double) as usd_per_mmbtu,
    cast(release_date as date) as release_date,
    source_sha256
from {{ source('staging', 'world_bank_gas_europe_monthly') }}
where usd_per_mmbtu is not null
