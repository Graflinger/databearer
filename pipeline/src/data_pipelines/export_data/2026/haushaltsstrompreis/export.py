"""Bounded Eurostat JSON-stat export of already-aggregated household prices.

Run from pipeline/ with PYTHONPATH=.; see docs/haushaltsstrompreis.md.
No DuckDB/dbt step is needed for three small published aggregate responses.
The default output and cached raw responses stay in ignored .data/.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import itertools
import json
import math
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
BAND = "KWH2500-4999"
COUNTRIES = dict(zip(
    "AT BE BG CY CZ DE DK EE EL ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK".split(),
    ["Österreich", "Belgien", "Bulgarien", "Zypern", "Tschechien", "Deutschland",
     "Dänemark", "Estland", "Griechenland", "Spanien", "Finnland", "Frankreich",
     "Kroatien", "Ungarn", "Irland", "Italien", "Litauen", "Luxemburg", "Lettland",
     "Malta", "Niederlande", "Polen", "Portugal", "Rumänien", "Schweden", "Slowenien", "Slowakei"],
))
PERIODS = [f"{y}-S{s}" for y in range(2008, 2027) for s in (1, 2) if (y, s) <= (2026, 1)]
CONTRACTS = {
    "verlauf.csv": ["Halbjahr", "Gesamt_ct_kWh", "Ohne_Steuern_ct_kWh", "Ohne_MwSt_ct_kWh", "Steuern_ct_kWh", "Steueranteil_Prozent"],
    "komponenten.csv": ["Jahr", "Energie_Vertrieb_ct_kWh", "Netze_ct_kWh", "Steuern_ct_kWh", "Gesamt_ct_kWh"],
    "eu.csv": ["Code", "Land", "Halbjahr", "Gesamt_ct_kWh", "Ohne_Steuern_ct_kWh", "Ohne_MwSt_ct_kWh", "Steuern_ct_kWh", "Steueranteil_Prozent"],
    "eu-auswahl.csv": ["Code", "Land", "Gesamt_ct_kWh"],
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def decode(dataset):
    """Decode sparse JSON-stat by explicit dimension indices, never object order."""
    require(dataset["class"] == "dataset" and dataset["source"] == "ESTAT", "Not an ESTAT dataset")
    axes = []
    for dim, size in zip(dataset["id"], dataset["size"], strict=True):
        index = dataset["dimension"][dim]["category"]["index"]
        require(sorted(index.values()) == list(range(size)), f"Invalid {dim} index")
        axes.append(sorted(index, key=index.get))
    rows = []
    for index, keys in enumerate(itertools.product(*axes)):
        value = dataset["value"].get(str(index))
        flag = dataset.get("status", {}).get(str(index), "")
        require(value is None or (not isinstance(value, bool) and math.isfinite(value)), "Invalid price")
        rows.append({**dict(zip(dataset["id"], keys)), "value": value, "flag": flag})
    return rows


def fetch(name, dataset, params, cache, offline):
    url = API + dataset + "?" + urlencode(params, doseq=True)
    raw_path, meta_path = cache / f"{name}.json", cache / f"{name}.request.json"
    if offline:
        raw, meta = raw_path.read_bytes(), json.loads(meta_path.read_text())
        require(meta["url"] == url, "Cached query changed")
        require(meta["sha256"] == hashlib.sha256(raw).hexdigest(), "Cached bytes changed")
    else:
        with urlopen(url, timeout=60) as response:
            raw = response.read(2_000_001)
        require(len(raw) <= 2_000_000, "Response exceeds 2 MB limit")
        meta = {"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
        cache.mkdir(parents=True, exist_ok=True)
        raw_path.write_bytes(raw)
        meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    data = json.loads(raw)
    require(data["extension"]["id"] == dataset.upper(), "Wrong dataset")
    require(any(a.get("type") == "SOURCE_INSTITUTIONS" and a.get("text") == "Eurostat"
                for a in data["extension"]["annotation"]), "Source ownership metadata changed")
    meta.update(dataset=dataset, updated=data["updated"],
                datacode_url=f"https://ec.europa.eu/eurostat/databrowser/view/{dataset}/default/table?lang=en",
                doi=f"https://doi.org/10.2908/{dataset}")
    return decode(data), meta


def cents(value):
    require(value is not None, "Missing required observation")
    return Decimal(str(value)) * 100


def tax_values(values):
    total, net, exvat = (cents(values[t]) for t in ("I_TAX", "X_TAX", "X_VAT"))
    require(total > 0 and net > 0 and exvat > 0, "Nonpositive end-user price")
    return [f"{v:.2f}" for v in (total, net, exvat, total - net)] + [f"{(total-net)/total*100:.2f}"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Reuse hashed raw cache, without changing acquisition dates")
    parser.add_argument("--cache-dir", type=Path, default=Path(".data/raw/haushaltsstrompreis"))
    parser.add_argument("--output-dir", type=Path, default=Path(".data/output/haushaltsstrompreis"))
    args = parser.parse_args()
    licenses = json.loads(Path(__file__).with_name("licenses.json").read_text())
    common = {"lang": "EN", "currency": "EUR", "nrg_cons": BAND}
    series_params = {**common, "freq": "S", "siec": "E7000", "unit": "KWH"}
    series, series_meta = fetch("de", "nrg_pc_204", {**series_params, "geo": "DE", "sinceTimePeriod": "2008-S1", "untilTimePeriod": "2026-S1"}, args.cache_dir, args.offline)
    components, components_meta = fetch("components", "nrg_pc_204_c", {**common, "freq": "A", "geo": "DE", "sinceTimePeriod": "2019", "untilTimePeriod": "2025"}, args.cache_dir, args.offline)
    eu, eu_meta = fetch("eu", "nrg_pc_204", {**series_params, "geo": [*COUNTRIES, "EU27_2020"], "time": "2026-S1"}, args.cache_dir, args.offline)
    require(all(r["nrg_cons"] == BAND and r["currency"] == "EUR" for r in series + components + eu), "Scope mismatch")
    used_flags = []

    def lookup(rows, selectors):
        found = [r for r in rows if all(r[k] == v for k, v in selectors.items())]
        require(len(found) == 1 and found[0]["value"] is not None, f"Missing/duplicate cell {selectors}")
        row = found[0]
        if row["flag"]:
            used_flags.append({**selectors, "flag": row["flag"]})
        return row["value"]

    def prices(rows, geo, time):
        return tax_values({t: lookup(rows, {"geo": geo, "time": time, "tax": t}) for t in ("I_TAX", "X_TAX", "X_VAT")})

    tables = {"verlauf.csv": [[period, *prices(series, "DE", period)] for period in PERIODS]}
    tables["komponenten.csv"] = []
    incomplete_subtax_years = []
    for year in range(2020, 2026):
        values = [cents(lookup(components, {"time": str(year), "nrg_prc": key}))
                  for key in ("NRG_SUP", "NETC", "TAX_FEE_LEV_CHRG")]
        # Subcomponents include VAT; adding VAT again would double count it.
        subrows = [r for r in components if r["time"] == str(year)
                   and r["nrg_prc"] in ("VAT", "TAX_RNW", "TAX_CAP", "TAX_ENV", "TAX_NUC", "OTH")]
        require(len(subrows) == 6, "Unexpected subtax schema")
        if any(r["value"] is None for r in subrows):
            incomplete_subtax_years.append(year)
        else:
            require(abs(sum(cents(r["value"]) for r in subrows) - values[2]) <= Decimal("0.03"), "Tax subcomponents do not reconcile")
        half_totals = [cents(lookup(series, {"time": f"{year}-S{s}", "tax": "I_TAX"})) for s in (1, 2)]
        require(min(half_totals) - Decimal("0.03") <= sum(values) <= max(half_totals) + Decimal("0.03"), "Annual sum outside semester range")
        tables["komponenten.csv"].append([str(year), *[f"{v:.2f}" for v in [*values, sum(values)]]])
    names = {**COUNTRIES, "EU27_2020": "EU-27"}
    tables["eu.csv"] = [[geo, names[geo], "2026-S1", *prices(eu, geo, "2026-S1")] for geo in sorted(names)]
    by_code = {row[0]: row for row in tables["eu.csv"]}
    require(prices(series, "DE", "2026-S1") == prices(eu, "DE", "2026-S1"), "DE queries disagree")
    # Fixed editorial comparison: top three, official EU mean and bottom two.
    tables["eu-auswahl.csv"] = [["EU-27" if g == "EU27_2020" else g, by_code[g][1], by_code[g][3]] for g in ("IE", "DE", "BE", "EU27_2020", "MT", "HU")]
    expected_flags = [{"geo": g, "time": "2026-S1", "tax": t, "flag": "p"}
                      for g in ("MT", "PL") for t in ("I_TAX", "X_TAX", "X_VAT")]
    require(used_flags == expected_flags, f"Changed flags require editorial review: {used_flags}")
    payloads, files = {}, {}
    for name, rows in tables.items():
        buf = io.StringIO(newline="")
        writer = csv.writer(buf, lineterminator="\n")
        writer.writerow(CONTRACTS[name])
        writer.writerows(rows)
        raw = buf.getvalue().encode()
        payloads[name] = raw
        files[name] = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "rows": len(rows), "columns": CONTRACTS[name]}
    metadata = {
        "schema_version": 1, "kind": "frozen_haushaltsstrompreis_article", "methodology_version": "1.0.0",
        "exporter": "pipeline/src/data_pipelines/export_data/2026/haushaltsstrompreis/export.py",
        "scope": {"band": BAND, "currency": "EUR", "unit": "ct/kWh", "first_semester": PERIODS[0], "last_semester": PERIODS[-1], "component_years": list(range(2020, 2026)), "eu_period": "2026-S1", "timezone": "not applicable: source calendar half-years/years"},
        "sources": {"de": series_meta, "components": components_meta, "eu": eu_meta}, "licenses": licenses,
        "quality": {"source_flags": used_flags, "missing_required_cells": 0, "eu_members": 27,
                    "subtax_reconciliation_skipped_missing_nuclear_tax": incomplete_subtax_years,
                    "component_tax_subsum_tolerance_ct": 0.03,
                    "note": "2017/2018 component totals unavailable; 2019 excluded because Destatis collection began in S2 and the component sum matches S2 only. Missing values never zero-filled. Annual components are not arithmetic semester averages. No source revisions fetched during builds."},
        "files": files,
    }
    payloads["manifest.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    require(not set(p.name for p in args.output_dir.iterdir()) - set(payloads), "Unexpected output files")
    # All observations validated before writing; manifest last. JS validator must
    # also pass in staging before the package is copied to frontend evidence.
    for name, raw in payloads.items():
        temp = args.output_dir / (name + ".tmp")
        temp.write_bytes(raw)
        os.replace(temp, args.output_dir / name)
    print(json.dumps({"files": files, "flags": used_flags}, indent=2))


if __name__ == "__main__":
    main()
