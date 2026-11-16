select
    country as land,
    year as jahr,
    solar_share_of_electricity__pct as solar_anteil_prozent,
    source_sha256
from {{ source('staging', 'owid_solar_electricity_share') }}
where solar_share_of_electricity__pct is not null
