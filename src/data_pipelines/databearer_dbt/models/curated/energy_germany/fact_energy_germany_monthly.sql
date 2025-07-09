SELECT 
    date_part('year', date) as jahr,
    AVG(anteil_eeg) as anteil_eeg
FROM
    {{ ref('ren_share_daily_avg') }}
GROUP BY
    jahr