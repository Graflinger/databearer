-- Model: Hitzetage Projektion
WITH filtered_data AS (
    SELECT 
        *
    FROM {{ source('staging', 'Hitzetage_Projektion_ECS') }}
    WHERE index not like '%.%'
),
 unpivoted_data AS (
    UNPIVOT filtered_data
    ON COLUMNS(* EXCLUDE (index))
    INTO
        NAME jahr
        VALUE hitzetage_prognose
)
SELECT 
    index as länder_code,
    jahr,
    hitzetage_prognose
FROM unpivoted_data 
