SELECT
    year as jahr,
    Insgesamt_ausgaben_am_bip_prozent
FROM
    {{ref('genesis_bildungsausgaben_217110001')}} as bwa
WHERE
    körperschaftsgruppen = 'Bund'
