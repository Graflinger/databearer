SELECT
    strptime(days, '%d.%m.%Y') as date,
    data as anteil_eeg
FROM
    {{ source('staging', 'energy_charts_ren_share_daily_avg') }}


