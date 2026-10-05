-- Monthly European gas benchmark (World Bank Pink Sheet, TTF) converted to EUR/MWh.
-- 1 MMBtu (international table BTU) = 1,055,055,852.62 J = 0.29307107017 MWh, so
-- EUR/MWh = (USD/MMBtu) / (USD per EUR) / 0.29307107017.
-- Converting monthly averages with monthly average exchange rates is an approximation
-- of converting each daily quote; the article discloses this modification.
select
    gas.month,
    gas.usd_per_mmbtu as gas_usd_per_mmbtu,
    fx.usd_per_eur,
    gas.usd_per_mmbtu / fx.usd_per_eur / 0.29307107017 as gas_eur_per_mwh,
    gas.release_date as gas_release_date,
    gas.source_sha256 as gas_source_sha256,
    fx.source_sha256 as fx_source_sha256
from {{ ref('world_bank_gas_europe_monthly') }} as gas
inner join {{ ref('ecb_usd_eur_monthly') }} as fx using (month)
