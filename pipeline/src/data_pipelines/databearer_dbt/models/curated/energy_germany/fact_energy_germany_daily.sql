SELECT 
    date as datum,
    round(anteil_eeg, 2) as anteil_eeg
FROM 
    {{ ref('ren_share_daily_avg') }}