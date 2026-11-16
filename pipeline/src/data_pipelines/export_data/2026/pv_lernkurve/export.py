"""Frozen article export: Germany's role in the global solar PV market and the module price learning curve.

Run from ``pipeline/`` after ``ingest_pv_lernkurve_data.py`` and
``dbt build --target prod --select +fact_solar_pv_world_yearly pv_lernkurve_contract``::

    PYTHONPATH=. python src/data_pipelines/export_data/2026/pv_lernkurve/export.py
    PYTHONPATH=. python src/data_pipelines/export_data/2026/pv_lernkurve/export.py \
        --output-dir ../frontend/src/data_ingestion/data/2026/pv-lernkurve

Inputs are the curated DuckDB fact ``prod_curated.fact_solar_pv_world_yearly`` and the
staging provenance columns (URL, SHA-256, retrieval time). No network requests.
Capacities and prices are rounded first; every derived value (annual additions,
shares, price declines, learning rate) is computed from the rounded published CSVs,
so readers can reproduce each article number from the files alone.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import tempfile
from decimal import Decimal
from pathlib import Path

import duckdb
import numpy as np

DEFAULT_DATABASE = Path(".data/duckdb.db")
DEFAULT_OUTPUT = Path(".data/output/pv_lernkurve")
VERSION = "1.0.0"
MANIFEST = "pv_lernkurve_metadata.json"
PRICE_FIRST, CAPACITY_FIRST, LAST = 1975, 2000, 2025
CHART_PRICE_FIRST = 2000
# German boom years: from the 2004 feed-in tariff amendment to the 2010 peak share of additions.
BOOM_FIRST, BOOM_LAST = 2004, 2010
# Additions from the first EEG year-end (2000) to the year before German additions collapsed.
EARLY_FIRST, EARLY_LAST = 2000, 2012

JAHRE = "pv_lernkurve_jahre.csv"
ZUBAU = "pv_lernkurve_zubau.csv"
MODULPREIS = "pv_lernkurve_modulpreis.csv"
LERNKURVE = "pv_lernkurve_lernkurve.csv"
KENNZAHLEN = "pv_lernkurve_kennzahlen.csv"
JAHRE_COLUMNS = ["Jahr", "Welt_GW", "Deutschland_GW", "China_GW", "Anteil_Bestand_Deutschland_Prozent",
                 "CO2_Anteil_Deutschland_Prozent", "Solar_Stromanteil_Welt_Prozent", "Solar_Stromanteil_Deutschland_Prozent"]
ZUBAU_COLUMNS = ["Jahr", "Zubau_Welt_GW", "Zubau_Deutschland_GW", "Zubau_China_GW", "Zubau_Uebrige_Welt_GW",
                 "Anteil_Zubau_Deutschland_Prozent", "Anteil_Bestand_Deutschland_Prozent"]
MODULPREIS_COLUMNS = ["Jahr", "Modulpreis_USD_W"]
LERNKURVE_COLUMNS = ["Jahr", "Modulpreis_USD_W", "Kumulierte_Leistung_Welt_MW"]
KENNZAHLEN_COLUMNS = ["Kennzahl", "Zeitraum", "Wert", "Einheit"]
CONTRACTS = {JAHRE: JAHRE_COLUMNS, ZUBAU: ZUBAU_COLUMNS, MODULPREIS: MODULPREIS_COLUMNS,
             LERNKURVE: LERNKURVE_COLUMNS, KENNZAHLEN: KENNZAHLEN_COLUMNS}
DECIMALS = {"Welt_GW": 3, "Deutschland_GW": 3, "China_GW": 3, "Zubau_Welt_GW": 3, "Zubau_Deutschland_GW": 3,
            "Zubau_China_GW": 3, "Zubau_Uebrige_Welt_GW": 3, "Kumulierte_Leistung_Welt_MW": 3, "Modulpreis_USD_W": 3,
            "Anteil_Bestand_Deutschland_Prozent": 2, "Anteil_Zubau_Deutschland_Prozent": 2, "CO2_Anteil_Deutschland_Prozent": 2,
            "Solar_Stromanteil_Welt_Prozent": 2, "Solar_Stromanteil_Deutschland_Prozent": 2, "Wert": 2}
STAGING = {
    "capacity": "owid_irena_solar_pv_capacity",
    "module_cost": "owid_pv_module_cost_capacity",
    "co2_share": "owid_gcp_co2_share",
    "solar_share": "owid_solar_electricity_share",
}
SOURCES = {
    "capacity": {"name": "IRENA, Renewable Energy Statistics 2026 – processed by Our World in Data",
                 "landing_page": "https://ourworldindata.org/grapher/installed-solar-pv-capacity",
                 "license": "©IRENA 2026, reuse with attribution; OWID processing CC BY 4.0",
                 "note": "On-grid plus off-grid photovoltaics in GW; concentrated solar power excluded; empty off-grid values count as zero"},
    "module_cost": {"name": "IRENA (2025, 2026); Nemet (2009); Farmer and Lafond (2016) – processed by Our World in Data",
                    "landing_page": "https://ourworldindata.org/grapher/solar-pv-prices",
                    "license": "©IRENA, reuse with attribution; Nemet CC BY 3.0; Farmer & Lafond CC BY 4.0; OWID processing CC BY 4.0",
                    "note": "Module price in constant 2025 US$ per watt; global estimates before 2010, European pvXchange benchmarks from 2010; cumulative on-grid PV capacity"},
    "co2_share": {"name": "Global Carbon Budget (2026) – processed by Our World in Data",
                  "landing_page": "https://ourworldindata.org/grapher/annual-share-of-co2-emissions",
                  "license": "CC BY 4.0", "note": "Fossil CO2 emissions excluding land-use change, share of global emissions"},
    "solar_share": {"name": "Ember (2026); Energy Institute – Statistical Review of World Energy (2026) – processed by Our World in Data",
                    "landing_page": "https://ourworldindata.org/grapher/share-electricity-solar",
                    "license": "Ember CC BY 4.0; ©Energy Institute 2026; OWID processing CC BY 4.0",
                    "note": "Solar share of electricity generation in percent"},
}


class ValidationError(ValueError):
    """Raised when inputs or outputs violate the documented contract."""


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rounded(value, decimals: int) -> float:
    require(value is not None and math.isfinite(value), "Missing or non-finite input value")
    # Decimal rounding of the shortest repr avoids binary artefacts such as 2.675 -> 2.67.
    return float(round(Decimal(repr(float(value))), decimals))


def read_fact(db) -> list[dict]:
    rows = db.execute("""
        SELECT jahr, modulpreis_usd2025_pro_watt, kumulierte_leistung_welt_gw, welt_gw, deutschland_gw, china_gw,
               co2_anteil_deutschland_prozent, solar_stromanteil_welt_prozent, solar_stromanteil_deutschland_prozent
        FROM prod_curated.fact_solar_pv_world_yearly ORDER BY jahr""").fetchall()
    names = ["jahr", "preis", "kumuliert", "welt", "deutschland", "china", "co2", "solar_welt", "solar_de"]
    fact = [dict(zip(names, row)) for row in rows]
    require([row["jahr"] for row in fact] == list(range(PRICE_FIRST, LAST + 1)), f"Fact must cover {PRICE_FIRST}..{LAST} without gaps")
    for row in fact:
        require(row["preis"] is not None and row["preis"] > 0 and row["kumuliert"] is not None and row["kumuliert"] > 0, f"{row['jahr']}: invalid price or cumulative capacity")
        if row["jahr"] >= CAPACITY_FIRST:
            for key in ("welt", "deutschland", "china", "co2", "solar_welt", "solar_de"):
                require(row[key] is not None and math.isfinite(row[key]) and row[key] >= 0, f"{row['jahr']}: missing {key}")
            require(row["deutschland"] + row["china"] <= row["welt"], f"{row['jahr']}: Germany + China exceed the world total")
    return fact


def read_provenance(db) -> dict:
    provenance = {}
    for key, table in STAGING.items():
        rows = db.execute(f"SELECT DISTINCT source_url, source_sha256, retrieved_at FROM staging.{table}").fetchall()
        require(len(rows) == 1, f"staging.{table} mixes {len(rows)} source vintages")
        url, digest, retrieved = rows[0]
        provenance[key] = {**SOURCES[key], "url": url, "sha256": digest, "retrieved_at": retrieved}
    return provenance


def jahre_rows(fact: list[dict]) -> list[dict]:
    rows = []
    for row in fact:
        if row["jahr"] < CAPACITY_FIRST:
            continue
        welt, deutschland = rounded(row["welt"], 3), rounded(row["deutschland"], 3)
        rows.append({"Jahr": str(row["jahr"]), "Welt_GW": welt, "Deutschland_GW": deutschland, "China_GW": rounded(row["china"], 3),
                     "Anteil_Bestand_Deutschland_Prozent": rounded(100 * deutschland / welt, 2),
                     "CO2_Anteil_Deutschland_Prozent": rounded(row["co2"], 2),
                     "Solar_Stromanteil_Welt_Prozent": rounded(row["solar_welt"], 2),
                     "Solar_Stromanteil_Deutschland_Prozent": rounded(row["solar_de"], 2)})
    return rows


def zubau_rows(jahre: list[dict]) -> list[dict]:
    """Annual net additions from the rounded year-end capacities (exact decimal differences)."""
    rows = []
    for previous, row in zip(jahre, jahre[1:]):
        diff = {key: rounded(row[key] - previous[key], 3) for key in ("Welt_GW", "Deutschland_GW", "China_GW")}
        rows.append({"Jahr": row["Jahr"], "Zubau_Welt_GW": diff["Welt_GW"], "Zubau_Deutschland_GW": diff["Deutschland_GW"],
                     "Zubau_China_GW": diff["China_GW"],
                     "Zubau_Uebrige_Welt_GW": rounded(diff["Welt_GW"] - diff["Deutschland_GW"] - diff["China_GW"], 3),
                     "Anteil_Zubau_Deutschland_Prozent": rounded(100 * diff["Deutschland_GW"] / diff["Welt_GW"], 2),
                     "Anteil_Bestand_Deutschland_Prozent": row["Anteil_Bestand_Deutschland_Prozent"]})
    require(all(row["Zubau_Welt_GW"] > 0 for row in rows), "World additions must be positive in every year")
    return rows


def lernkurve_rows(fact: list[dict]) -> list[dict]:
    return [{"Jahr": str(row["jahr"]), "Modulpreis_USD_W": rounded(row["preis"], 3),
             "Kumulierte_Leistung_Welt_MW": rounded(row["kumuliert"] * 1000, 3)} for row in fact]


def learning_rate(lernkurve: list[dict], first: int, last: int) -> float:
    """Percent price decline per doubling of cumulative capacity: 1 - 2^b from log2-log2 OLS."""
    selected = [row for row in lernkurve if first <= int(row["Jahr"]) <= last]
    slope = np.polyfit(np.log2([row["Kumulierte_Leistung_Welt_MW"] for row in selected]),
                       np.log2([row["Modulpreis_USD_W"] for row in selected]), 1)[0]
    return 100 * (1 - 2 ** float(slope))


def kennzahlen_rows(jahre: list[dict], zubau: list[dict], lernkurve: list[dict]) -> list[dict]:
    year = {int(row["Jahr"]): row for row in jahre}
    price = {int(row["Jahr"]): row["Modulpreis_USD_W"] for row in lernkurve}

    def additions_share(first, last):
        # Additions in first..last = year-end capacity of `last` minus year-end of `first - 1`.
        start, end = year[first - 1], year[last]
        return 100 * (end["Deutschland_GW"] - start["Deutschland_GW"]) / (end["Welt_GW"] - start["Welt_GW"])

    peak_additions = max(zubau, key=lambda row: row["Anteil_Zubau_Deutschland_Prozent"])
    peak_stock = max(jahre, key=lambda row: row["Anteil_Bestand_Deutschland_Prozent"])
    values = [
        ("Lernrate", f"{PRICE_FIRST}–{LAST}", learning_rate(lernkurve, PRICE_FIRST, LAST), "Prozent je Verdopplung"),
        ("Lernrate", f"{CHART_PRICE_FIRST}–{LAST}", learning_rate(lernkurve, CHART_PRICE_FIRST, LAST), "Prozent je Verdopplung"),
        ("Anteil Deutschlands am weltweiten Zubau", f"{BOOM_FIRST}–{BOOM_LAST}", additions_share(BOOM_FIRST, BOOM_LAST), "Prozent"),
        ("Anteil Deutschlands am weltweiten Zubau", f"{EARLY_FIRST + 1}–{EARLY_LAST}", additions_share(EARLY_FIRST + 1, EARLY_LAST), "Prozent"),
        ("Höchster Anteil am Jahreszubau", peak_additions["Jahr"], peak_additions["Anteil_Zubau_Deutschland_Prozent"], "Prozent"),
        ("Höchster Anteil am Bestand", peak_stock["Jahr"], peak_stock["Anteil_Bestand_Deutschland_Prozent"], "Prozent"),
        ("Verdopplungen der weltweiten Leistung", f"{BOOM_FIRST}–{EARLY_LAST}", math.log2(year[EARLY_LAST]["Welt_GW"] / year[BOOM_FIRST]["Welt_GW"]), "Anzahl"),
        ("Rückgang des Modulpreises", f"{BOOM_FIRST}–{EARLY_LAST}", 100 * (1 - price[EARLY_LAST] / price[BOOM_FIRST]), "Prozent"),
        ("Rückgang des Modulpreises", f"{BOOM_FIRST}–{LAST}", 100 * (1 - price[LAST] / price[BOOM_FIRST]), "Prozent"),
        ("Rückgang des Modulpreises", f"{CHART_PRICE_FIRST}–{LAST}", 100 * (1 - price[LAST] / price[CHART_PRICE_FIRST]), "Prozent"),
    ]
    return [{"Kennzahl": name, "Zeitraum": period, "Wert": rounded(value, 2), "Einheit": unit} for name, period, value, unit in values]


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
                value = f"{value:.{DECIMALS[name]}f}"
            values.append(value)
        writer.writerow(values)
    return stream.getvalue().encode("utf-8")


def json_bytes(value) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def build_tables(fact: list[dict]) -> dict[str, list[dict]]:
    jahre = jahre_rows(fact)
    zubau = zubau_rows(jahre)
    lernkurve = lernkurve_rows(fact)
    modulpreis = [{"Jahr": row["Jahr"], "Modulpreis_USD_W": row["Modulpreis_USD_W"]} for row in lernkurve if int(row["Jahr"]) >= CHART_PRICE_FIRST]
    return {JAHRE: jahre, ZUBAU: zubau, MODULPREIS: modulpreis, LERNKURVE: lernkurve,
            KENNZAHLEN: kennzahlen_rows(jahre, zubau, lernkurve)}


def build_payloads(db) -> dict[str, bytes]:
    tables = build_tables(read_fact(db))
    files = {name: csv_bytes(CONTRACTS[name], rows) for name, rows in tables.items()}
    metadata = {
        "schema_version": 1,
        "kind": "frozen_pv_lernkurve_article",
        "exporter_version": VERSION,
        "exporter_sha256": sha256(Path(__file__).read_bytes()),
        "period": {"prices": [PRICE_FIRST, LAST], "capacity": [CAPACITY_FIRST, LAST], "chart_prices": [CHART_PRICE_FIRST, LAST],
                   "boom": [BOOM_FIRST, BOOM_LAST], "early": [EARLY_FIRST + 1, EARLY_LAST]},
        "sources": read_provenance(db),
        "methodology": {
            "capacity": "Year-end installed photovoltaic capacity (on-grid + off-grid, without concentrated solar power), GW, rounded to 3 decimals",
            "additions": "Annual net additions = year-end capacity minus previous year-end capacity, from the rounded values; retirements are netted out",
            "shares": "Germany's share = Germany / world total, from the rounded values, in percent",
            "learning_rate": "OLS of log2(module price) on log2(global cumulative on-grid PV capacity in MW); learning rate = 1 - 2^slope; descriptive fit, not a causal estimate",
            "price": "Module price only (no installation or system costs), constant 2025 US$ per watt",
            "statistics_input": "Rounded values in pv_lernkurve_jahre.csv and pv_lernkurve_lernkurve.csv",
            "known_source_issue": "From 2022 IRENA reports less German capacity than the Bundesnetzagentur/AGEE-Stat (end of 2022: 61.2 vs. about 66.5 GW; 2022 net addition 1.2 vs. 7.2 GW); values are used as published, so Germany's shares since 2022 are rather understated",
        },
        "files": {name: {"sha256": sha256(content), "bytes": len(content), "columns": CONTRACTS[name],
                         "rows": content.count(b"\n") - 1} for name, content in sorted(files.items())},
    }
    files[MANIFEST] = json_bytes(metadata)
    return files


def verify_set(directory: Path) -> dict:
    metadata = json.loads((directory / MANIFEST).read_bytes())
    require(metadata.get("schema_version") == 1 and metadata.get("kind") == "frozen_pv_lernkurve_article", "Manifest schema/kind mismatch")
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
    with tempfile.TemporaryDirectory(prefix=".pv-lernkurve-stage-", dir=output.parent) as temporary:
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


def export(database=DEFAULT_DATABASE, output_dir=DEFAULT_OUTPUT) -> dict:
    with duckdb.connect(str(database), read_only=True, config={"threads": 1}) as db:
        files = build_payloads(db)
    promote(files, Path(output_dir))
    return json.loads(files[MANIFEST])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    metadata = export(args.database, args.output_dir)
    print(f"Validated {len(metadata['files'])} files + {MANIFEST}; output {args.output_dir}")


if __name__ == "__main__":
    main()
