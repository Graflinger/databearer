-- Fails (returns rows) on duplicate months, implausible values, a conversion
-- mismatch, or any 2019-01..2025-12 month missing from the curated fact.
select 'duplicate_or_invalid' as problem, month
from {{ ref('fact_gas_price_europe_monthly') }}
group by month
having count(*) <> 1
    or not bool_and(isfinite(gas_usd_per_mmbtu) and gas_usd_per_mmbtu > 0 and gas_usd_per_mmbtu < 200)
    or not bool_and(isfinite(usd_per_eur) and usd_per_eur > 0.5 and usd_per_eur < 2)
    or not bool_and(abs(gas_eur_per_mwh * usd_per_eur * 0.29307107017 - gas_usd_per_mmbtu) < 1e-9)

union all

select 'missing_month' as problem, expected.month
from (
    select cast(range as date) as month
    from range(date '2019-01-01', date '2026-01-01', interval 1 month)
) as expected
anti join {{ ref('fact_gas_price_europe_monthly') }} as actual using (month)
