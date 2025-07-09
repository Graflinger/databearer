SELECT 
    date as datum,
    anteil_eeg
FROM 
    {{ ref('ren_share_daily_avg') }}