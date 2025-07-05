SELECT
    länder_code AS Ländercode,
    jahr as Jahr,
    hitzetage_prognose as Hitzetageprognose
FROM 
    {{ref('hitzetage_projektion')}}
