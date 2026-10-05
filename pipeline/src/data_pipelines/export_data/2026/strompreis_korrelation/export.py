"""Frozen article export: German wholesale electricity price vs. renewable share and gas, 2019–2025 plus 2026.

Run from ``pipeline/`` after ``ingest_gas_price_data.py`` and
``dbt build --target prod --select +fact_gas_price_europe_monthly``::

    PYTHONPATH=. python src/data_pipelines/export_data/2026/strompreis_korrelation/export.py
    PYTHONPATH=. python src/data_pipelines/export_data/2026/strompreis_korrelation/export.py \
        --output-dir ../frontend/src/data_ingestion/data/2026/strompreis-korrelation

Electricity inputs are the validated, Git-tracked SMARD daily history partitions
(closed years 2019–2025, verified by raw-byte SHA-256 against the manifest). The open
year 2026 changes with every dashboard refresh, so January–September 2026 is read from
the history at one pinned Git commit (``git show``), again SHA-256 checked. Gas and
exchange-rate inputs come from the curated DuckDB fact. No network requests.
Statistics are computed from the rounded values published in the monthly CSV, so
readers can reproduce every number from that file alone. 2026 is not part of any
statistic: it is compared with the values the 2023–2025 regression would expect.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import subprocess
import tempfile
from datetime import date, timedelta
from pathlib import Path

import duckdb
import numpy as np

PIPELINE = Path(__file__).resolve().parents[5]
REPOSITORY = PIPELINE.parent
DEFAULT_DATABASE = Path(".data/duckdb.db")
DEFAULT_OUTPUT = Path(".data/output/strompreis_korrelation")
DEFAULT_HISTORY = REPOSITORY / "frontend/src/data-history/german-electricity"
VERSION = "1.1.0"
MANIFEST = "strompreis_korrelation_metadata.json"
FIRST_MONTH, LAST_MONTH = "2019-01", "2025-12"
YEARS = list(range(2019, 2026))
# (key, label, first month, last month). The three sub-periods were fixed before
# looking at correlations: pre-crisis, gas-price crisis, post-crisis.
PERIODS = [
    ("2019-2025", "2019–2025", "2019-01", "2025-12"),
    ("2019-2020", "2019–2020", "2019-01", "2020-12"),
    ("2021-2022", "2021–2022", "2021-01", "2022-12"),
    ("2023-2025", "2023–2025", "2023-01", "2025-12"),
]
SUB_PERIODS = PERIODS[1:]
# Open year 2026: observations through September, read from one pinned dashboard
# refresh (same snapshot as the electricity YTD article), compared out of sample.
CURRENT_YEAR = 2026
CURRENT_FIRST, CURRENT_LAST = "2026-01", "2026-09"
CURRENT_COMMIT = "66035ab8b186fe975a55d065982a00963e3cee93"
CURRENT_HISTORY_PATH = "frontend/src/data-history/german-electricity"
MODEL_PERIOD = "2023–2025"
# Same classification as the electricity dashboard (frontend/src/js/dashboards):
# pumped-storage discharge and nuclear count as generation but not as renewable.
RENEWABLE = ["biomass", "hydro", "wind_offshore", "wind_onshore", "solar", "other_renewables"]
NON_RENEWABLE = ["lignite", "hard_coal", "gas", "other_conventional", "pumped_storage", "nuclear"]
GENERATION = RENEWABLE + NON_RENEWABLE
ENERGY_KEYS = sorted(GENERATION + ["load"])
MWH_PER_MMBTU = 0.29307107017
NEWEY_WEST_LAG = 3  # floor(4 * (84 / 100) ** (2 / 9)); fixed for all models
Z95 = 1.959963984540054
EXPECTED_SOURCE = {
    "license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "name": "Bundesnetzagentur | SMARD.de", "terms_url": "https://www.smard.de/home/datennutzung",
    "url": "https://www.smard.de/home/marktdaten",
}

MONTHLY = "strompreis_korrelation_monthly.csv"
CORRELATIONS = "strompreis_korrelation_correlations.csv"
REGRESSION = "strompreis_korrelation_regression.csv"
CURRENT = "strompreis_korrelation_2026.csv"
MONTHLY_COLUMNS = ["Monat", "Zeitraum", "Strompreis_EUR_MWh", "Erneuerbarenanteil_Prozent", "Gaspreis_EUR_MWh",
                   "Gaspreis_USD_MMBtu", "USD_je_EUR", "Last_GW", "Stunden"]
CORRELATION_COLUMNS = ["Zeitraum", "Monate", "Pearson_Erneuerbare", "Spearman_Erneuerbare", "Pearson_Gas", "Spearman_Gas",
                       "Partiell_Erneuerbare", "Partiell_Gas", "Pearson_Erneuerbare_Gas",
                       "Veraenderungen", "Pearson_Veraenderung_Erneuerbare", "Pearson_Veraenderung_Gas"]
REGRESSION_COLUMNS = ["Modell", "Zeitraum", "Monate", "Gas_Koeffizient", "Gas_KI95_unten", "Gas_KI95_oben",
                      "Erneuerbare_Koeffizient", "Erneuerbare_KI95_unten", "Erneuerbare_KI95_oben", "R2"]
CURRENT_COLUMNS = ["Monat", "Strompreis_EUR_MWh", "Erneuerbarenanteil_Prozent", "Gaspreis_EUR_MWh", "Gaspreis_USD_MMBtu",
                   "USD_je_EUR", "Stunden", "Erwartet_EUR_MWh", "Abweichung_EUR_MWh"]
CONTRACTS = {MONTHLY: MONTHLY_COLUMNS, CORRELATIONS: CORRELATION_COLUMNS, REGRESSION: REGRESSION_COLUMNS, CURRENT: CURRENT_COLUMNS}
PARTITION_NAME = re.compile(r"^(\d{4})\.([a-f0-9]{64})\.json$")


class ValidationError(ValueError):
    """Input or output does not satisfy the documented contract."""


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def months(first: str, last: str) -> list[str]:
    year, month = map(int, first.split("-"))
    result = []
    while f"{year:04d}-{month:02d}" <= last:
        result.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return result


def finite(value, *, minimum=None) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
            and (minimum is None or value >= minimum))


# --- Electricity: validated SMARD daily history ---------------------------------------------

def read_history(history_dir: Path = DEFAULT_HISTORY, years=YEARS) -> tuple[list[dict], list[dict]]:
    """Return daily rows for complete closed years plus per-partition provenance."""
    manifest_bytes = (history_dir / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    require(manifest.get("schema_version") == 1 and manifest.get("kind") == "german-electricity-history", "History manifest schema/kind mismatch")
    require(manifest.get("timezone") == "Europe/Berlin" and manifest.get("source") == EXPECTED_SOURCE, "History manifest source/timezone mismatch")
    entries = {entry["year"]: entry for entry in manifest["years"]}
    rows, provenance = [], []
    for year in years:
        entry = entries.get(year)
        require(entry is not None, f"History year {year} missing from manifest")
        require(entry.get("frozen") is True and entry["first_date"] == f"{year}-01-01" and entry["last_date"] == f"{year}-12-31", f"History year {year} is not a complete frozen year")
        filename = entry["url"].rsplit("/", 1)[-1]
        match = PARTITION_NAME.match(filename)
        require(match is not None and int(match.group(1)) == year and match.group(2) == entry["sha256"], f"Unexpected partition filename for {year}")
        path = history_dir / filename
        require(path.is_file() and not path.is_symlink(), f"Partition {filename} must be a regular file")
        raw = path.read_bytes()
        require(sha256(raw) == entry["sha256"], f"Partition {filename} SHA-256 mismatch")
        partition = json.loads(raw)
        require(partition.get("schema_version") in (1, 2) and partition.get("year") == year, f"Partition {year} schema/year mismatch")
        require(partition.get("source") == EXPECTED_SOURCE and partition.get("timezone") == "Europe/Berlin", f"Partition {year} source mismatch")
        expected = date(year, 1, 1)
        for row in partition["rows"]:
            require(row["date"] == expected.isoformat(), f"Partition {year}: non-contiguous date near {row['date']}")
            expected += timedelta(days=1)
        require(expected == date(year + 1, 1, 1) and len(partition["rows"]) == entry["days"], f"Partition {year} is incomplete")
        rows.extend(partition["rows"])
        provenance.append({"year": year, "filename": filename, "sha256": entry["sha256"], "days": entry["days"], "schema_version": partition["schema_version"]})
    return rows, provenance


def git_reader(commit: str = CURRENT_COMMIT, repository: Path = REPOSITORY):
    def read(path: str) -> bytes:
        return subprocess.check_output(["git", "show", f"{commit}:{path}"], cwd=repository)
    return read


def read_current_history(reader=None) -> tuple[list[dict], dict]:
    """Return January–September 2026 daily rows from the pinned history snapshot."""
    reader = reader or git_reader()
    manifest = json.loads(reader(f"{CURRENT_HISTORY_PATH}/manifest.json"))
    require(manifest.get("schema_version") == 1 and manifest.get("kind") == "german-electricity-history", "Pinned history manifest schema/kind mismatch")
    require(manifest.get("timezone") == "Europe/Berlin" and manifest.get("source") == EXPECTED_SOURCE, "Pinned history source/timezone mismatch")
    entry = next((item for item in manifest["years"] if item["year"] == CURRENT_YEAR), None)
    require(entry is not None, f"Pinned history has no {CURRENT_YEAR} partition")
    filename = entry["url"].rsplit("/", 1)[-1]
    match = PARTITION_NAME.match(filename)
    require(match is not None and int(match.group(1)) == CURRENT_YEAR and match.group(2) == entry["sha256"], "Unexpected pinned partition filename")
    raw = reader(f"{CURRENT_HISTORY_PATH}/{filename}")
    require(sha256(raw) == entry["sha256"], f"Pinned partition {filename} SHA-256 mismatch")
    partition = json.loads(raw)
    require(partition.get("year") == CURRENT_YEAR and partition.get("source") == EXPECTED_SOURCE, "Pinned partition source/year mismatch")
    last_day = (date(CURRENT_YEAR, int(CURRENT_LAST[5:]) % 12 + 1, 1) - timedelta(days=1)).isoformat()
    require(entry["last_date"] >= last_day, f"Pinned history ends before {last_day}")
    rows = [row for row in partition["rows"] if f"{CURRENT_FIRST}-01" <= row["date"] <= last_day]
    expected = date(CURRENT_YEAR, 1, 1)
    for row in rows:
        require(row["date"] == expected.isoformat(), f"Pinned partition: non-contiguous date near {row['date']}")
        expected += timedelta(days=1)
    require(expected.isoformat() > last_day, "Pinned partition does not cover January–September completely")
    return rows, {"year": CURRENT_YEAR, "commit": CURRENT_COMMIT, "filename": filename, "sha256": entry["sha256"],
                  "history_last_date": entry["last_date"], "observation_cutoff": last_day, "days": len(rows),
                  "schema_version": partition.get("schema_version")}


def monthly_electricity(rows: list[dict]) -> dict[str, dict]:
    """Aggregate daily rows to calendar months; any unknown value fails instead of being skipped.

    Price: hour-weighted mean of daily mean prices (equals the mean of all hourly prices).
    Renewable share: renewable net generation / total net public generation, both summed
    over the month (energy-weighted, not an average of daily shares).
    """
    totals: dict[str, dict] = {}
    for row in rows:
        day = row["date"]
        require(set(row["energy_gwh"]) == set(ENERGY_KEYS), f"{day}: unexpected energy keys")
        require(row.get("price_zone") == "DE-LU", f"{day}: price zone is not DE-LU")
        require(row["hours"] in (23, 24, 25), f"{day}: invalid hour count")
        require(finite(row["price_eur_mwh"]), f"{day}: price unknown; months with missing prices are not published")
        for key in ENERGY_KEYS:
            require(finite(row["energy_gwh"][key], minimum=0), f"{day}: {key} unknown or negative")
        month = totals.setdefault(day[:7], {"days": 0, "hours": 0, "price_hours": 0.0, "renewable": 0.0, "generation": 0.0, "load": 0.0})
        month["days"] += 1
        month["hours"] += row["hours"]
        month["price_hours"] += row["price_eur_mwh"] * row["hours"]
        month["renewable"] += sum(row["energy_gwh"][key] for key in RENEWABLE)
        month["generation"] += sum(row["energy_gwh"][key] for key in GENERATION)
        month["load"] += row["energy_gwh"]["load"]
    result = {}
    for key, month in totals.items():
        year, number = map(int, key.split("-"))
        next_month = date(year + (number == 12), number % 12 + 1, 1)
        require(month["days"] == (next_month - date(year, number, 1)).days, f"{key}: incomplete month")
        require(month["generation"] > 0, f"{key}: no generation")
        result[key] = {
            "hours": month["hours"],
            "price": month["price_hours"] / month["hours"],
            "renewable_share": month["renewable"] / month["generation"] * 100,
            "load_gw": month["load"] / month["hours"],
        }
    return result


# --- Gas: curated DuckDB fact ---------------------------------------------------------------

def read_gas(db) -> tuple[dict[str, dict], dict]:
    result = db.execute("""
        SELECT strftime(month, '%Y-%m') AS month, gas_usd_per_mmbtu, usd_per_eur, gas_eur_per_mwh,
               CAST(gas_release_date AS VARCHAR) AS release_date, gas_source_sha256, fx_source_sha256
        FROM prod_curated.fact_gas_price_europe_monthly
        WHERE month BETWEEN DATE '2019-01-01' AND DATE '2026-09-01'
        ORDER BY month""").fetchall()
    gas = {}
    for month, usd, fx, eur, release, gas_hash, fx_hash in result:
        require(month not in gas, f"Duplicate gas month {month}")
        require(finite(usd, minimum=0) and usd > 0 and finite(fx) and 0.5 < fx < 2, f"{month}: implausible gas/FX input")
        require(abs(usd / fx / MWH_PER_MMBTU - eur) < 1e-9, f"{month}: gas conversion mismatch")
        gas[month] = {"usd_per_mmbtu": usd, "usd_per_eur": fx, "eur_per_mwh": eur, "release_date": release, "gas_sha256": gas_hash, "fx_sha256": fx_hash}
    require(list(gas) == months(FIRST_MONTH, CURRENT_LAST), "Gas fact does not cover every month 2019-01..2026-09")
    for field in ("release_date", "gas_sha256", "fx_sha256"):
        require(len({row[field] for row in gas.values()}) == 1, f"Gas inputs mix several source vintages ({field})")
    staging = {}
    for table, columns in (("world_bank_gas_europe_monthly", "series, unit, source_url, retrieved_at"),
                           ("ecb_usd_eur_monthly", "series_key, source_url, retrieved_at")):
        values = db.execute(f"SELECT DISTINCT {columns} FROM staging.{table}").fetchall()
        require(len(values) == 1, f"staging.{table} mixes several downloads")
        staging[table] = dict(zip([name.strip() for name in columns.split(",")], values[0]))
    first = next(iter(gas.values()))
    provenance = {
        "world_bank_pink_sheet": {**staging["world_bank_gas_europe_monthly"], "release_date": first["release_date"], "sha256": first["gas_sha256"]},
        "ecb_usd_eur": {**staging["ecb_usd_eur_monthly"], "sha256": first["fx_sha256"]},
    }
    return gas, provenance


# --- Dataset and statistics -----------------------------------------------------------------

def period_of(month: str) -> str:
    return next(label for _, label, first, last in SUB_PERIODS if first <= month <= last)


def build_monthly(electricity: dict, gas: dict) -> list[dict]:
    expected = months(FIRST_MONTH, LAST_MONTH)
    require(sorted(electricity) == expected, "Electricity months do not cover 2019-01..2025-12 exactly")
    require(set(expected) <= set(gas), "Gas months do not cover 2019-01..2025-12")
    # Values are rounded once here; every statistic below uses exactly these numbers.
    return [{
        "Monat": month,
        "Zeitraum": period_of(month),
        "Strompreis_EUR_MWh": round(electricity[month]["price"], 2),
        "Erneuerbarenanteil_Prozent": round(electricity[month]["renewable_share"], 2),
        "Gaspreis_EUR_MWh": round(gas[month]["eur_per_mwh"], 2),
        "Gaspreis_USD_MMBtu": round(gas[month]["usd_per_mmbtu"], 2),
        "USD_je_EUR": round(gas[month]["usd_per_eur"], 6),
        "Last_GW": round(electricity[month]["load_gw"], 3),
        "Stunden": electricity[month]["hours"],
    } for month in expected]


def pearson(x, y) -> float:
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    require(len(x) == len(y) and len(x) >= 3, "Correlation needs at least three paired values")
    dx, dy = x - x.mean(), y - y.mean()
    denominator = math.sqrt(float(dx @ dx) * float(dy @ dy))
    require(denominator > 0, "Correlation undefined for a constant series")
    return float(dx @ dy) / denominator


def ranks(values) -> np.ndarray:
    """1-based ranks; ties receive the average of the ranks they span."""
    values = np.asarray(values, dtype=float)
    order = np.argsort(values, kind="mergesort")
    result = np.empty(len(values))
    start = 0
    while start < len(values):
        end = start
        while end + 1 < len(values) and values[order[end + 1]] == values[order[start]]:
            end += 1
        result[order[start:end + 1]] = (start + end) / 2 + 1
        start = end + 1
    return result


def spearman(x, y) -> float:
    return pearson(ranks(x), ranks(y))


def partial(r_xy: float, r_xz: float, r_yz: float) -> float:
    """Correlation of x and y after removing the linear influence of z from both."""
    return (r_xy - r_xz * r_yz) / math.sqrt((1 - r_xz ** 2) * (1 - r_yz ** 2))


def ols_hac(y, regressors, lag=NEWEY_WEST_LAG) -> dict:
    """OLS with an intercept and Newey–West (Bartlett) HAC standard errors.

    No small-sample correction; the 95 % intervals use the normal approximation and
    are indicative only for short, autocorrelated monthly samples.
    """
    y = np.asarray(y, dtype=float)
    X = np.column_stack([np.ones(len(y))] + [np.asarray(column, dtype=float) for column in regressors])
    require(len(y) > X.shape[1], "Regression has too few observations")
    require(np.linalg.matrix_rank(X) == X.shape[1], "Regressors are collinear")
    bread = np.linalg.inv(X.T @ X)
    beta = bread @ X.T @ y
    residuals = y - X @ beta
    scores = X * residuals[:, None]
    meat = scores.T @ scores
    for distance in range(1, lag + 1):
        weight = 1 - distance / (lag + 1)
        gamma = scores[distance:].T @ scores[:-distance]
        meat += weight * (gamma + gamma.T)
    covariance = bread @ meat @ bread
    centered = y - y.mean()
    return {
        "coefficients": beta,
        "standard_errors": np.sqrt(np.diag(covariance)),
        "r2": 1 - float(residuals @ residuals) / float(centered @ centered),
        "n": len(y),
    }


def select(rows, first, last):
    return [row for row in rows if first <= row["Monat"] <= last]


def column(rows, name):
    return [row[name] for row in rows]


def correlation_rows(monthly: list[dict]) -> list[dict]:
    result = []
    for _, label, first, last in PERIODS:
        rows = select(monthly, first, last)
        price, renewable, gas = (column(rows, name) for name in ("Strompreis_EUR_MWh", "Erneuerbarenanteil_Prozent", "Gaspreis_EUR_MWh"))
        r_price_renewable, r_price_gas, r_renewable_gas = pearson(price, renewable), pearson(price, gas), pearson(renewable, gas)
        # Month-to-month changes inside the period only (no change across period boundaries).
        change = lambda values: np.diff(np.asarray(values, dtype=float))  # noqa: E731
        result.append({
            "Zeitraum": label,
            "Monate": len(rows),
            "Pearson_Erneuerbare": round(r_price_renewable, 4),
            "Spearman_Erneuerbare": round(spearman(price, renewable), 4),
            "Pearson_Gas": round(r_price_gas, 4),
            "Spearman_Gas": round(spearman(price, gas), 4),
            "Partiell_Erneuerbare": round(partial(r_price_renewable, r_price_gas, r_renewable_gas), 4),
            "Partiell_Gas": round(partial(r_price_gas, r_price_renewable, r_renewable_gas), 4),
            "Pearson_Erneuerbare_Gas": round(r_renewable_gas, 4),
            "Veraenderungen": len(rows) - 1,
            "Pearson_Veraenderung_Erneuerbare": round(pearson(change(price), change(renewable)), 4),
            "Pearson_Veraenderung_Gas": round(pearson(change(price), change(gas)), 4),
        })
    return result


def regression_row(model, label, result, gas_index=1, renewable_index=2):
    beta, se = result["coefficients"], result["standard_errors"]
    interval = lambda index: (beta[index] - Z95 * se[index], beta[index] + Z95 * se[index])  # noqa: E731
    return {
        "Modell": model, "Zeitraum": label, "Monate": result["n"],
        "Gas_Koeffizient": round(float(beta[gas_index]), 4),
        "Gas_KI95_unten": round(float(interval(gas_index)[0]), 4), "Gas_KI95_oben": round(float(interval(gas_index)[1]), 4),
        "Erneuerbare_Koeffizient": round(float(beta[renewable_index]), 4),
        "Erneuerbare_KI95_unten": round(float(interval(renewable_index)[0]), 4), "Erneuerbare_KI95_oben": round(float(interval(renewable_index)[1]), 4),
        "R2": round(result["r2"], 4),
    }


def regression_rows(monthly: list[dict]) -> list[dict]:
    result = []
    for _, label, first, last in PERIODS:
        rows = select(monthly, first, last)
        fit = ols_hac(column(rows, "Strompreis_EUR_MWh"), [column(rows, "Gaspreis_EUR_MWh"), column(rows, "Erneuerbarenanteil_Prozent")])
        result.append(regression_row("Gas_Erneuerbare", label, fit))
    # Robustness for the full period: add average load and calendar-month dummies
    # (January is the reference). This absorbs the seasonal part of the renewable
    # share, so its coefficient then reflects deviations from the usual season.
    dummies = [[1.0 if int(row["Monat"][5:]) == number else 0.0 for row in monthly] for number in range(2, 13)]
    fit = ols_hac(column(monthly, "Strompreis_EUR_MWh"),
                  [column(monthly, "Gaspreis_EUR_MWh"), column(monthly, "Erneuerbarenanteil_Prozent"), column(monthly, "Last_GW"), *dummies])
    result.append(regression_row("Gas_Erneuerbare_Last_Kalendermonat", PERIODS[0][1], fit))
    return result


def model_fit(monthly: list[dict]) -> dict:
    """The 2023–2025 gas + renewables regression, refitted from the published monthly CSV."""
    _, _, first, last = next(period for period in PERIODS if period[1] == MODEL_PERIOD)
    rows = select(monthly, first, last)
    return ols_hac(column(rows, "Strompreis_EUR_MWh"), [column(rows, "Gaspreis_EUR_MWh"), column(rows, "Erneuerbarenanteil_Prozent")])


def current_rows(electricity: dict, gas: dict, monthly: list[dict]) -> list[dict]:
    """2026 months with the price the 2023–2025 relationship would expect (out of sample)."""
    expected = months(CURRENT_FIRST, CURRENT_LAST)
    require(sorted(electricity) == expected, "2026 electricity months do not cover 2026-01..2026-09 exactly")
    require(set(expected) <= set(gas), "Gas months do not cover 2026-01..2026-09")
    beta = model_fit(monthly)["coefficients"]
    result = []
    for month in expected:
        price = round(electricity[month]["price"], 2)
        renewable = round(electricity[month]["renewable_share"], 2)
        gas_eur = round(gas[month]["eur_per_mwh"], 2)
        prediction = round(float(beta[0] + beta[1] * gas_eur + beta[2] * renewable), 2)
        result.append({
            "Monat": month, "Strompreis_EUR_MWh": price, "Erneuerbarenanteil_Prozent": renewable,
            "Gaspreis_EUR_MWh": gas_eur, "Gaspreis_USD_MMBtu": round(gas[month]["usd_per_mmbtu"], 2),
            "USD_je_EUR": round(gas[month]["usd_per_eur"], 6), "Stunden": electricity[month]["hours"],
            "Erwartet_EUR_MWh": prediction, "Abweichung_EUR_MWh": round(price - prediction, 2),
        })
    return result


# --- Serialisation and publication ----------------------------------------------------------

DECIMALS = {"Strompreis_EUR_MWh": 2, "Erneuerbarenanteil_Prozent": 2, "Gaspreis_EUR_MWh": 2, "Gaspreis_USD_MMBtu": 2,
            "USD_je_EUR": 6, "Last_GW": 3, "Erwartet_EUR_MWh": 2, "Abweichung_EUR_MWh": 2}


def csv_bytes(columns, rows) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        require(list(row) == columns, "Output row fields do not match the CSV contract")
        values = []
        for name in columns:
            value = row[name]
            if isinstance(value, float):
                require(math.isfinite(value), f"Non-finite {name}")
                value = f"{value:.{DECIMALS.get(name, 4)}f}"
            values.append(value)
        writer.writerow(values)
    return stream.getvalue().encode("utf-8")


def json_bytes(value) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def build_payloads(db, history_dir: Path = DEFAULT_HISTORY, current_reader=None) -> dict[str, bytes]:
    rows, history = read_history(history_dir)
    current_daily, current_history = read_current_history(current_reader)
    gas, gas_provenance = read_gas(db)
    monthly = build_monthly(monthly_electricity(rows), gas)
    current = current_rows(monthly_electricity(current_daily), gas, monthly)
    beta = model_fit(monthly)["coefficients"]
    files = {
        MONTHLY: csv_bytes(MONTHLY_COLUMNS, monthly),
        CORRELATIONS: csv_bytes(CORRELATION_COLUMNS, correlation_rows(monthly)),
        REGRESSION: csv_bytes(REGRESSION_COLUMNS, regression_rows(monthly)),
        CURRENT: csv_bytes(CURRENT_COLUMNS, current),
    }
    metadata = {
        "schema_version": 2,
        "kind": "frozen_strompreis_korrelation_article",
        "exporter_version": VERSION,
        "exporter_sha256": sha256(Path(__file__).read_bytes()),
        "period": {"first_month": FIRST_MONTH, "last_month": LAST_MONTH, "months": len(monthly),
                   "sub_periods": [{"label": label, "first_month": first, "last_month": last} for _, label, first, last in SUB_PERIODS]},
        "current_year": {"first_month": CURRENT_FIRST, "last_month": CURRENT_LAST, "months": len(current),
                         "model_period": MODEL_PERIOD,
                         "model_coefficients": {"intercept": round(float(beta[0]), 6), "gas": round(float(beta[1]), 6), "renewable_share": round(float(beta[2]), 6)},
                         "note": "Out-of-sample comparison only; 2026 is not used in any correlation or regression. Recent days were still inside the dashboard correction window."},
        "sources": {
            "electricity": {**EXPECTED_SOURCE, "dataset": "Day-ahead price DE-LU, net public generation Germany (daily)", "partitions": history,
                            "current_partition": current_history},
            "gas": {**gas_provenance["world_bank_pink_sheet"], "name": "World Bank, Commodity Price Data (The Pink Sheet)",
                    "license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
                    "note": "Natural gas, Europe: Netherlands TTF since April 2015; monthly benchmark average, not a day-ahead quote"},
            "exchange_rate": {**gas_provenance["ecb_usd_eur"], "name": "European Central Bank, euro foreign exchange reference rate (USD per EUR), monthly average",
                              "terms_url": "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html"},
        },
        "methodology": {
            "electricity_price": "Hour-weighted monthly mean of daily DE-LU day-ahead mean prices (EUR/MWh)",
            "renewable_share": "Monthly renewable net public generation / total net public generation, in percent",
            "renewable_sources": RENEWABLE,
            "non_renewable_generation": NON_RENEWABLE,
            "gas_conversion": "EUR/MWh = USD/MMBtu / (USD per EUR) / 0.29307107017 MWh per MMBtu, monthly averages",
            "statistics_input": "Rounded values in strompreis_korrelation_monthly.csv",
            "correlations": "Pearson and Spearman (average ranks for ties) on monthly levels; partial correlations control for the other variable; changes are month-to-month differences inside each period",
            "regression": f"OLS with intercept; Newey-West HAC standard errors, Bartlett kernel, lag {NEWEY_WEST_LAG}, no small-sample correction; 95 % intervals use z = 1.96",
            "causality": "Descriptive associations only; monthly correlations are not causal effects or cost shares",
            "expected_2026": "Erwartet = intercept + gas coefficient * gas EUR/MWh + renewable coefficient * renewable share, OLS point estimates of the 2023-2025 model refitted from the rounded monthly CSV; inputs are the rounded 2026 values",
        },
        "files": {name: {"sha256": sha256(content), "bytes": len(content), "columns": CONTRACTS[name],
                         "rows": content.count(b"\n") - 1} for name, content in sorted(files.items())},
    }
    files[MANIFEST] = json_bytes(metadata)
    return files


def verify_set(directory: Path) -> dict:
    metadata = json.loads((directory / MANIFEST).read_bytes())
    require(metadata.get("schema_version") == 2 and metadata.get("kind") == "frozen_strompreis_korrelation_article", "Manifest schema/kind mismatch")
    require(set(metadata["files"]) == set(CONTRACTS), "Manifest file allowlist mismatch")
    for name, contract in metadata["files"].items():
        raw = (directory / name).read_bytes()
        require(len(raw) == contract["bytes"] and sha256(raw) == contract["sha256"], f"File hash mismatch: {name}")
        records = list(csv.reader(io.StringIO(raw.decode("utf-8"))))
        require(records[0] == contract["columns"] == CONTRACTS[name] and len(records) - 1 == contract["rows"] > 0, f"CSV contract mismatch: {name}")
        require(all(len(record) == len(records[0]) and all(record) for record in records[1:]), f"CSV record mismatch: {name}")
    return metadata


def promote(files: dict[str, bytes], output: Path) -> None:
    """Stage and verify the complete set, then replace data files and the manifest last."""
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".strompreis-stage-", dir=output.parent) as temporary:
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
            for name in reversed(replaced):  # best-effort rollback; old manifest hashes reject mixed sets
                if previous[name] is None:
                    (output / name).unlink()
                else:
                    (stage / name).write_bytes(previous[name])
                    os.replace(stage / name, output / name)
            raise


def export(database=DEFAULT_DATABASE, output_dir=DEFAULT_OUTPUT, history_dir=DEFAULT_HISTORY) -> dict:
    with duckdb.connect(str(database), read_only=True, config={"threads": 1}) as db:
        files = build_payloads(db, Path(history_dir))
    promote(files, Path(output_dir))
    return json.loads(files[MANIFEST])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--history-dir", type=Path, default=DEFAULT_HISTORY)
    args = parser.parse_args(argv)
    metadata = export(args.database, args.output_dir, args.history_dir)
    print(f"Validated {len(metadata['files'])} files + {MANIFEST}; {metadata['period']['months']} + {metadata['current_year']['months']} months; output {args.output_dir}")


if __name__ == "__main__":
    main()
