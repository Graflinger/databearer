SELECT
    entities as land,
    years as jahr,
    electricity_as_a_share_of_primary_energy as strom_anteil_prozent
FROM
    {{source('staging','electricity_as_share_of_primary_energy')}}
