SELECT 
    date_trunc('month', date) as datum,
    AVG(anteil_eeg) as anteil_eeg
FROM
    {{ ref('ren_share_daily_avg') }}
GROUP BY
    datum