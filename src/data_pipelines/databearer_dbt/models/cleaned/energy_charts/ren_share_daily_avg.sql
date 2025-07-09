SELECT
    strptime(days, '%d.%m.%Y') as date,
    round(data, 2) as anteil_eeg
FROM
    {{ source('staging', 'energy_charts_ren_share_daily_avg') }}


