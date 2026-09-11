"""Bounded manual/monthly SMARD compact snapshot; see docs/electricity_progress.md.

Run from pipeline/: python -m src.data_pipelines.dashboards.german_electricity.progress refresh
"""

import argparse
import copy
import csv
from datetime import date, datetime
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import time

from .history import atomic_write, read_bounded, strict_json, writer_lock
from .pipeline import BERLIN, DEFAULT_OUTPUT, SOURCE, SmardClient, ValidationError, canonical_bytes, number


OUTPUT = DEFAULT_OUTPUT.with_name("germanElectricityProgress.json")
CSV_URL = "https://www.smard.de/resource/blob/217306/-/data-csv-data.csv"
LICENSE_EVIDENCE = "https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf"
CAPACITY_URL = "https://www.smard.de/page/home/topic-article/211972/212382/entwicklung-der-nettonennleistung"
EEG_URL = "https://www.gesetze-im-internet.de/eeg_2014/__4.html"
WINDSEE_URL = "https://www.gesetze-im-internet.de/windseeg/__1.html"
EXPORT_LIMIT = 150_000
CSV_LIMIT = 2_000_000
GROUP_COUNT = 132  # Pinned compact format; changes require manual metadata verification.
CAPACITY_GROUP = "s-ent_nettonl-1-1"
ANNUAL_GROUP = "s-nepm_entw-2-2"
MONTHLY_GROUP = "s-nepm_nepm-2-2x"
REDISPATCH_GROUP = "s-nepm_re_mk-2-2x"
GROUPS = {CAPACITY_GROUP: 18, ANNUAL_GROUP: 2, MONTHLY_GROUP: 2, REDISPATCH_GROUP: 2}
# Zero-based VALUE columns, independently checked against the compact chart's .set_locale.
CAPACITY_SERIES = (
    "Sonstige Energieträger", "Mineralölprodukte", "Wärme", "Grubengas", "Geothermie",
    "Batteriespeicher", "Abfall", "Pumpspeicher", "Erdgas", "Steinkohle", "Braunkohle",
    "Kernenergie", "Photovoltaik", "Wind Onshore", "Wind Offshore", "Wasser", "Biomasse", "Wasserstoff",
)
CAPACITY_COLUMNS = {"solar_gw": 12, "wind_onshore_gw": 13, "wind_offshore_gw": 14,
                    "battery_gw": 5, "pumped_storage_gw": 7}
CAPACITY_LAST_YEAR = 2025  # Never relabel the provisional 2026 observation as a year end.
CAPACITY_SCOPE = (
    "Gemeldete Kraftwerksliste: Nettonennleistung am und außerhalb des Strommarktes; "
    "kann ausländische, in das deutsche Netz einspeisende Kraftwerke umfassen. "
    "Kleinspeicher unter 13,2 kW sind ausgeschlossen; kein Gesamtbestand deutscher "
    "Batteriespeicher. Speicherleistung, keine Speicherkapazität in GWh."
)
UNITS = {"energy": "GWh", "cost": "million EUR"}
TARGET_YEARS = (2024, 2026, 2028, 2030, 2035, 2040)
TARGETS = {
    "verified_on": "2026-09-10", "unit": "GW", "kind": "statutory_baseline",
    "solar": {"source_url": EEG_URL, "comparison": "target", "maintain_after_year": 2040,
              "rows": [{"year": y, "capacity_gw": n} for y, n in zip(TARGET_YEARS, (88, 128, 172, 215, 309, 400))]},
    "wind_onshore": {"source_url": EEG_URL, "comparison": "target", "maintain_after_year": 2040,
                     "rows": [{"year": y, "capacity_gw": n} for y, n in zip(TARGET_YEARS, (69, 84, 99, 115, 157, 160))]},
    "wind_offshore": {"source_url": WINDSEE_URL, "comparison": "at_least", "maintain_after_year": None,
                      "rows": [{"year": y, "capacity_gw": n} for y, n in ((2030, 30), (2035, 40), (2045, 70))]},
}
DECIMAL = re.compile(r"[0-9]+(?:\.[0-9]+)?")


class ProgressClient(SmardClient):
    # Reuse the bounded transport; this endpoint is raw CSV, not JSON. The server
    # serves its CSV despite the shared client's application/json Accept header.
    JSON_DECODER = staticmethod(bytes)
    MAX_ATTEMPTS = 3
    MAX_RESPONSE_BYTES = CSV_LIMIT
    MAX_TOTAL_BYTES = CSV_LIMIT
    FETCH_TIMEOUT = 15


def month_index(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}", value):
        raise ValidationError("Expected canonical YYYY-MM month")
    try:
        day = date.fromisoformat(value + "-01")
    except ValueError as exc:
        raise ValidationError("Invalid calendar month") from exc
    return day.year * 12 + day.month - 1


