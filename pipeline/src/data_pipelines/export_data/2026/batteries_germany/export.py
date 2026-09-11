"""Frozen battery article aggregates. Run from pipeline; never writes to DuckDB."""

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import duckdb
from jinja2 import Environment, StrictUndefined


PIPELINE = Path(__file__).resolve().parents[5]
DBT = PIPELINE / "src/data_pipelines/databearer_dbt"
DEFAULT_DATABASE = Path(".data/mastr_battery.duckdb")
DEFAULT_OUTPUT = Path(".data/output/batteries_germany")
DEFAULT_ELECTRICITY = PIPELINE.parent / "frontend/src/_data/germanElectricity.json"
VERSION = "1.0.1"
EPHEMERAL_MODELS = {"mastr_battery_freshness": "models/cleaned/mastr/mastr_battery_freshness.sql"}
REQUIRED_SINGULAR_TESTS = {
    "battery_aggregate_reconciliation.sql", "battery_catalogue_contract.sql",
    "battery_included_contract.sql", "battery_nonempty_operating.sql",
    "battery_snapshot_contract.sql", "battery_source_row_reconciliation.sql",
    "battery_summary_reconciliation.sql",
}
MANIFEST = "battery_storage_metadata.json"
YEARS = list(range(2019, 2026))
SEGMENTS = ("small", "medium", "large")
BERLIN = ZoneInfo("Europe/Berlin")
START = "2026-08-10T22:00:00Z"
END = "2026-09-09T22:00:00Z"
CHART_CONTRACTS = {
    "battery_storage_cohorts.csv": ["Jahr", "Anzahl_Index", "Energie_Index", "Anzahl", "Leistung_GW", "Energie_GWh"],
    "battery_storage_segments.csv": ["Jahr", "Klein_GWh", "Mittel_GWh", "Gross_GWh"],
    "battery_storage_duration.csv": ["Jahr", "Median_Stunden"],
    "battery_storage_daily_profile.csv": ["Stunde", "Preis_EUR_MWh", "Solar_GW"],
}
MEASURES = ["plant_count", "unit_count", "power_gw", "energy_gwh", "median_duration_hours", "network_verified_plant_count"]


class ValidationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def normalized(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, float):
        require(math.isfinite(value), "Nonfinite output value")
        return round(value, 9)
    if isinstance(value, dict):
        return {key: normalized(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalized(item) for item in value]
    return value


def json_bytes(value):
    return canonical(normalized(value)) + b"\n"


def csv_bytes(headers, rows):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(headers)
    for row in rows:
        values = normalized(row)
        writer.writerow([format(v, ".9f").rstrip("0").rstrip(".") if isinstance(v, float) else v for v in values])
    return stream.getvalue().encode("utf-8")


def query(db, sql, parameters=None):
    result = db.execute(sql, parameters or [])
    columns = [column[0] for column in result.description]
    return [dict(zip(columns, row)) for row in result.fetchall()]


def relation(name):
    require(bool(re.fullmatch(r"[a-z_]+", name)), "Invalid model name")
    schema = "prod_cleaned" if name.startswith("mastr_") else "prod_curated"
    return f"{schema}.{name}"


def model(suffix):
    return relation("fact_battery_storage_germany_" + suffix)


def provenance(db):
    rows = query(db, "SELECT snapshot_date, source_url, archive_sha256, filename FROM staging.mastr_snapshot")
    require(len(rows) == 1, "Source metadata must have exactly one row")
    row = rows[0]
    try:
        snapshot = date.fromisoformat(str(row["snapshot_date"]))
    except (TypeError, ValueError) as exc:
        raise ValidationError("Invalid source snapshot date") from exc
    require(snapshot > date(2025, 12, 31), "Completed 2024/2025 cohorts require a later snapshot")
    require(bool(re.fullmatch(r"[0-9a-fA-F]{64}", row["archive_sha256"] or "")), "Invalid archive hash")
    stamp = snapshot.strftime("%Y%m%d")
    require(bool(re.fullmatch(r"https://download\.marktstammdatenregister\.de/Gesamtdatenexport_" + stamp + r"_[\w.-]+\.zip", row["source_url"] or "")), "Source URL/date mismatch")
    require(bool(re.fullmatch(r"Gesamtdatenexport_" + stamp + r"_[\w.-]+\.zip", row["filename"] or "")), "Source filename/date mismatch")
    cleaned = query(db, f"SELECT * FROM {relation('mastr_battery_snapshot')}")
    expected = dict(row)
    expected["source_filename"] = expected.pop("filename")
    require(cleaned == [expected], "Cleaned/source metadata mismatch")
    return expected


def render_sql(path, snapshot, stack=()):
    """Render executable contracts; expand supported ephemeral refs from source.

    Never read a materialized freshness table: that would cache the very check
    intended to catch stale cleaned data. Unknown Jinja/config fails closed.
    """
    require(path not in stack, "Cyclic ephemeral model reference")
    environment = Environment(undefined=StrictUndefined)
    configurations = []

    def compiler_error(message):
        raise ValidationError(message)

    def config(**kwargs):
        require(kwargs == {"materialized": "ephemeral"}, "Unsupported battery SQL config")
        configurations.append(kwargs)
        return ""

    def ref(name):
        if name in EPHEMERAL_MODELS:
            return "(" + render_sql(DBT / EPHEMERAL_MODELS[name], snapshot, (*stack, path)) + ")"
        return relation(name)

    sql = environment.from_string(path.read_text()).render(
        ref=ref,
        source=lambda schema, table: f"{schema}.{table}",
        var=lambda name: {"battery_snapshot_date": str(snapshot)}[name],
        modules=SimpleNamespace(re=re),
        exceptions=SimpleNamespace(raise_compiler_error=compiler_error),
        execute=True,
        config=config,
    )
    if path in {DBT / relative for relative in EPHEMERAL_MODELS.values()}:
        require(configurations == [{"materialized": "ephemeral"}], "Freshness model must remain explicitly ephemeral")
    else:
        require(not configurations, "Unexpected singular test config")
    require(bool(sql.strip()), "Empty battery SQL contract")
    return sql


def run_singular_tests(db, snapshot):
    paths = sorted((DBT / "tests").glob("battery_*.sql"))
    require(REQUIRED_SINGULAR_TESTS <= {path.name for path in paths}, "Missing battery singular SQL tests")
    hashes = {}
    for path in paths:
        content = path.read_bytes()
        sql = render_sql(path, snapshot)
        # Query the actual dbt contracts without dbt's writable result tables.
        require(db.execute(sql).fetchone() is None, f"Battery singular test failed: {path.name}")
        hashes[path.name] = sha256(content)
    # Explicitly select is_fresh so the optimizer cannot prune its ERROR guard.
    # This ephemeral SQL also runs when no current singular test refs it directly.
    for relative in EPHEMERAL_MODELS.values():
        sql = render_sql(DBT / relative, snapshot)
        try:
            result = db.execute(f"SELECT is_fresh FROM ({sql}) AS freshness").fetchall()
        except duckdb.Error as exc:
            raise ValidationError("Battery ephemeral freshness check failed") from exc
        require(result == [(True,)], "Battery ephemeral freshness must return exactly one true row")
    return hashes


def validate_aggregates(rows, dimensions, snapshot):
    require(bool(rows), "Empty aggregate output")
    seen = set()
    groups = defaultdict(dict)
    for row in rows:
        require(row["snapshot_date"] == snapshot, "Aggregate snapshot mismatch")
        key = tuple(row[d] for d in dimensions)
        segment = row["size_segment"]
        require(segment in (*SEGMENTS, "overall"), "Unknown size segment")
        require((*key, segment) not in seen, "Duplicate aggregate row")
        seen.add((*key, segment))
        require(all(value is not None for value in key), "Null aggregate dimension")
        for field in MEASURES:
            value = row[field]
            require(type(value) in (int, float) and math.isfinite(value), f"Invalid aggregate {field}")
            require(value >= 0, f"Negative aggregate {field}")
        require(row["plant_count"] > 0 and row["unit_count"] >= row["plant_count"], "Invalid aggregate counts")
        require(row["network_verified_plant_count"] <= row["plant_count"], "Invalid verified count")
        require(row["power_gw"] > 0 and row["energy_gwh"] > 0, "Empty aggregate capacity")
        require(0.1 <= row["median_duration_hours"] <= 12, "Invalid duration")
        for field in ("plant_count", "unit_count", "network_verified_plant_count"):
            require(int(row[field]) == row[field], "Noninteger count")
        groups[key][segment] = row
    for group in groups.values():
        require("overall" in group and len(group) > 1, "Missing overall or segment")
        for field in ("plant_count", "unit_count", "power_gw", "energy_gwh", "network_verified_plant_count"):
            total = math.fsum(row[field] for segment, row in group.items() if segment != "overall")
            require(math.isclose(total, group["overall"][field], rel_tol=0, abs_tol=1e-8), f"Segment reconciliation failed: {field}")


def read_aggregates(db, snapshot):
    outputs = {}
    for suffix, dimensions in [("yearly", ["commissioning_year"]), ("monthly", ["commissioning_month"]), ("by_state", ["state"]), ("summary", ["operating_status"])]:
        columns = ["snapshot_date", *dimensions, "size_segment", *MEASURES]
        where = " WHERE operating_status = 'operating'" if suffix == "summary" else ""
        rows = query(db, f"SELECT {', '.join(columns)} FROM {model(suffix)}{where} ORDER BY {', '.join(dimensions)}, size_segment")
        validate_aggregates(rows, dimensions, snapshot)
        outputs[suffix] = (columns, rows)
    overall = next(row for row in outputs["summary"][1] if row["size_segment"] == "overall")
    for suffix in ("yearly", "monthly", "by_state"):
        for field in ("plant_count", "unit_count", "power_gw", "energy_gwh", "network_verified_plant_count"):
            total = math.fsum(row[field] for row in outputs[suffix][1] if row["size_segment"] == "overall")
            require(math.isclose(total, overall[field], rel_tol=0, abs_tol=1e-8), f"Stock reconciliation failed: {suffix}/{field}")
    for row in outputs["yearly"][1]:
        require(1990 <= row["commissioning_year"] <= snapshot.year, "Invalid commissioning year")
    for row in outputs["monthly"][1]:
        month = row["commissioning_month"]
        require(month.day == 1 and date(1990, 1, 1) <= month <= snapshot, "Invalid commissioning month")
    # Check each year's months, not only the grand total (swapped cohorts matter).
    monthly = defaultdict(list)
    for row in outputs["monthly"][1]:
        monthly[(row["commissioning_month"].year, row["size_segment"])].append(row)
    yearly_keys = {(r["commissioning_year"], r["size_segment"]) for r in outputs["yearly"][1]}
    require(set(monthly) == yearly_keys, "Year/month cohort mismatch")
    for row in outputs["yearly"][1]:
        for field in ("plant_count", "unit_count", "power_gw", "energy_gwh"):
            total = math.fsum(r[field] for r in monthly[(row["commissioning_year"], row["size_segment"])])
            require(math.isclose(total, row[field], rel_tol=0, abs_tol=1e-8), f"Year/month reconciliation failed: {field}")
    return outputs


def daily_profile(path):
    raw = path.read_bytes()
    data = json.loads(raw)
    require(data.get("schema_version") == 1, "Electricity schema version mismatch")
    require(data.get("timezone") == "Europe/Berlin", "Electricity timezone mismatch")
    require(data.get("units") == {"power": "GW", "price": "EUR/MWh"}, "Electricity units mismatch")
    require(data.get("window_start") == START and data.get("window_end") == END, "Electricity frozen window mismatch")
    require(data.get("data_through") == END, "Electricity incomplete coverage metadata")
    source = data.get("source", {})
    require(source.get("name") == "Bundesnetzagentur | SMARD.de" and source.get("url") == "https://www.smard.de/home/marktdaten" and source.get("license") == "CC BY 4.0", "Electricity source metadata mismatch")
    created = data.get("snapshot_created_at", "")
    require(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", created)), "Electricity snapshot timestamp must be UTC")
    require(datetime.fromisoformat(created.replace("Z", "+00:00")) >= datetime.fromisoformat(END.replace("Z", "+00:00")), "Electricity snapshot predates coverage")
    semantic = {key: value for key, value in data.items() if key not in ("content_hash", "snapshot_created_at")}
    require(data.get("content_hash") == sha256(canonical(semantic)), "Electricity content hash mismatch")
    columns = data.get("columns", [])
    require(len(columns) == len(set(columns)) and all(c in columns for c in ("timestamp", "solar", "price")), "Electricity columns missing/duplicate")
    rows = data.get("rows", [])
    require(len(rows) == 720, "Electricity requires 720 complete hourly observations")
    start_ms = int(datetime.fromisoformat(START.replace("Z", "+00:00")).timestamp() * 1000)
    buckets = defaultdict(list)
    for index, row in enumerate(rows):
        require(len(row) == len(columns), "Electricity row width mismatch")
        timestamp = row[columns.index("timestamp")]
        require(type(timestamp) is int and timestamp == start_ms + index * 3_600_000, "Electricity timestamps must be unique contiguous UTC hours")
        for column, value in zip(columns, row):
            require(type(value) in (int, float) and math.isfinite(value), f"Nonfinite/missing electricity {column}")
            if column not in ("timestamp", "price"):
                require(0 <= value <= 200, f"Invalid electricity GW: {column}")
        price, solar = row[columns.index("price")], row[columns.index("solar")]
        require(-10000 <= price <= 10000, "Electricity price out of bounds")
        local = datetime.fromtimestamp(timestamp / 1000, timezone.utc).astimezone(BERLIN)
        require(date(2026, 8, 11) <= local.date() <= date(2026, 9, 9) and local.minute == 0, "Electricity Berlin day/hour mismatch")
        buckets[local.hour].append((price, solar))
    require(set(buckets) == set(range(24)) and all(len(v) == 30 for v in buckets.values()), "Electricity requires 30 observations per Berlin hour")
    profile = [[f"{hour:02d}:00", math.fsum(v[0] for v in buckets[hour]) / 30, math.fsum(v[1] for v in buckets[hour]) / 30] for hour in range(24)]
    metadata = {
        "input_filename": path.name, "input_sha256": sha256(raw), "input_content_hash": data["content_hash"],
        "snapshot_created_at": created, "source": source, "window_start_utc": START, "window_end_utc_exclusive": END,
        "first_local_date": "2026-08-11", "last_local_date": "2026-09-09", "timezone": "Europe/Berlin",
        "timestamp_encoding": "UTC Unix milliseconds, interval start", "input_grain_minutes": 60,
        "input_rows": 720, "local_days": 30, "observations_per_hour": 30,
        "aggregation": "Arithmetic mean by Europe/Berlin hour across 30 complete days; not battery dispatch or storage revenue.",
        "units": data["units"],
    }
    return profile, metadata


def quality_report(db, snapshot, stock):
    # Limit the audit to relations touching selected active German operating
    # battery units. The full-source audit also contains non-battery storage.
    measures = """COUNT(*) AS relation_count,
        COUNT(DISTINCT spe_mastr_nummer) AS identified_plant_count,
        SUM(selected_operating_unit_count)::BIGINT AS selected_operating_unit_count,
        COUNT(*) FILTER (WHERE NOT COALESCE(all_active_german_battery AND operating_status = 'operating', FALSE)) AS mixed_selection_relation_count,
        SUM(power_kw) FILTER (WHERE ISFINITE(power_kw) AND power_kw > 0) / 1e6 AS known_power_gw,
        SUM(energy_kwh) FILTER (WHERE ISFINITE(energy_kwh) AND energy_kwh > 0) / 1e6 AS known_energy_gwh,
        COUNT(*) FILTER (WHERE power_kw IS NULL OR NOT ISFINITE(power_kw)) AS unknown_or_nonfinite_power_count,
        COUNT(*) FILTER (WHERE energy_kwh IS NULL OR NOT ISFINITE(energy_kwh)) AS unknown_or_nonfinite_energy_count"""
    scope = f"FROM {model('plants')} WHERE selected_operating_unit_count > 0"
    before = query(db, f"SELECT {measures} {scope}")[0]
    after = query(db, f"SELECT {measures} {scope} AND is_included")[0]
    excluded = query(db, f"SELECT {measures} {scope} AND NOT is_included")[0]
    require(after["relation_count"] == stock["plant_count"], "Selected quality count does not match operating stock")
    for field in ("known_power_gw", "known_energy_gwh"):
        require(math.isclose(after[field], stock[field.removeprefix('known_')], rel_tol=0, abs_tol=1e-8), "Selected quality capacity does not match stock")
    require(before["relation_count"] == after["relation_count"] + excluded["relation_count"], "Selected quality reconciliation failed")
    reasons = query(db, f"""SELECT reason, COUNT(*) AS relation_count,
        SUM(selected_operating_unit_count)::BIGINT AS selected_operating_unit_count
        FROM (SELECT selected_operating_unit_count, UNNEST(quality_reasons) AS reason {scope} AND NOT is_included)
        GROUP BY reason ORDER BY reason""")
    return {
        "snapshot_date": snapshot, "scope": "Relations with selected_operating_unit_count > 0 (active German operating battery units)",
        "before_quality_filters": before, "included_after_quality_filters": after, "excluded_by_quality_filters": excluded,
        "exclusion_reasons_overlap": True, "exclusion_reasons": reasons,
        "capacity_caveat": "Known finite positive relation-level capacity only, not an estimate for unknown or duplicate values. Mixed-selection relations are counted explicitly. Reasons overlap; do not sum them. No all-source exclusion totals.",
    }


def build_payloads(db, electricity):
    source = provenance(db)
    snapshot = source["snapshot_date"]
    tests = run_singular_tests(db, snapshot)
    aggregates = read_aggregates(db, snapshot)
    profile, electricity_metadata = daily_profile(electricity)
    files, contracts = {}, {}

    def add_csv(name, headers, rows):
        require(bool(rows), f"Empty export: {name}")
        files[name] = csv_bytes(headers, rows)
        contracts[name] = {"columns": headers, "rows": len(rows)}

    # Full compact cohort tables retain partial years/months with explicit labels.
    for suffix, (headers, records) in aggregates.items():
        dimensions = {"yearly": "commissioning_year", "monthly": "commissioning_month"}
        extra = ["period_complete"] if suffix in dimensions else []
        rows = []
        for record in records:
            row = [record[h] for h in headers]
            if suffix == "yearly":
                row.append(str(record["commissioning_year"] < snapshot.year).lower())
            elif suffix == "monthly":
                month = record["commissioning_month"]
                next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
                row.append(str(next_month <= snapshot).lower())
            rows.append(row)
        add_csv(f"battery_storage_{suffix}.csv", headers + extra, rows)

    yearly = {(r["commissioning_year"], r["size_segment"]): r for r in aggregates["yearly"][1]}
    require(all((year, segment) in yearly for year in YEARS for segment in (*SEGMENTS, "overall")), "Missing completed 2019–2025 cohort/segment")
    base = yearly[(2024, "overall")]
    cohorts, segments, durations = [], [], []
    for year in YEARS:
        row = yearly[(year, "overall")]
        cohorts.append([year, row["plant_count"] / base["plant_count"] * 100, row["energy_gwh"] / base["energy_gwh"] * 100, row["plant_count"], row["power_gw"], row["energy_gwh"]])
        segments.append([year, *[yearly[(year, segment)]["energy_gwh"] for segment in SEGMENTS]])
        durations.append([year, row["median_duration_hours"]])
    for name, rows in zip(CHART_CONTRACTS, [cohorts, segments, durations, profile]):
        add_csv(name, CHART_CONTRACTS[name], rows)

    distribution = query(db, f"""SELECT commissioning_year AS Jahr,
        CASE WHEN GROUPING(size_segment) = 1 THEN 'overall' ELSE size_segment END AS Segment,
        COUNT(*) AS Anzahl, QUANTILE_CONT(duration_hours, 0.1) AS P10_Stunden,
        QUANTILE_CONT(duration_hours, 0.25) AS P25_Stunden, MEDIAN(duration_hours) AS Median_Stunden,
        QUANTILE_CONT(duration_hours, 0.75) AS P75_Stunden, QUANTILE_CONT(duration_hours, 0.9) AS P90_Stunden
        FROM {model('plants')} WHERE is_included AND commissioning_year BETWEEN 2019 AND 2025
        GROUP BY GROUPING SETS ((commissioning_year, size_segment), (commissioning_year)) ORDER BY Jahr, Segment""")
    require(len(distribution) == 28, "Duration distribution coverage mismatch")
    for row in distribution:
        expected = yearly[(row["Jahr"], row["Segment"])]
        require(row["Anzahl"] == expected["plant_count"] and math.isclose(row["Median_Stunden"], expected["median_duration_hours"], abs_tol=1e-9), "Duration distribution reconciliation failed")
        values = [row[k] for k in ("P10_Stunden", "P25_Stunden", "Median_Stunden", "P75_Stunden", "P90_Stunden")]
        require(all(math.isfinite(v) and 0.1 <= v <= 12 for v in values) and values == sorted(values), "Invalid duration quantiles")
    add_csv("battery_storage_duration_distribution.csv", list(distribution[0]), [list(r.values()) for r in distribution])

    stock = next(row for row in aggregates["summary"][1] if row["size_segment"] == "overall")
    files["battery_storage_quality.json"] = json_bytes(quality_report(db, snapshot, stock))
    model_hashes = {}
    for path in sorted((DBT / "models").rglob("*.sql")):
        if path.parent.name == "mastr" or path.name.startswith("fact_battery_storage_germany_"):
            model_hashes[str(path.relative_to(DBT))] = sha256(path.read_bytes())
    metadata = {
        "schema_version": 1, "methodology_version": VERSION, "kind": "frozen_battery_article",
        "mastr": source, "electricity_profile": electricity_metadata,
        "methodology": {
            "cohorts": "Current capacity of plants still operating at snapshot, attributed to earliest unit commissioning date; not historic stock or gross additions. Later expansions and retired plants cannot be reconstructed.",
            "selection": "Active German operating batteries; unique valid linked SSE plants/SEE units; complete valid dates since 1990 through snapshot; finite power >0.3 kW and usable energy >0.3 kWh; energy/power 0.1–12 hours; no conflicting states/status. Planned plants excluded.",
            "segments": {"small": "power <30 kW AND energy <30 kWh", "large": "power >=1000 kW OR energy >=1000 kWh", "medium": "remaining included plants"},
            "duration": "Unweighted plant-level usable kWh / net nominal kW. Median and continuous P10/P25/P75/P90; not ratio of aggregate energy to power.",
            "index_base_year": 2024, "chart_years": YEARS,
            "partial_periods": "Charts use completed calendar years 2019–2025 only. Full cohort tables mark snapshot-year/month as period_complete=false; not annualized. Complete means calendar period, not registration completeness.",
            "rounding": "Nine decimal places, trailing CSV zeros removed; reconcile with 1e-8 GW/GWh tolerance.",
        },
        "operating_stock": stock,
        "validation": {"singular_tests_sha256": tests, "ephemeral_checks": sorted(EPHEMERAL_MODELS), "jinja_execute": True, "model_sql_sha256": model_hashes, "exporter_sha256": sha256(Path(__file__).read_bytes()), "duckdb_version": duckdb.__version__, "connection": "read_only", "threads": 1},
        "publication": "All files staged and validated first; individual file replacements, manifest last. Readers must verify every hash before accepting a set. Directory replacement is not atomic.",
        "files": {name: {"sha256": sha256(content), "bytes": len(content), **contracts.get(name, {})} for name, content in sorted(files.items())},
    }
    files[MANIFEST] = json_bytes(metadata)
    return files


def verify_set(directory):
    """Reject incomplete/mixed sets. Unrelated frozen datasets are ignored."""
    metadata = json.loads((directory / MANIFEST).read_bytes())
    expected = set(CHART_CONTRACTS) | {f"battery_storage_{suffix}.csv" for suffix in ("yearly", "monthly", "by_state", "summary", "duration_distribution")} | {"battery_storage_quality.json"}
    require(set(metadata["files"]) == expected, "Manifest file allowlist mismatch")
    for name, contract in metadata["files"].items():
        raw = (directory / name).read_bytes()
        require(len(raw) == contract["bytes"] and sha256(raw) == contract["sha256"], f"File hash mismatch: {name}")
        if name.endswith(".csv"):
            rows = list(csv.reader(io.StringIO(raw.decode("utf-8"))))
            require(rows[0] == contract["columns"] and len(rows) - 1 == contract["rows"] and len(rows) > 1, f"CSV contract mismatch: {name}")
            require(all(len(row) == len(rows[0]) for row in rows[1:]), f"CSV width mismatch: {name}")
    return metadata


def promote(files, output):
    # Validation errors above this point have not created/touched output files.
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".battery-stage-", dir=output.parent) as temporary:
        stage = Path(temporary)
        for name, content in files.items():
            (stage / name).write_bytes(content)
        verify_set(stage)
        output.mkdir(exist_ok=True)
        names = sorted(name for name in files if name != MANIFEST) + [MANIFEST]
        previous = {name: (output / name).read_bytes() if (output / name).exists() else None for name in names}
        replaced = []
        try:
            for name in names:
                os.replace(stage / name, output / name)
                replaced.append(name)
        except OSError:
            # Best-effort rollback for ordinary I/O errors. A process/power loss
            # can leave a mixed set, which the old manifest's hashes reject.
            for name in reversed(replaced):
                if previous[name] is None:
                    (output / name).unlink()
                else:
                    (stage / name).write_bytes(previous[name])
                    os.replace(stage / name, output / name)
            raise


def export(database=DEFAULT_DATABASE, output_dir=DEFAULT_OUTPUT, electricity=DEFAULT_ELECTRICITY):
    with duckdb.connect(str(database), read_only=True, config={"threads": 1}) as db:
        files = build_payloads(db, Path(electricity))
    promote(files, Path(output_dir))
    return json.loads(files[MANIFEST])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT, help="Explicitly set frontend/src/data_ingestion/data to publish the frozen article files")
    parser.add_argument("--electricity-snapshot", "--electricity-input", dest="electricity_snapshot", type=Path, default=DEFAULT_ELECTRICITY, help="Original frozen hourly JSON; must cover Berlin Aug 11–Sep 9, 2026 (legacy alias: --electricity-input)")
    args = parser.parse_args()
    metadata = export(args.database, args.output_dir, args.electricity_snapshot)
    print(f"Validated {len(metadata['files'])} data files + {MANIFEST}; MaStR {metadata['mastr']['snapshot_date']}; output {args.output_dir}")


if __name__ == "__main__":
    main()
