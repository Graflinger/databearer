SELECT 
    date_trunc('month', date) as datum,
    round(AVG(anteil_eeg),2) as anteil_eeg
FROM
    {{ ref('ren_share_daily_avg') }}
GROUP BY
    datum