def parse_csv(raw, as_of):
    """Check every required-group row, including observations excluded from output."""
    if not isinstance(raw, bytes) or not 0 < len(raw) <= CSV_LIMIT:
        raise ValidationError("Compact CSV empty or exceeds byte budget")
    groups, seen = {key: [] for key in GROUPS}, set()
    try:
        reader = csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline=""), delimiter=";", strict=True)
        for row in reader:
            if not row or not any(row):
                continue
            seen.add(row[0])
            if row[0] not in groups:
                continue  # Unrelated groups have their own headers, footers and units.
            group = row[0]
            if len(row) != GROUPS[group] + 2:
                raise ValidationError(f"{group}: wrong column count")
            if group in (CAPACITY_GROUP, ANNUAL_GROUP):
                if not re.fullmatch(r"[0-9]{4}", row[1]):
                    raise ValidationError(f"{group}: invalid year")
                period = int(row[1])
                start = 2011 if group == CAPACITY_GROUP else 2015
                if not start <= period <= min(as_of.year, 2100):
                    raise ValidationError(f"{group}: year outside source window")
            else:
                if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-01", row[1]):
                    raise ValidationError(f"{group}: expected month-start date")
                period = month_index(row[1][:7])
                start = month_index("2022-07")
                if not start <= period <= month_index(as_of.strftime("%Y-%m")):
                    raise ValidationError(f"{group}: month outside source window")
            expected = groups[group][-1][0] + 1 if groups[group] else start
            if period != expected:
                raise ValidationError(f"{group}: missing, duplicate or unordered period")
            values = []
            for token in row[2:]:
                if not DECIMAL.fullmatch(token):
                    raise ValidationError(f"{group}/{row[1]}: missing or invalid numeric value")
                value = float(token)
                # MW capacity <= 1,000 GW/category; annual/monthly GWh and million EUR
                # use the same deliberately broad 1,000,000 corruption ceiling.
                number(value, group, power_scale=5000)
                values.append(value)
            groups[group].append((period, row[1], values))
            if len(groups[group]) > (100 if group in (CAPACITY_GROUP, ANNUAL_GROUP) else 600):
                raise ValidationError(f"{group}: row budget exhausted")
    except (UnicodeError, csv.Error) as exc:
        raise ValidationError(f"Malformed compact CSV: {exc}") from exc
    if len(seen) != GROUP_COUNT or any(not rows for rows in groups.values()):
        raise ValidationError("Compact group count changed or required group missing; verify source configuration")
    if [p for p, _, _ in groups[MONTHLY_GROUP]] != [p for p, _, _ in groups[REDISPATCH_GROUP]]:
        raise ValidationError("Monthly congestion and redispatch periods differ")
    return groups


def digest(value):
    return hashlib.sha256(canonical_bytes({k: v for k, v in value.items() if k != "content_hash"})).hexdigest()


def snapshot(raw, as_of):
    groups = parse_csv(raw, as_of)
    capacity = [{"year": year, **{key: round(values[column] / 1000, 8)
                                  for key, column in CAPACITY_COLUMNS.items()}}
                for year, _, values in groups[CAPACITY_GROUP]
                if year <= CAPACITY_LAST_YEAR and year < as_of.year]
    annual = [{"year": year, "energy_gwh": values[0], "cost_million_eur": values[1]}
              for year, _, values in groups[ANNUAL_GROUP] if year < as_of.year]
    monthly = [{"month": label[:7], "energy_gwh": values[0], "cost_million_eur": values[1],
                "redispatch_energy_gwh": rd[0], "redispatch_cost_million_eur": rd[1]}
               for (period, label, values), (_, _, rd)
               in zip(groups[MONTHLY_GROUP], groups[REDISPATCH_GROUP])
               if period < month_index(as_of.strftime("%Y-%m"))]
    if not capacity or not annual or not monthly:
        raise ValidationError("Required completed observations missing")
    value = {
        "schema_version": 1, "kind": "german-electricity-progress", "source": SOURCE,
        "source_csv": CSV_URL, "license_evidence": LICENSE_EVIDENCE,
        "capacity": {"reference": "year_end", "unit": "GW", "scope": CAPACITY_SCOPE,
                     "source_url": CAPACITY_URL, "provisional": True,
                     "data_through": f"{capacity[-1]['year']}-12-31", "rows": capacity},
        "targets": copy.deepcopy(TARGETS),
        "congestion": {"units": dict(UNITS), "annual": annual, "monthly": monthly,
                       "annual_through": f"{annual[-1]['year']}-12-31",
                       "monthly_through": monthly[-1]["month"]},
    }
    value["content_hash"] = digest(value)
    validate_snapshot(value, as_of)
    return value


