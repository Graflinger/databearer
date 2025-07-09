SELECT 
    date_trunc('month', date) as monat,
    AVG(anteil_eeg) as anteil_eeg
FROM
    {{ ref('ren_share_daily_avg') }}
GROUP BY
    monat