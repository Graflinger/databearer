SELECT
    years as jahr,
    supercomputer_power_flops as rechenleistung_flops
FROM
    {{source('staging','compute_power')}}
