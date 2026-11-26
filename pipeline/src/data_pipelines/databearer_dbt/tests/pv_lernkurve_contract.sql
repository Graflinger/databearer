-- Fails (returns rows) on duplicate years, a gap in 1975..2025 prices or 2000..2025
-- capacity, implausible values, or Germany/China exceeding the world total.
select 'duplicate_or_invalid' as problem, jahr
from {{ ref('fact_solar_pv_world_yearly') }}
group by jahr
having count(*) <> 1
    or not bool_and(isfinite(modulpreis_usd2025_pro_watt) and modulpreis_usd2025_pro_watt > 0)
    or not bool_and(kumulierte_leistung_welt_gw > 0)
    or not bool_and(jahr < 2000 or (deutschland_gw >= 0 and china_gw >= 0 and deutschland_gw + china_gw <= welt_gw))
    or not bool_and(jahr < 2000 or anteil_bestand_deutschland_prozent between 0 and 100)

union all

select 'missing_year' as problem, expected.jahr
from (select range as jahr from range(1975, 2026)) as expected
anti join {{ ref('fact_solar_pv_world_yearly') }} as actual using (jahr)

union all

select 'missing_capacity' as problem, jahr
from {{ ref('fact_solar_pv_world_yearly') }}
where jahr between 2000 and 2025
  and (welt_gw is null or deutschland_gw is null or china_gw is null)
