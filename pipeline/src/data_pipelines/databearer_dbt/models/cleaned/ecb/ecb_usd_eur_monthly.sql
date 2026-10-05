select
    cast(strptime(period || '-01', '%Y-%m-%d') as date) as month,
    cast(usd_per_eur as double) as usd_per_eur,
    source_sha256
from {{ source('staging', 'ecb_usd_eur_monthly') }}
