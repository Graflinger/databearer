-- Photovoltaic capacity in GW = on-grid + off-grid PV. IRENA leaves off-grid empty for
-- countries without off-grid reporting (e.g. Germany); that counts as zero here.
-- Concentrated solar power is excluded: the article is about solar modules.
select
    country as land,
    year as jahr,
    solar_photovoltaic_gw + coalesce(solar_photovoltaic__off_grid_gw, 0) as pv_gw,
    solar_photovoltaic_gw as pv_netzgekoppelt_gw,
    source_sha256
from {{ source('staging', 'owid_irena_solar_pv_capacity') }}
where solar_photovoltaic_gw is not null
