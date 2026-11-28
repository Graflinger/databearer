"""Bounded Eurostat evidence export; run from pipeline/. No live frontend fetches.

The inputs are already published aggregates: select/pivot them directly without
creating a persistent database or unrelated dbt models. See the topic runbook.
"""

import argparse
import csv
import hashlib
import io
import itertools
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen


API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
COPYRIGHT = "https://ec.europa.eu/eurostat/web/main/help/copyright-notice"
QUERIES = {
    "dependency": "nrg_ind_id?lang=EN&geo=DE&geo=EU27_2020&siec=G3000&siec=TOTAL&siec=O4000XBIO&siec=C0000X0350-0370&sinceTimePeriod=1990&untilTimePeriod=2024",
    "partners": "nrg_ti_gas?lang=EN&geo=DE&unit=TJ_GCV&sinceTimePeriod=2021&untilTimePeriod=2024",
    "monthly": "nrg_cb_gasm?lang=EN&geo=DE&geo=EU27_2020&unit=TJ_GCV&nrg_bal=IMP&nrg_bal=EXP&nrg_bal=IPRD&nrg_bal=IC_OBS&nrg_bal=IC_CAL_MG&nrg_bal=STK_CHG_MG&sinceTimePeriod=2024&untilTimePeriod=2025",
}
PARTNERS = ["RU", "NO", "NL", "BE", "US", "FR", "NSP"]
BALANCES = ["IMP", "EXP", "IPRD", "IC_OBS", "IC_CAL_MG", "STK_CHG_MG"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode(document):
    """Decode JSON-stat by explicit category indices, not dictionary order."""
    axes = []
    for dimension, size in zip(document["id"], document["size"]):
        index = document["dimension"][dimension]["category"]["index"]
        require(sorted(index.values()) == list(range(size)), "Invalid axis")
        axes.append(sorted(index, key=index.get))
    rows = []
    values, flags = document["value"], document.get("status", {})
    for index, codes in enumerate(itertools.product(*axes)):
        value = values.get(str(index)) if isinstance(values, dict) else values[index]
        flag = flags.get(str(index), "") if isinstance(flags, dict) else flags[index]
        rows.append(dict(zip(document["id"], codes), value=value, flag=flag))
    return rows


def select(rows, **keys):
    selected = [row for row in rows if all(row.get(k) == v for k, v in keys.items())]
    require(len(selected) == 1, f"Expected unique observation: {keys}")
    row = selected[0]
    require(isinstance(row["value"], (int, float)) and math.isfinite(row["value"]), f"Missing/nonfinite observation: {keys}")
    require(row["flag"] in ("", "p", "e"), f"Review source flag: {row}")
    return row["value"]


def export(raw_dir, output):
    sources, tables = {}, {}
    for name, query in QUERIES.items():
        raw = (raw_dir / f"{name}.json").read_bytes()
        receipt = json.loads((raw_dir / f"{name}.receipt.json").read_text())
        require(receipt["url"] == API + query and receipt["sha256"] == sha(raw), "Raw receipt mismatch")
        document = json.loads(raw)
        require(document["source"] == "ESTAT", "Unexpected source")
        code = query.split("?")[0]
        sources[name] = {
            **receipt, "dataset": code, "source_updated_at": document["updated"],
            "doi": f"https://doi.org/10.2908/{code.upper()}",
            "license_id": "eurostat-data-reuse-2011-833",
            "source_description": document["extension"].get("description", ""),
            "attribution": f"Quelle: Eurostat, https://ec.europa.eu/eurostat/databrowser/view/{code}/default/table, Abruf {receipt['retrieved_at'][:10]}. © Europäische Union.",
        }
        tables[name] = decode(document)

    payloads = {}

    def csv_file(name, columns, rows):
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(columns)
        for row in rows:
            require(len(row) == len(columns), "Ragged output")
            writer.writerow([f"{v:.6f}" if isinstance(v, float) else v for v in row])
        payloads[name] = (buffer.getvalue().encode(), {"columns": columns, "rows": len(rows)})

    dependency = []
    for year in range(1990, 2025):
        keys = [("DE", "G3000"), ("EU27_2020", "G3000"), ("DE", "O4000XBIO"), ("DE", "C0000X0350-0370"), ("DE", "TOTAL")]
        dependency.append([year] + [select(tables["dependency"], freq="A", geo=g, siec=s, unit="PC", time=str(year)) for g, s in keys])
    csv_file("dependency.csv", ["Jahr", "Gas_DE_PC", "Gas_EU_PC", "Oel_DE_PC", "Kohle_DE_PC", "Gesamt_DE_PC"], dependency)

    partner_rows = []
    compare = {}
    for year in range(2021, 2025):
        def partner(code, product="G3000"):
            return select(tables["partners"], freq="A", geo="DE", siec=product, unit="TJ_GCV", partner=code, time=str(year))
        total = partner("TOTAL")
        values = [partner(code) for code in PARTNERS]
        require(abs(sum(values) - total) < 0.01, f"Partner reconciliation failed: {year}")
        # Verify every omitted partner is an explicit zero, never fill missing data.
        omitted = [r for r in tables["partners"] if r["time"] == str(year) and r["siec"] == "G3000" and r["partner"] not in PARTNERS + ["TOTAL"]]
        require(all(r["value"] == 0 and not r["flag"] for r in omitted), "Unexpected omitted partner")
        lng, us_lng = partner("TOTAL", "G3200"), partner("US", "G3200")
        require(0 <= us_lng <= lng <= total, "LNG subset mismatch")
        partner_rows.append([year, total, *values, lng, us_lng])
        compare[year] = [v / 3600 for v in [*values[:5], values[5] + values[6]]]
    csv_file("partners.csv", ["Jahr", "TOTAL_TJ", *[p + "_TJ" for p in PARTNERS], "LNG_TJ", "US_LNG_TJ"], partner_rows)
    csv_file("partner_comparison.csv", ["Partner", "Jahr_2021_TWh", "Jahr_2024_TWh"], [
        [label, compare[2021][i], compare[2024][i]] for i, label in enumerate(["Russland", "Norwegen", "Niederlande", "Belgien", "USA", "Rest / unbestimmt"])
    ])

    monthly, annual, summaries = [], [], {}
    for geo in ["DE", "EU27_2020"]:
        summaries[geo] = {}
        for year in [2024, 2025]:
            sums = dict.fromkeys(BALANCES, 0.0)
            for month in range(1, 13):
                period = f"{year}-{month:02d}"
                values = [select(tables["monthly"], freq="M", geo=geo, siec="G3000", unit="TJ_GCV", nrg_bal=b, time=period) for b in BALANCES]
                monthly.append([geo, period, *values])
                for balance, value in zip(BALANCES, values):
                    sums[balance] += value
            net = sums["IMP"] - sums["EXP"]
            # The Statistics Explained rate uses observed, not calculated demand.
            rate = net / sums["IC_OBS"] * 100
            summaries[geo][str(year)] = {**sums, "NET_TJ": net, "NET_OBS_PC": rate}
            if geo == "DE":
                require(abs(sums["IPRD"] + net - sums["STK_CHG_MG"] - sums["IC_CAL_MG"]) < 0.01, "German gas balance mismatch")
                annual.append([year, sums["IMP"] / 3600, sums["EXP"] / 3600, net / 3600, sums["IPRD"] / 3600, sums["IC_OBS"] / 3600, sums["STK_CHG_MG"] / 3600])
    csv_file("monthly.csv", ["Geo", "Monat", *[b + "_TJ" for b in BALANCES]], monthly)
    csv_file("balance_de.csv", ["Jahr", "Import_TWh", "Export_TWh", "Netto_TWh", "Foerderung_TWh", "Verbrauch_TWh", "Speicheraenderung_TWh"], annual)
    flags = [{"source": name, **row} for name, rows in tables.items() for row in rows if row["flag"]]
    quality = {"schema_version": 1, "complete_months_per_geo_year": 12, "summaries": summaries, "source_flags": flags,
               "partner_sums_reconciled": True, "missing_values_imputed": 0,
               "caveat": "Reported partners are not a verified molecular origin map. Monthly stock changes: negative means drawdown. Monthly rates are not nrg_ind_id."}
    payloads["quality.json"] = ((json.dumps(quality, ensure_ascii=False, indent=2) + "\n").encode(), {})

    license_audit = {
        "checked_on": "2026-11-05", "name": "Eurostat free re-use policy / Commission Decision 2011/833/EU",
        "version": "2011/833/EU; no separately numbered statistical-data licence", "terms_url": COPYRIGHT,
        "legal_basis": "https://eur-lex.europa.eu/eli/dec/2011/833/oj",
        "commission_notice": "https://commission.europa.eu/legal-notice_en",
        "status": "permitted_with_attribution_and_modification_notice",
        "commercial_reuse": True, "public_repository_derived_data": True,
        "required_attribution_template": "Source: [Eurostat dataset datacode link], [access date]",
        "modification_notice": "Eigene Auswahl, Umrechnung und Darstellung. Eurostat ist für diese Bearbeitung nicht verantwortlich.",
        "database_rights": "Express statistical-data extraction/reuse permission; no claim of public domain or waiver of all database rights.",
        "third_party_rights": "No identified third-party works, logos, photographs or restrictive dataset notices used. Energy metadata section 6.2 explicitly confirms commercial free reuse.",
        "territorial_exceptions": "Only DE and EU27_2020 reporting geographies. Partner US/RU observations are German declarations, not third-country own statistics. No CH/LI reporting trade or Austrian CN8 data.",
        "editorial_content_license": "CC BY 4.0 International (not used to relabel statistical CSVs)",
        "editorial_content_terms": COPYRIGHT,
        "publisher_metadata": "https://ec.europa.eu/eurostat/cache/metadata/en/nrg_prd_esms.htm",
        "not_used": ["GIE AGSI+/ALSI", "Bruegel", "BNetzA gas data", "AG Energiebilanzen", "BMWK FAQ", "nrg_ind_idogas", "nrg_cb_gas"],
        "not_used_reason": "No data incorporated; Eurostat selected aggregates suffice. No permission inferred for other publishers.",
    }
    manifest = {
        "schema_version": 1, "kind": "frozen_gas_importe_article", "methodology_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(), "sources": sources,
        "licenses": {"eurostat-data-reuse-2011-833": license_audit},
        "context_sources": [{"title": "Natural gas supply statistics", "url": "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Natural_gas_supply_statistics&oldid=711429", "retrieved_on": "2026-11-05", "license": "CC BY 4.0 International", "modification": "Own summary, no publication translation"}],
        "coverage": {"dependency": [1990, 2024], "partners": [2021, 2024], "monthly": ["2024-01", "2025-12"], "reporting_geographies": ["DE", "EU27_2020"], "timezone": "calendar years/months as reported; retrieval UTC"},
        "units": {"dependency": "percent; not capped at 100", "source_energy": "TJ gross calorific value", "chart_energy": "TWh gross calorific value = TJ / 3600"},
        "missing_values": "Required observations must be finite; no imputation. Explicit published zeros retained. Source status flags preserved in quality.json.",
        "exporter": "pipeline/src/data_pipelines/export_data/2026/gas_importe/export_gas_importe.py",
        "files": {name: {"sha256": sha(data), "bytes": len(data), **contract} for name, (data, contract) in payloads.items()},
    }
    # All semantic checks above finish before writing. Frontend promotion is a
    # separate explicit operation after the build-time validator accepts staging.
    output.mkdir(parents=True, exist_ok=True)
    require(not any(output.iterdir()), "Output must be an empty staging directory")
    for name, (data, _) in payloads.items():
        (output / name).write_bytes(data)
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summaries, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Fetch the three bounded, licence-reviewed API queries")
    parser.add_argument("--raw-dir", type=Path, default=Path(".data/gas_importe/frozen"))
    parser.add_argument("--output", type=Path, default=Path(".data/output/gas_importe"))
    args = parser.parse_args()
    if args.fetch:
        args.raw_dir.mkdir(parents=True, exist_ok=True)
        require(not any(args.raw_dir.iterdir()), "Fetch destination must be empty; preserve old raw evidence")
        for name, query in QUERIES.items():
            url = API + query
            with urlopen(url, timeout=90) as response:
                raw = response.read(5_000_001)
            require(len(raw) <= 5_000_000, "Response exceeds bounded download")
            receipt = {"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(), "sha256": sha(raw), "bytes": len(raw)}
            (args.raw_dir / f"{name}.json").write_bytes(raw)
            (args.raw_dir / f"{name}.receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    export(args.raw_dir, args.output)


if __name__ == "__main__":
    main()
