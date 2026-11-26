-- One row per year with the global PV module price (1975 onwards) and, from 2000,
-- PV capacity for the world, Germany and China, annual net additions (year-end
-- capacity minus the previous year-end) and Germany's shares. "Übrige Welt" is the
-- world total minus Germany and China. Shares are percent of the world total.
with kapazitaet as (
    select
        jahr,
        max(case when land = 'World' then pv_gw end) as welt_gw,
        max(case when land = 'Germany' then pv_gw end) as deutschland_gw,
        max(case when land = 'China' then pv_gw end) as china_gw
    from {{ ref('owid_pv_kapazitaet') }}
    where land in ('World', 'Germany', 'China')
    group by jahr
),
zubau as (
    select
        *,
        welt_gw - lag(welt_gw) over (order by jahr) as zubau_welt_gw,
        deutschland_gw - lag(deutschland_gw) over (order by jahr) as zubau_deutschland_gw,
        china_gw - lag(china_gw) over (order by jahr) as zubau_china_gw
    from kapazitaet
),
anteile as (
    select
        jahr,
        max(case when land = 'Germany' then co2_anteil_prozent end) as co2_anteil_deutschland_prozent
    from {{ ref('owid_co2_anteil') }}
    group by jahr
),
solar as (
    select
        jahr,
        max(case when land = 'World' then solar_anteil_prozent end) as solar_stromanteil_welt_prozent,
        max(case when land = 'Germany' then solar_anteil_prozent end) as solar_stromanteil_deutschland_prozent
    from {{ ref('owid_solar_stromanteil') }}
    group by jahr
)
select
    preis.jahr,
    preis.modulpreis_usd2025_pro_watt,
    preis.kumulierte_leistung_welt_gw,
    zubau.welt_gw,
    zubau.deutschland_gw,
    zubau.china_gw,
    zubau.welt_gw - zubau.deutschland_gw - zubau.china_gw as uebrige_welt_gw,
    zubau.zubau_welt_gw,
    zubau.zubau_deutschland_gw,
    zubau.zubau_china_gw,
    zubau.zubau_welt_gw - zubau.zubau_deutschland_gw - zubau.zubau_china_gw as zubau_uebrige_welt_gw,
    100 * zubau.deutschland_gw / zubau.welt_gw as anteil_bestand_deutschland_prozent,
    100 * zubau.zubau_deutschland_gw / zubau.zubau_welt_gw as anteil_zubau_deutschland_prozent,
    anteile.co2_anteil_deutschland_prozent,
    solar.solar_stromanteil_welt_prozent,
    solar.solar_stromanteil_deutschland_prozent
from {{ ref('owid_pv_modulpreis') }} as preis
left join zubau using (jahr)
left join anteile using (jahr)
left join solar using (jahr)
order by preis.jahr
