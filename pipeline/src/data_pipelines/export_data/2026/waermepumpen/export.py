"""Bounded read-only Destatis export; run from pipeline/, then --promote explicitly.

These tiny publisher aggregates already have one observation per year. Direct
frozen export avoids unnecessary ingestion, credentials, DuckDB and dbt runs.
Raw responses stay in ignored staging; builds never fetch or refresh this package.
"""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import html
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[6]
STAGING = ROOT / "pipeline/.data/output/waermepumpen"
TARGET = ROOT / "frontend/src/data_ingestion/data/2026/waermepumpen"
VALIDATOR = ROOT / "frontend/src/data_ingestion/utils/waermepumpenValidation.js"
BASE = "https://www.destatis.de/"
SOURCES = {
    "trend": (BASE + "DE/Presse/Pressemitteilungen/Grafiken/Newsroom/2026/Interaktiv/Daten/20260610-waermepumpen.csv?__blob=value&v=1", "2026-06-10"),
    "press2024": (BASE + "DE/Presse/Pressemitteilungen/2024/06/PD24_N025_31_51.html", "2024-06-04"),
    "press2025": (BASE + "DE/Presse/Pressemitteilungen/2025/06/PD25_N031_31_51.html", "2025-06-04"),
    "press2026": (BASE + "DE/Presse/Pressemitteilungen/2026/06/PD26_N038_31_51.html", "2026-06-10"),
    "terms": (BASE + "DE/Service/Impressum/copyright-allgemein.html", None),
}
HEADERS = {
    "anteil.csv": ["Jahr", "Waermepumpen_Prozent", "Erdgas_Prozent"],
    "neubau.csv": ["Jahr", "Wohngebaeude_Insgesamt", "Waermepumpen_Prozent", "Waermepumpen_Gebaeude_Geschaetzt"],
    "genehmigungen.csv": ["Jahr", "Wohngebaeude_Genehmigt", "Waermepumpen_Prozent", "Erdgas_Prozent"],
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(source_id, raw_dir):
    url, publication = SOURCES[source_id]
    with urlopen(Request(url, headers={"User-Agent": "Databearer frozen aggregate export"}), timeout=30) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Unexpected source redirect")
        data = response.read(2_000_001)
    if not data or len(data) > 2_000_000:
        raise ValueError("Empty or oversized source")
    acquired = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    (raw_dir / source_id).write_bytes(data)
    return data, {"url": url, "publication_date": publication,
                  "retrieved_at": acquired, "sha256": digest(data), "bytes": len(data),
                  "publisher": "Statistisches Bundesamt (Destatis)",
                  "license_id": "destatis-copyright-allgemein"}


def text(data):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", data.decode("utf-8")))).strip()


def extract(pattern, body):
    match = re.search(pattern, body)
    if not match:
        raise ValueError(f"Publisher evidence changed: {pattern}")
    return Decimal(match.group(1).replace(" ", "").replace(",", "."))


def estimate(total, share):
    return int((Decimal(total) * Decimal(share) / 10000).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) * 100


def observations(raw):
    source_rows = list(csv.reader(io.StringIO(raw["trend"].decode("utf-8-sig")), delimiter=";"))
    if source_rows[0] != ["Jahr", "Erneuerbare Energie insgesamt", "Darunter Wärmepumpen", "Konventionelle Energie insgesamt", "Darunter Erdgas"]:
        raise ValueError("Publisher CSV header changed")
    trend = sorted([[int(r[0]), Decimal(r[2].replace(",", ".")), Decimal(r[4].replace(",", "."))] for r in source_rows[1:]])
    if [r[0] for r in trend] != list(range(2015, 2026)):
        raise ValueError("Publisher CSV years changed")
    press = {key: text(raw[key]) for key in ("press2024", "press2025", "press2026")}
    totals = {
        2023: extract(r"2023 fertiggestellten knapp ([\d ]+) Wohngebäude", press["press2024"]),
        2024: extract(r"2024 mit 69,4 % der rund ([\d ]+) fertiggestellten Wohngebäude", press["press2026"]),
        2025: extract(r"73,6 %\) der rund ([\d ]+) im Jahr 2025 fertiggestellten Wohngebäude", press["press2026"]),
    }
    counts = [[year, int(totals[year]), wp, estimate(totals[year], wp)] for year, wp, _ in trend if year in totals]
    permits = []
    for year, key, count_pattern in [
        (2024, "press2025", r"84,8 % der rund ([\d ]+) im Jahr 2024 genehmigten Wohngebäude"),
        (2025, "press2026", r"87,0 % der ([\d ]+) im Jahr 2025 genehmigten Wohngebäude"),
    ]:
        body = press[key]
        wp = extract(r"Sie sollen in ([\d,]+) % der genehmigten Neubauten als", body)
        gas = extract(r"Erdgas als häufigster konventioneller Energieträger spielt mit einem Anteil von ([\d,]+) %", body)
        permits.append([year, int(extract(count_pattern, body)), wp, gas])
    terms = text(raw["terms"])
    for phrase in ["Weiterverbreitung von Texten, Daten und Grafiken", "gewerbliche Zwecke erlaubt", "eigene Berechnung", "Nutzungsrechte Dritter"]:
        if phrase not in terms:
            raise ValueError("Publisher terms changed; review licensing before export")
    return {"anteil.csv": trend, "neubau.csv": counts, "genehmigungen.csv": permits}


def validate(directory):
    subprocess.run(["node", str(VALIDATOR), str(directory)], check=True, timeout=30)


def promote():
    package = STAGING / "package"
    validate(package)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    # File-by-file atomic replacement, manifest last, NOT a directory transaction.
    # Preserve last-good evidence; interrupted mixed packages fail validation.
    if TARGET.exists():
        validate(TARGET)
        backup = STAGING / "previous"
        if backup.exists():
            shutil.rmtree(backup)
        shutil.copytree(TARGET, backup)
    TARGET.mkdir(exist_ok=True)
    for name in [*HEADERS, "manifest.json"]:
        with tempfile.NamedTemporaryFile(dir=TARGET.parent, delete=False) as temporary:
            temporary.write((package / name).read_bytes())
            temporary_path = Path(temporary.name)
        temporary_path.replace(TARGET / name)
    validate(TARGET)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true", help="Validate/promote staging without fetching")
    args = parser.parse_args()
    if args.promote:
        promote()
        return
    STAGING.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="candidate-", dir=STAGING) as candidate:
        candidate = Path(candidate)
        raw_dir = candidate / "raw"
        raw_dir.mkdir()
        raw, sources = {}, {}
        for source_id in SOURCES:
            raw[source_id], sources[source_id] = fetch(source_id, raw_dir)
        package = candidate / "package"
        package.mkdir()
        write_package(package, observations(raw), sources)
        validate(package)
        for name in ["package", "raw"]:
            destination = STAGING / name
            if destination.exists():
                shutil.rmtree(destination)
            shutil.move(str(candidate / name), destination)
    print(f"Validated staging: {STAGING / 'package'}; use --promote explicitly")


