
SELECT
    vgr_bund.year,
    vgr_bund."Sozialbeiträge an den Staat" as Sozialbeiträge_an_den_Staat,
    steuern_einnahmen."Steuereinnahmen des Bundes" as Steuereinnahmen_des_Bundes,
    bip_yearly.Bruttoinlandsprodukt
FROM
    {{ ref('genesis_VGR_BUND_810000031')}} as vgr_bund
LEFT JOIN
    {{ ref('genesis_steuern_einnahmen_712110002')}} as steuern_einnahmen
    ON vgr_bund.year = steuern_einnahmen.year
LEFT JOIN
    {{ ref('genesis_VGR_BUND_810000001')}} as bip_yearly
    ON vgr_bund.year = bip_yearly.year
