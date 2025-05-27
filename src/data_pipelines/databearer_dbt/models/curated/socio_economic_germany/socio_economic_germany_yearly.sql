SELECT
    year as jahr,
    Insgesamt_ausgaben_am_bip_prozent
FROM
    prod_cleaned.genesis_bildungsausgaben_217110001
WHERE
    körperschaftsgruppen = 'Bund'
