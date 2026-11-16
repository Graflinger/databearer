select
    country as land,
    year as jahr,
    emissions_total_as_share_of_global as co2_anteil_prozent,
    source_sha256
from {{ source('staging', 'owid_gcp_co2_share') }}
where emissions_total_as_share_of_global is not null
