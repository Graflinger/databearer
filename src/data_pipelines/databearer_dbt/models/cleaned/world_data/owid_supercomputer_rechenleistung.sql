SELECT
    years as jahr,
    supercomputer_power_flops as rechenleistung_flops
FROM
    {{source('staging','owid_compute_power')}}