def write_package(package, rows, sources):
    manifest = make_manifest(sources)
    for name, records in rows.items():
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(HEADERS[name])
        writer.writerows(records)
        data = buffer.getvalue().encode("utf-8")
        (package / name).write_bytes(data)
        manifest["files"][name] = {"sha256": digest(data), "bytes": len(data),
                                  "headers": HEADERS[name], "rows": len(records)}
    (package / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def make_manifest(sources):
    return {
        "schema_version": 1,
        "kind": "frozen_waermepumpen_article",
        "methodology_version": "1.0.0",
        "exporter": "pipeline/src/data_pipelines/export_data/2026/waermepumpen/export.py",
        "snapshot_date": "2026-11-05",
        "observation_cutoff": "2025-12-31",
        "geography": "Deutschland",
        "timezone": "Europe/Berlin",
        "scope": "Neue Wohngebäude, hauptsächliche Heizenergie; Gebäude, keine Geräteabsätze oder Wohnungen",
        "missing_values": "Keine fehlenden Werte zulässig; leere Felder sind Fehler, niemals Null oder null.",
        "methodology": {
            "estimate_formula": "round_half_up(total_buildings * heatpump_percent / 100 / 100) * 100",
            "estimate_unit": "Wohngebäude (geschätzt, auf 100 gerundet)",
            "rounding": "Quellenanteile auf 0,1 Prozentpunkte und Gebäudezahlen auf 100 gerundet; berechnete Gebäudezahlen sind Näherungen, keine exakten Zählwerte.",
            "permits": "Genehmigungen sind Planungen, keine Fertigstellungen; separate Population.",
        },
        "contracts": {
            "anteil.csv": {"grain": "Jahr × Deutschland × fertiggestellte neue Wohngebäude", "key": ["Jahr"], "years": list(range(2015, 2026)), "units": ["Jahr", "Prozent", "Prozent"], "nullable": [False] * 3, "source_ids": ["trend"]},
            "neubau.csv": {"grain": "Jahr × Deutschland × fertiggestellte neue Wohngebäude", "key": ["Jahr"], "years": [2023, 2024, 2025], "units": ["Jahr", "Wohngebäude (gerundet)", "Prozent", "Wohngebäude (geschätzt, auf 100 gerundet)"], "nullable": [False] * 4, "source_ids": ["trend", "press2024", "press2026"]},
            "genehmigungen.csv": {"grain": "Jahr × Deutschland × genehmigte neue Wohngebäude", "key": ["Jahr"], "years": [2024, 2025], "units": ["Jahr", "Wohngebäude (gerundet)", "Prozent", "Prozent"], "nullable": [False] * 4, "source_ids": ["press2025", "press2026"]},
        },
        "sources": sources,
        "licenses": [{
            "id": "destatis-copyright-allgemein",
            "name": "Destatis Copyright allgemein",
            "version": "unversioned",
            "url": SOURCES["terms"][0],
            "date_checked": "2026-11-05",
            "commercial_use": True,
            "public_repository_redistribution": True,
            "basis": "Ausdrückliche Erlaubnis zur Weiterverbreitung von Texten, Daten und Grafiken, auch gewerblich und via Internet, mit Quellennachweis; Änderungen und eigene Berechnungen kennzeichnen.",
            "third_party_caveat": "Explizit ausgewiesene Rechte Dritter und Kooperationsprodukte sind ausgenommen. Für die verwendeten Destatis-Zahlen und den CSV-Download keine abweichende Drittanbieterkennzeichnung festgestellt; keine Bilder oder fremden Grafiken übernommen.",
            "database_rights": "Keine eigenständige ausdrückliche Datenbankrechte-Klausel auf dieser Seite; Datenweiterverbreitung ist ausdrücklich erlaubt. Website-CSV ist kein GENESIS-Abruf und wird nicht pauschal als DL-DE lizenziert.",
            "attributions": [f"Quelle: Statistisches Bundesamt (Destatis), {key}, {source['url']}, veröffentlicht {source['publication_date']}, abgerufen {source['retrieved_at'][:10]}; eigene Darstellung / eigene Berechnung (geschätzte Wärmepumpen-Gebäude)." for key, source in sources.items() if key != "terms"],
        }],
        "context_source_licenses": json.loads(Path(__file__).with_name("context_licenses.json").read_text(encoding="utf-8")),
        "excluded_sources": [
            {"name": "BWP/BDH heat pump sales statistics and press releases", "status": "not-used-no-redistribution-licence", "license_clearance": False},
            {"name": "EHPA members data", "status": "not-accessed-not-used", "license_clearance": False},
            {"name": "IEA reports and datasets", "status": "not-used-not-license-reviewed", "license_clearance": False},
            {"name": "Eurostat household energy prices", "status": "not-used-not-license-reviewed", "license_clearance": False},
            {"name": "BAFA/KfW funding statistics", "status": "not-used-not-license-reviewed", "license_clearance": False},
        ],
        "files": {},
    }


if __name__ == "__main__":
    main()
