-- Module price in constant 2025 US$ per watt (Nemet 1975–2003, Farmer & Lafond
-- 2004–2009, IRENA European benchmarks from 2010) and global on-grid cumulative
-- PV capacity, converted from MW to GW.
select
    year as jahr,
    cost as modulpreis_usd2025_pro_watt,
    cumulative_capacity / 1000.0 as kumulierte_leistung_welt_gw,
    source_sha256
from {{ source('staging', 'owid_pv_module_cost_capacity') }}
where country = 'World'
  and cost is not null
  and cumulative_capacity is not null