def fields(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValidationError(f"Invalid {label} fields")


def validate_rows(rows, key, columns, start, minimum_end, maximum_end, limit, scale):
    if not isinstance(rows, list) or not 1 <= len(rows) <= limit:
        raise ValidationError(f"Invalid {key} row count")
    for index, row in enumerate(rows):
        fields(row, (key, *columns), key)
        if key == "year":
            if type(row[key]) is not int:
                raise ValidationError("Expected integer year")
            period = row[key]
        else:
            period = month_index(row[key])
        if period != start + index or period > maximum_end:
            raise ValidationError(f"Missing, duplicate, unordered or incomplete {key}")
        for column in columns:
            number(row[column], column, power_scale=scale)
    if period < minimum_end:
        raise ValidationError(f"Truncated {key} baseline coverage")


def validate_snapshot(value, as_of=None):
    as_of = as_of or datetime.now(BERLIN).date()
    fields(value, ("schema_version", "kind", "source", "source_csv", "license_evidence",
                   "capacity", "targets", "congestion", "content_hash"), "progress snapshot")
    if (type(value["schema_version"]) is not int or value["schema_version"] != 1
            or value["kind"] != "german-electricity-progress" or value["source"] != SOURCE
            or value["source_csv"] != CSV_URL or value["license_evidence"] != LICENSE_EVIDENCE
            or canonical_bytes(value["targets"]) != canonical_bytes(TARGETS)):
        raise ValidationError("Invalid progress metadata/statutory baseline")
    capacity = value["capacity"]
    fields(capacity, ("reference", "unit", "scope", "source_url", "provisional", "data_through", "rows"), "capacity")
    if (capacity["reference"] != "year_end" or capacity["unit"] != "GW"
            or capacity["scope"] != CAPACITY_SCOPE or capacity["source_url"] != CAPACITY_URL
            or capacity["provisional"] is not True):
        raise ValidationError("Invalid capacity metadata")
    validate_rows(capacity["rows"], "year", CAPACITY_COLUMNS, 2011, CAPACITY_LAST_YEAR,
                  min(CAPACITY_LAST_YEAR, as_of.year - 1), 15, 5)
    if capacity["data_through"] != f"{capacity['rows'][-1]['year']}-12-31":
        raise ValidationError("Invalid capacity data_through")
    congestion = value["congestion"]
    fields(congestion, ("units", "annual", "monthly", "annual_through", "monthly_through"), "congestion")
    if congestion["units"] != UNITS:
        raise ValidationError("Invalid congestion units")
    validate_rows(congestion["annual"], "year", ("energy_gwh", "cost_million_eur"),
                  2015, 2025, min(as_of.year - 1, 2100), 100, 5000)
    validate_rows(congestion["monthly"], "month", ("energy_gwh", "cost_million_eur",
                  "redispatch_energy_gwh", "redispatch_cost_million_eur"), month_index("2022-07"),
                  month_index("2026-05"), month_index(as_of.strftime("%Y-%m")) - 1, 600, 5000)
    if (congestion["annual_through"] != f"{congestion['annual'][-1]['year']}-12-31"
            or congestion["monthly_through"] != congestion["monthly"][-1]["month"]):
        raise ValidationError("Invalid congestion coverage metadata")
    if value["content_hash"] != digest(value):
        raise ValidationError("Progress content hash mismatch")
    if len(canonical_bytes(value)) > EXPORT_LIMIT:
        raise ValidationError("Progress export exceeds byte budget")


def load_snapshot(path, as_of):
    if not path.exists() and not path.is_symlink():
        return None, None
    raw = read_bounded(path, EXPORT_LIMIT)
    value = strict_json(raw)
    validate_snapshot(value, as_of)
    if canonical_bytes(value) != raw:
        raise ValidationError("Noncanonical existing progress snapshot")
    return value, raw


def publish(value, output, expected_raw, as_of):
    validate_snapshot(value, as_of)
    previous, actual = load_snapshot(output, as_of)
    if actual != expected_raw:
        raise ValidationError("Stale progress writer; retry from fresh output")
    if previous and any(value["congestion"][key] < previous["congestion"][key]
                        for key in ("annual_through", "monthly_through")):
        raise ValidationError("Refusing regression of congestion coverage")
    raw = canonical_bytes(value)
    if actual == raw:
        return False
    atomic_write(output, raw)
    return True


def run(mode="refresh", output=OUTPUT, *, client=None, as_of=None):
    started = time.monotonic()
    as_of = as_of or datetime.now(BERLIN).date()
    client = client or ProgressClient()
    output = Path(output)
    metrics = {"mode": mode, "status": "failed"}
    try:
        if mode != "refresh":
            raise ValidationError("Progress only supports manual/monthly refresh")
        if not output.parent.is_dir():
            raise ValidationError("Output parent must exist")
        with writer_lock(output.parent):
            _, previous_raw = load_snapshot(output, as_of)
            value = snapshot(client.get(CSV_URL), as_of)
            changed = publish(value, output, previous_raw, as_of)
            metrics.update(status="changed" if changed else "unchanged",
                           capacity_through=value["capacity"]["data_through"],
                           annual_through=value["congestion"]["annual_through"],
                           monthly_through=value["congestion"]["monthly_through"],
                           export_bytes=len(canonical_bytes(value)), content_hash=value["content_hash"])
        return metrics
    finally:
        metrics.update(requests=client.requests, bytes_downloaded=client.bytes_downloaded,
                       total_seconds=round(time.monotonic() - started, 3))
        print(json.dumps(metrics, sort_keys=True), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="mode", required=True)
    command = commands.add_parser("refresh")
    command.add_argument("--output", type=Path, default=OUTPUT)
    try:
        run(**vars(parser.parse_args()))
    except (ValidationError, OSError) as exc:
        print(f"German electricity progress failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
