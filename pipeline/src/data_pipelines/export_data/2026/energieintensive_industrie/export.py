"""Manual, bounded frozen-article export. Standard library only; no dashboard hooks.

Run from pipeline/, see docs/energieintensive_industrie.md. --fetch downloads the
three reviewed public sources into ignored storage; offline reruns use their hashes.
"""

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

CONTRACT = Path(__file__).with_name("source_contract.json")
FIRST, LAST = "2018-01", "2026-08"
PRICE_LAST = "2026-S1"
COLUMNS = {
    "production.csv": ["Monat", "Industrie", "Energieintensiv"],
    "electricity_prices.csv": ["Halbjahr", "Deutschland_ct_kWh", "EU27_ct_kWh", "Deutschland_Status", "EU27_Status"],
    "production_annual.csv": ["Zeitraum", "Monate", "Industrie", "Energieintensiv"],
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def months(first, last):
    y, m = map(int, first.split("-"))
    result = []
    while f"{y:04}-{m:02}" <= last:
        result.append(f"{y:04}-{m:02}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return result


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            require(self.table is None, "Nested source table")
            self.table = []
        elif self.table is not None and tag == "tr":
            self.row = []
        elif self.row is not None and tag in ("td", "th"):
            self.cell = ""

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def production_rows(text):
    parser = Tables()
    parser.feed(text)
    candidates = [t for t in parser.tables if t and t[0] == ["Datum", "industrie", "energieintens_industrie"]]
    require(len(candidates) == 1, "Production source header changed")
    found = {}
    for row in candidates[0][1:]:
        require(len(row) == 3, "Ragged production row")
        date = datetime.strptime(row[0], "%Y/%m/%d")
        require(date.day == 1, "Not a monthly date")
        month = date.strftime("%Y-%m")
        require(month not in found, "Duplicate production month")
        values = [float(v.replace(",", ".")) for v in row[1:]]
        require(all(math.isfinite(v) and 0 < v < 200 for v in values), "Invalid production index")
        found[month] = values
    require(max(found) == LAST, "Source cutoff changed: review article and manifest together")
    require(all(m in found for m in months(FIRST, LAST)), "Missing production month")
    return [[m, *found[m]] for m in months(FIRST, LAST)]


def price_rows(data):
    expected = {"freq": ["S"], "siec": ["E7000"], "nrg_cons": ["MWH2000-19999"],
                "unit": ["KWH"], "tax": ["X_VAT"], "currency": ["EUR"],
                "geo": ["DE", "EU27_2020"],
                "time": [f"{y}-S{s}" for y in range(2018, 2027) for s in (1, 2) if f"{y}-S{s}" <= PRICE_LAST]}
    require(set(data["id"]) == set(expected), "Unexpected price dimensions")
    require(data["source"] == "ESTAT", "Unexpected price source")
    require(len(data["size"]) == len(data["id"]), "Price dimension sizes missing")
    indices = {}
    for dim, size in zip(data["id"], data["size"]):
        indices[dim] = data["dimension"][dim]["category"]["index"]
        require(set(indices[dim]) == set(expected[dim]), f"Wrong price selection: {dim}")
        require(sorted(indices[dim].values()) == list(range(size)), "Invalid price index positions")
    rows = []
    for period in expected["time"]:
        values, statuses = [], []
        for geo in expected["geo"]:
            pos = 0
            for dim, size in zip(data["id"], data["size"]):
                key = period if dim == "time" else geo if dim == "geo" else expected[dim][0]
                pos = pos * size + indices[dim][key]
            value = data["value"].get(str(pos))
            require(type(value) in (int, float) and math.isfinite(value) and value > 0, "Missing/invalid price; never fill with zero")
            status = data.get("status", {}).get(str(pos), "")
            require(status in ("", "p"), "New price flag requires editorial review")
            values.append(round(value * 100, 2))
            statuses.append(status)
        rows.append([period, *values, *statuses])
    return rows


def summary(production, prices):
    indexed = {r[0]: r[1:] for r in production}
    mean = lambda group, col: sum(indexed[m][col] for m in group) / len(group)
    annual = []
    for year in range(2018, 2027):
        group = [m for m in indexed if m.startswith(str(year))]
        annual.append([str(year) if year < 2026 else "2026 Jan–Aug", len(group), *[round(mean(group, c), 3) for c in (0, 1)]])
    changes = {}
    for col, label in enumerate(("industry", "energy_intensive")):
        value = indexed[LAST][col]
        changes[label] = {
            "latest": value,
            "vs_february_2022_pct": (value / indexed["2022-02"][col] - 1) * 100,
            "vs_2018_mean_pct": (value / mean(months("2018-01", "2018-12"), col) - 1) * 100,
            "vs_2021_mean_pct": (value / mean(months("2021-01", "2021-12"), col) - 1) * 100,
            "month_on_month_pct": (value / indexed["2026-07"][col] - 1) * 100,
            "three_month_pct": (mean(months("2026-06", "2026-08"), col) / mean(months("2026-03", "2026-05"), col) - 1) * 100,
        }
    changes["prices"] = {
        "de_latest_ct_kwh": prices[-1][1], "eu_latest_ct_kwh": prices[-1][2],
        "de_premium_pct": (prices[-1][1] / prices[-1][2] - 1) * 100,
        "de_vs_2025_s1_pct": (prices[-1][1] / prices[-3][1] - 1) * 100,
        "de_vs_2018_s1_pct": (prices[-1][1] / prices[0][1] - 1) * 100,
    }
    # Check rates against independently published press release; rounded source
    # levels cannot always reproduce rates calculated on unrounded source data.
    require(abs(changes["energy_intensive"]["month_on_month_pct"] + .5) < .1, "Press month-on-month mismatch")
    require(abs(changes["energy_intensive"]["three_month_pct"] + 2.9) < .15, "Press three-month mismatch")
    return annual, changes


def csv_bytes(name, rows):
    text = io.StringIO(newline="")
    writer = csv.writer(text, lineterminator="\n")
    writer.writerow(COLUMNS[name])
    for row in rows:
        writer.writerow([f"{v:.3f}" if isinstance(v, float) else v for v in row])
    return text.getvalue().encode()


def press_evidence(text):
    text = " ".join(unescape(re.sub(r"<[^>]+>", " ", text)).split())
    require("Pressemitteilung Nr. 355 vom 7. Oktober 2026" in text, "Press release identity changed")
    patterns = {
        "energy_intensive_mom_sa_ca_pct": (r"In den energieintensiven Industriezweigen ist die Produktion im August 2026 gegenüber Juli 2026 saison- und kalenderbereinigt um ([\d,]+) % gesunken", -1),
        "energy_intensive_three_month_sa_ca_pct": (r"Im Dreimonatsvergleich war die Produktion in den energieintensiven Industriezweigen von Juni bis August 2026 um ([\d,]+) % niedriger", -1),
        "energy_intensive_yoy_ca_pct": (r"Verglichen mit dem Vorjahresmonat August 2025 war die energieintensive Produktion im August 2026 kalenderbereinigt um ([\d,]+) % niedriger", -1),
        "energy_use_share_2021_pct_as_reported": (r"Bezogen auf das Berichtsjahr 2021 benötigten sie zusammen ([\d,]+) % des gesamten industriellen Energieverbrauchs", 1),
        "gross_value_added_share_2021_pct_as_reported": (r"Ihr Anteil an der industriellen Bruttowertschöpfung betrug ([\d,]+) %", 1),
    }
    values = {}
    for key, (pattern, sign) in patterns.items():
        matches = re.findall(pattern, text)
        require(len(matches) == 1, f"Missing/ambiguous press statement: {key}")
        values[key] = sign * float(matches[0].replace(",", "."))
    require(values == {"energy_intensive_mom_sa_ca_pct": -.5, "energy_intensive_three_month_sa_ca_pct": -2.9,
                       "energy_intensive_yoy_ca_pct": -2.1, "energy_use_share_2021_pct_as_reported": 77,
                       "gross_value_added_share_2021_pct_as_reported": 17}, "Press values changed: review article")
    return values


def fetch_sources(raw, contract):
    raw.mkdir(parents=True, exist_ok=True)
    evidence = {}
    for key, source in contract["sources"].items():
        request = Request(source["url"], headers={"User-Agent": "Databearer article research"})
        with urlopen(request, timeout=90) as response:
            require(response.status == 200, "Source did not return HTTP 200")
            payload = response.read(5_000_001)
        require(0 < len(payload) <= 5_000_000, "Source size limit exceeded")
        (raw / f"{key}.raw").write_bytes(payload)
        evidence[key] = {"url": source["url"], "retrieved_at": datetime.now(timezone.utc).isoformat(),
                         "sha256": sha(payload), "bytes": len(payload)}
    (raw / "acquisition.json").write_text(json.dumps(evidence, indent=2) + "\n")


def export(raw, output):
    contract = json.loads(CONTRACT.read_text())
    evidence = json.loads((raw / "acquisition.json").read_text())
    payloads = {}
    for key, source in contract["sources"].items():
        payloads[key] = (raw / f"{key}.raw").read_bytes()
        require(evidence[key]["sha256"] == sha(payloads[key]) and evidence[key]["bytes"] == len(payloads[key]), "Raw source hash mismatch")
        require(evidence[key]["url"] == source["url"], "Acquisition URL mismatch")
        require(evidence[key]["retrieved_at"].startswith(contract["reviewed_at"]), "New retrieval date requires licence/editorial review")
        source["acquisition"] = evidence[key]
    production = production_rows(payloads["production"].decode())
    price_data = json.loads(payloads["prices"])
    prices = price_rows(price_data)
    contract["sources"]["prices"]["updated"] = price_data["updated"]
    annual, calculated = summary(production, prices)
    press = press_evidence(payloads["press"].decode())
    quality = {
        "schema_version": 1,
        "production_months": len(production), "price_semesters": len(prices),
        "missing_values": 0, "duplicate_keys": 0,
        "calculated": calculated,
        "press_release": press,
        "notes": ["Press rates use unrounded source levels; exported chart levels have one source decimal.",
                  "Year-on-year press rate is calendar adjusted, not calculated from the seasonally adjusted chart.",
                  "77% is reported by the press release; an older Destatis explanatory appendix shows 76%. No independent recomputation.",
                  "August 2026 production and Germany 2026-S1 price are provisional."]
    }
    files = {name: csv_bytes(name, rows) for name, rows in zip(COLUMNS, (production, prices, annual))}
    files["quality.json"] = (json.dumps(quality, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    manifest = {"schema_version": 1, "kind": "frozen_energieintensive_industrie", "methodology_version": 1,
                "period": {"production_first": FIRST, "production_last": LAST, "prices_first": "2018-S1", "prices_last": PRICE_LAST},
                "exporter": "pipeline/src/data_pipelines/export_data/2026/energieintensive_industrie/export.py",
                "contract_sha256": sha(CONTRACT.read_bytes()), **contract, "files": {}}
    for name, data in files.items():
        manifest["files"][name] = {"sha256": sha(data), "bytes": len(data)}
        if name in COLUMNS:
            manifest["files"][name].update(columns=COLUMNS[name], rows=len(list(csv.reader(io.StringIO(data.decode())))) - 1)
    # Validate fully before staging replacement. Manifest last; a frontend validator
    # rejects interrupted/mixed sets. This is not directory-level atomicity.
    output.mkdir(parents=True, exist_ok=True)
    require(set(p.name for p in output.iterdir()) <= set(files) | {"manifest.json"}, "Unexpected files in output")
    files["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    for name, data in files.items():
        temporary = output / (name + ".tmp")
        temporary.write_bytes(data)
        os.replace(temporary, output / name)
    return quality


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--raw", type=Path, default=Path(".data/raw/energieintensive_industrie"))
    parser.add_argument("--output", type=Path, default=Path(".data/output/energieintensive_industrie"))
    args = parser.parse_args()
    if args.fetch:
        fetch_sources(args.raw, json.loads(CONTRACT.read_text()))
    print(json.dumps(export(args.raw, args.output), ensure_ascii=False, indent=2))
