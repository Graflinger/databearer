"""Explicit frozen SMARD annual supplementation; see docs/electricity_annual.md.

Run from pipeline/: python -m src.data_pipelines.dashboards.german_electricity.annual backfill
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import hashlib
import json
import math
from pathlib import Path
import sys
import time

from .history import (
    DEFAULT_DIRECTORY, ENERGY, MANIFEST_LIMIT, atomic_write, load_history,
    read_bounded, strict_json, writer_lock,
)
from .pipeline import (
    BERLIN, DEFAULT_OUTPUT, HOUR_MS, SOURCE, SmardClient, ValidationError,
    canonical_bytes, midnight_ms, number,
)


YEARS = (2016, 2018)
SERIES = {key: series_id for key, series_id in ENERGY.items() if key != "load"}
OUTPUT = DEFAULT_OUTPUT.with_name("germanElectricityAnnual.json")
EXPORT_LIMIT = 10_000


class AnnualClient(SmardClient):
    JSON_DECODER = staticmethod(strict_json)
    MAX_ATTEMPTS = 48  # 12 indices + 24 chunks, including a bounded retry allowance.
    MAX_RESPONSE_BYTES = 16_000
    MAX_TOTAL_BYTES = 200_000
    FETCH_TIMEOUT = 60


def selected_years(years):
    if (not isinstance(years, (list, tuple)) or not years
            or any(type(year) is not int or year not in YEARS for year in years)
            or len(set(years)) != len(years)):
        raise ValidationError("Select unique annual supplementation years: 2016 and/or 2018")
    return sorted(years)


def year_hours(year):
    return (midnight_ms(date(year + 1, 1, 1)) - midnight_ms(date(year, 1, 1))) // HOUR_MS


def parse_index(payload, column):
    stamps = payload.get("timestamps") if isinstance(payload, dict) else None
    if (not isinstance(stamps, list) or not 1 <= len(stamps) <= 100
            or any(type(stamp) is not int for stamp in stamps)
            or len(set(stamps)) != len(stamps)):
        raise ValidationError(f"{column}: invalid annual index")
    for stamp in stamps:
        try:
            local = datetime.fromtimestamp(stamp / 1000, BERLIN)
            valid = stamp == midnight_ms(date(local.year, 1, 1))
        except (ValueError, OverflowError, OSError):
            valid = False
        if not valid:
            raise ValidationError(f"{column}: annual index must use Berlin January 1")
    return set(stamps)


def parse_chunk(payload, year, column):
    points = payload.get("series") if isinstance(payload, dict) else None
    # One annual observation, never a daily sum or a multi-year chunk.
    if not isinstance(points, list) or len(points) != 1:
        raise ValidationError(f"{column}/{year}: expected exactly one annual observation")
    point = points[0]
    if (not isinstance(point, list) or len(point) != 2 or type(point[0]) is not int
            or point[0] != midnight_ms(date(year, 1, 1))):
        raise ValidationError(f"{column}/{year}: invalid annual timestamp")
    number(point[1], column, power_scale=1000 * year_hours(year))
    return round(point[1] / 1000, 8)


def fetch_annual(client, years):
    """Twelve index requests once, then twelve year-resolution chunks per year."""
    if not years:
        return []
    years = selected_years(years)
    energy = {year: {} for year in years}
    base = "https://www.smard.de/app/chart_data"
    with ThreadPoolExecutor(max_workers=3) as pool:
        indices = pool.map(client.get, [f"{base}/{i}/DE/index_year.json" for i in SERIES.values()])
        jobs = []
        for (column, series_id), payload in zip(SERIES.items(), indices):
            stamps = parse_index(payload, column)
            for year in years:
                stamp = midnight_ms(date(year, 1, 1))
                if stamp not in stamps:
                    raise ValidationError(f"{column}/{year}: annual chunk absent from index")
                jobs.append((year, column, f"{base}/{series_id}/DE/{series_id}_DE_year_{stamp}.json"))
        for (year, column, _), payload in zip(jobs, pool.map(client.get, [job[2] for job in jobs])):
            energy[year][column] = parse_chunk(payload, year, column)
    return [{"year": year, "energy_gwh": energy[year], "method": "source_annual_aggregate"}
            for year in years]


def digest(value):
    return hashlib.sha256(canonical_bytes({k: v for k, v in value.items() if k != "content_hash"})).hexdigest()


def snapshot(rows):
    value = {"schema_version": 1, "kind": "german-electricity-annual", "source": SOURCE,
             "region": "DE", "timezone": "Europe/Berlin", "resolution": "year", "years": rows}
    value["content_hash"] = digest(value)
    validate_snapshot(value)
    return value


def validate_snapshot(value):
    if not isinstance(value, dict) or set(value) != {
        "schema_version", "kind", "source", "region", "timezone", "resolution", "years", "content_hash"
    }:
        raise ValidationError("Invalid annual snapshot fields")
    if (type(value["schema_version"]) is not int or value["schema_version"] != 1
            or value["kind"] != "german-electricity-annual" or value["source"] != SOURCE
            or value["region"] != "DE" or value["timezone"] != "Europe/Berlin"
            or value["resolution"] != "year"):
        raise ValidationError("Invalid annual snapshot metadata")
    rows = value["years"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= len(YEARS):
        raise ValidationError("Invalid annual year count")
    years = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"year", "energy_gwh", "method"}:
            raise ValidationError("Invalid annual row fields")
        year = row["year"]
        selected_years([year])
        years.append(year)
        energy = row["energy_gwh"]
        if (row["method"] != "source_annual_aggregate" or not isinstance(energy, dict)
                or set(energy) != set(SERIES)):
            raise ValidationError("Annual row requires all twelve source generation categories")
        for column, observation in energy.items():
            number(observation, column, power_scale=year_hours(year))
        # Broad corruption guard for national net public generation, not a target.
        if not 100_000 <= math.fsum(energy.values()) <= 200 * year_hours(year):
            raise ValidationError("Annual generation total outside broad sanity bounds")
    if years != selected_years(years):
        raise ValidationError("Annual years must be ascending")
    if value["content_hash"] != digest(value):
        raise ValidationError("Annual content hash mismatch")
    if len(canonical_bytes(value)) > EXPORT_LIMIT:
        raise ValidationError("Annual export exceeds byte budget")


def load_snapshot(path):
    if not path.exists() and not path.is_symlink():
        return None, None
    raw = read_bounded(path, EXPORT_LIMIT)
    value = strict_json(raw)
    validate_snapshot(value)
    if canonical_bytes(value) != raw:
        raise ValidationError("Noncanonical annual snapshot; refusing to rewrite frozen years")
    return value, raw


def compare_daily(rows, partitions, metrics):
    """Report all signed source-resolution differences; never allocate daily residuals."""
    report, below = [], []
    for row in rows:
        year = row["year"]
        partition = partitions.get(year)
        if partition is None or partition["rows"][-1]["date"] != f"{year}-12-31":
            raise ValidationError(f"{year}: require validated full-calendar daily history for comparison")
        daily = partition["rows"]
        for column in SERIES:
            known = [day["energy_gwh"][column] for day in daily if day["energy_gwh"][column] is not None]
            total = math.fsum(known)
            delta = row["energy_gwh"][column] - total
            # Each endpoint rounds MWh to two decimals; allow daily plus annual rounding.
            tolerance = (len(known) + 1) * 0.005 / 1000 + 1e-8
            report.append({"year": year, "series": column, "annual_gwh": row["energy_gwh"][column],
                           "known_daily_gwh": round(total, 8), "known_days": len(known),
                           "missing_days": len(daily) - len(known), "delta_gwh": round(delta, 8),
                           "rounding_tolerance_gwh": round(tolerance, 8),
                           "within_rounding": abs(delta) <= tolerance})
            if delta < -tolerance:
                below.append(f"{year}/{column}: {delta:.8f} GWh")
    metrics["daily_comparison"] = report
    if below:
        raise ValidationError("Annual below known daily sum beyond rounding; investigate source resolution: " + "; ".join(below))


def publish(value, output, expected_raw):
    """Caller holds parent-directory lock; previous corruption always blocks writes."""
    validate_snapshot(value)
    _, actual = load_snapshot(output)
    if actual != expected_raw:
        raise ValidationError("Stale annual snapshot; retry from fresh output")
    data = canonical_bytes(value)
    if data == actual:
        return False
    atomic_write(output, data)
    return True


def run(mode="backfill", output=OUTPUT, *, years=YEARS, reconcile=False,
        history_directory=DEFAULT_DIRECTORY, client=None):
    started = time.monotonic()
    client = client or AnnualClient()
    output, history_directory = Path(output), Path(history_directory)
    metrics = {"mode": mode, "status": "failed"}
    try:
        if mode != "backfill":
            raise ValidationError("Annual supplementation only supports explicit backfill")
        requested = selected_years(years)
        if not output.parent.is_dir():
            raise ValidationError("Output parent must exist")
        with writer_lock(output.parent):
            previous, previous_raw = load_snapshot(output)
            retained = {row["year"]: row for row in previous["years"]} if previous else {}
            selected = [year for year in requested if reconcile or year not in retained]
            _, partitions, history_raw = load_history(history_directory, required=True)
            fresh = fetch_annual(client, selected)
            metrics["fetch_seconds"] = round(time.monotonic() - started, 3)
            retained.update({row["year"]: row for row in fresh})
            value = snapshot([row for _, row in sorted(retained.items())])
            compare_daily(value["years"], partitions, metrics)
            if read_bounded(history_directory / "manifest.json", MANIFEST_LIMIT) != history_raw:
                raise ValidationError("History manifest changed before annual publication; retry")
            changed = publish(value, output, previous_raw)
            metrics.update(status="changed" if changed else "unchanged", years_fetched=selected,
                           years=[row["year"] for row in value["years"]], rows=len(value["years"]),
                           export_bytes=len(canonical_bytes(value)), content_hash=value["content_hash"])
        return metrics
    finally:
        metrics.update(requests=client.requests, bytes_downloaded=client.bytes_downloaded,
                       total_seconds=round(time.monotonic() - started, 3))
        print(json.dumps(metrics, sort_keys=True), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="mode", required=True)
    command = commands.add_parser("backfill")
    command.add_argument("--years", nargs="+", type=int, default=list(YEARS))
    command.add_argument("--reconcile", action="store_true")
    command.add_argument("--output", type=Path, default=OUTPUT)
    command.add_argument("--history-directory", type=Path, default=DEFAULT_DIRECTORY)
    try:
        run(**vars(parser.parse_args()))
    except (ValidationError, OSError) as exc:
        print(f"German electricity annual supplementation failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
