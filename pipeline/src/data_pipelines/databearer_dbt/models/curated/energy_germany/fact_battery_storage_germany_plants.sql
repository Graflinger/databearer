-- Required source date: never use current_date or infer it from commissioning.
{% set snapshot = '' %}
{% if execute %}
    {% set snapshot = var('battery_snapshot_date') %}
    {% if not modules.re.fullmatch('[0-9]{4}-[0-9]{2}-[0-9]{2}', snapshot | string) %}
        {{ exceptions.raise_compiler_error('battery_snapshot_date must be explicit YYYY-MM-DD') }}
    {% endif %}
{% endif %}

WITH plants AS (
    SELECT
        COALESCE('plant:' || spe_mastr_nummer, 'plant_row:' || source_row_number) AS analysis_id,
        MIN(spe_mastr_nummer) AS spe_mastr_nummer,
        COUNT(*) AS plant_row_count,
        -- Values remain inspectable even when duplicate records exclude the plant.
        LIST(raw_nutzbare_speicherkapazitaet ORDER BY source_row_number) AS raw_energy_values,
        CASE WHEN COUNT(*) = 1 THEN MIN(nutzbare_speicherkapazitaet_kwh) END AS energy_kwh,
        MIN(verknuepfte_einheiten_mastr_nummern) AS declared_unit_ids,
        MIN(anlage_betriebsstatus_id) AS plant_status_id,
        LIST(raw_anlage_betriebsstatus ORDER BY source_row_number) AS raw_plant_status_values
    FROM {{ ref('mastr_stromspeicher_anlagen') }}
    GROUP BY 1
), units AS (
    SELECT
        COALESCE('plant:' || spe_mastr_nummer, 'unit_row:' || source_row_number) AS analysis_id,
        MIN(spe_mastr_nummer) AS spe_mastr_nummer,
        COUNT(*) AS unit_count,
        LIST(einheit_mastr_nummer ORDER BY source_row_number) AS unit_ids,
        LIST(raw_nettonennleistung ORDER BY source_row_number) AS raw_power_values,
        LIST(raw_inbetriebnahmedatum ORDER BY source_row_number) AS raw_commissioning_values,
        BOOL_AND(COALESCE(REGEXP_FULL_MATCH(einheit_mastr_nummer, 'SEE[0-9]{12}'), FALSE)
            AND identifier_row_count = 1) AS unit_identifiers_valid,
        BOOL_AND(is_active_german_battery) AS all_active_german_battery,
        COUNT(*) FILTER (WHERE is_active_german_battery AND operating_status = 'operating') AS selected_operating_unit_count,
        CASE WHEN COUNT(DISTINCT operating_status) = 1 THEN MIN(operating_status) ELSE 'mixed' END AS operating_status,
        MIN(einheit_betriebsstatus_id) AS unit_status_id,
        -- No partial SUM: an unknown component means unknown plant power.
        CASE WHEN COUNT(nettonennleistung_kw) = COUNT(*) THEN SUM(nettonennleistung_kw) END AS power_kw,
        SUM(nettonennleistung_kw) FILTER (WHERE ISFINITE(nettonennleistung_kw) AND nettonennleistung_kw > 0)
            AS known_positive_unit_power_kw,
        BOOL_AND(COALESCE(ISFINITE(nettonennleistung_kw) AND nettonennleistung_kw > 0, FALSE)) AS unit_power_valid,
        MIN(inbetriebnahmedatum) AS commissioning_date,
        MAX(inbetriebnahmedatum) AS latest_unit_commissioning_date,
        COUNT(DISTINCT inbetriebnahmedatum) > 1 AS has_commissioning_spread,
        BOOL_AND(COALESCE(inbetriebnahmedatum BETWEEN DATE '1990-01-01' AND DATE '{{ snapshot }}', FALSE)) AS commissioning_valid,
        MIN(geplantes_inbetriebnahmedatum) AS planned_commissioning_date,
        COUNT(DISTINCT bundesland_id) AS state_count,
        CASE WHEN COUNT(DISTINCT bundesland_id) = 1 AND COUNT(bundesland) = COUNT(*) THEN MIN(bundesland) END AS state,
        CASE WHEN COUNT(is_network_verified) = COUNT(*) THEN BOOL_AND(is_network_verified) END AS is_network_verified,
        COUNT(*) FILTER (WHERE is_network_verified) AS network_verified_unit_count
    FROM {{ ref('mastr_stromspeicher_einheiten') }}
    GROUP BY 1
), joined AS (
    SELECT
        COALESCE(u.analysis_id, p.analysis_id) AS analysis_id,
        COALESCE(u.spe_mastr_nummer, p.spe_mastr_nummer) AS spe_mastr_nummer,
        provenance.snapshot_date,
        provenance.source_url,
        provenance.archive_sha256,
        provenance.source_filename,
        u.* EXCLUDE (analysis_id, spe_mastr_nummer),
        p.* EXCLUDE (analysis_id, spe_mastr_nummer),
        CASE WHEN ISFINITE(power_kw) AND power_kw > 0 AND ISFINITE(energy_kwh)
            THEN energy_kwh / power_kw END AS duration_hours,
        -- The source FIELD is SpeMastrNummer, but actual storage IDs start SSE.
        COALESCE(REGEXP_FULL_MATCH(COALESCE(u.spe_mastr_nummer, p.spe_mastr_nummer), 'SSE[0-9]{12}'), FALSE)
            AND COALESCE(unit_identifiers_valid, FALSE) AS identifiers_valid,
        COALESCE(plant_row_count = 1 AND unit_count > 0
            AND LIST_SORT(STRING_SPLIT(REGEXP_REPLACE(declared_unit_ids, '\s+', '', 'g'), ',')) = LIST_SORT(unit_ids), FALSE)
            AS plant_unit_join_valid,
        COALESCE(all_active_german_battery AND operating_status IN ('operating', 'planned')
            AND plant_status_id = unit_status_id, FALSE) AS selection_status_valid,
        COALESCE(unit_power_valid AND ISFINITE(power_kw) AND power_kw > 0.3, FALSE) AS power_valid,
        COALESCE(ISFINITE(energy_kwh) AND energy_kwh > 0.3, FALSE) AS energy_valid
    FROM units AS u
    FULL OUTER JOIN plants AS p ON u.analysis_id = p.analysis_id
    CROSS JOIN {{ ref('mastr_battery_freshness') }} AS provenance
    WHERE provenance.is_fresh
), flagged AS (
    SELECT *,
        COALESCE(ISFINITE(duration_hours) AND duration_hours BETWEEN 0.1 AND 12, FALSE) AS duration_valid,
        CASE
            WHEN NOT (power_valid AND energy_valid) THEN NULL
            WHEN power_kw < 30 AND energy_kwh < 30 THEN 'small'
            WHEN power_kw >= 1000 OR energy_kwh >= 1000 THEN 'large'
            ELSE 'medium'
        END AS size_segment,
        DATE_PART('year', commissioning_date)::INTEGER AS commissioning_year,
        DATE_TRUNC('month', commissioning_date)::DATE AS commissioning_month
    FROM joined
), reasons AS (
    SELECT *, LIST_FILTER([
        CASE WHEN NOT identifiers_valid THEN 'invalid_or_duplicate_identifier' END,
        CASE WHEN COALESCE(plant_row_count, 0) <> 1 THEN 'missing_or_duplicate_plant' END,
        CASE WHEN COALESCE(unit_count, 0) = 0 THEN 'orphan_plant' END,
        CASE WHEN NOT plant_unit_join_valid THEN 'plant_unit_link_mismatch' END,
        CASE WHEN NOT COALESCE(all_active_german_battery, FALSE) THEN 'not_active_german_battery' END,
        CASE WHEN NOT selection_status_valid THEN 'unknown_mixed_or_conflicting_status' END,
        CASE WHEN NOT power_valid THEN 'invalid_or_missing_power' END,
        CASE WHEN NOT energy_valid THEN 'invalid_or_missing_energy' END,
        CASE WHEN NOT duration_valid THEN 'duration_outside_0_1_to_12h_or_unknown' END,
        CASE WHEN operating_status = 'operating' AND NOT commissioning_valid THEN 'invalid_or_missing_commissioning_date' END,
        CASE WHEN state_count > 1 THEN 'conflicting_states' END
    ], reason -> reason IS NOT NULL) AS quality_reasons
    FROM flagged
)
SELECT *,
    LENGTH(quality_reasons) = 0 AND operating_status = 'operating' AS is_included,
    LENGTH(quality_reasons) = 0 AND operating_status = 'planned' AS is_planned_included,
    ARRAY_TO_STRING(quality_reasons, ';') AS quality_reason_codes
FROM reasons
