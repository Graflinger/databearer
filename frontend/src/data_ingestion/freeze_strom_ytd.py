"""Offline, deterministic article evidence. Always read the original Git snapshot.

Run from frontend: python3 src/data_ingestion/freeze_strom_ytd.py
No network, no dashboard writes.
"""

import csv
import hashlib
import io
import json
import math
from datetime import date, timedelta
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
ENTITY = Path(__file__).parent / "data/2026/strom_ytd"
COMMIT = "66035ab8b186fe975a55d065982a00963e3cee93"
COMMIT_TIME = "2026-10-02T12:05:34Z"
SOURCE_LAST_DATE = "2026-10-01"
END_MONTH, END_DAY = 9, 30
HISTORY = "frontend/src/data-history/german-electricity/"
RENEWABLE = ["biomass", "hydro", "wind_offshore", "wind_onshore", "solar", "other_renewables"]
CONVENTIONAL = ["lignite", "hard_coal", "gas", "other_conventional", "pumped_storage", "nuclear"]
KEYS = RENEWABLE + CONVENTIONAL
QUARTERS = [("Q1", (1, 1), (3, 31)), ("Q2", (4, 1), (6, 30)), ("Q3", (7, 1), (9, 30))]


def git_bytes(path):
    return subprocess.check_output(["git", "show", f"{COMMIT}:{path}"], cwd=ROOT)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def csv_bytes(rows):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode()


def window(rows, year, start, end):
    first, last = date(year, *start), date(year, *end)
    dates = [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]
    selected = [r for r in rows if dates[0] <= r["date"] <= dates[-1]]
    assert [r["date"] for r in selected] == dates, f"Missing/duplicate dates: {year} {start}-{end}"
    return selected


def build_package():
    manifest_raw = git_bytes(HISTORY + "manifest.json")
    history = json.loads(manifest_raw)
    assert history["last_date"] == SOURCE_LAST_DATE
    sources = [{"path": HISTORY + "manifest.json", "sha256": digest(manifest_raw), "bytes": len(manifest_raw)}]
    periods, mixes, comparison, quarters = [], [], [], {}
    for entry in history["years"]:
        year = entry["year"]
        if year < 2019:
            continue
        source_path = HISTORY + entry["url"].split("/")[-1]
        raw = git_bytes(source_path)
        assert digest(raw) == entry["sha256"]
        sources.append({"path": source_path, "sha256": digest(raw), "bytes": len(raw)})
        all_rows = json.loads(raw)["rows"]
        rows = window(all_rows, year, (1, 1), (END_MONTH, END_DAY))
        for row in rows:
            assert row["price_zone"] == "DE-LU"
            assert isinstance(row["price_eur_mwh"], (int, float)) and math.isfinite(row["price_eur_mwh"])
            # Europe/Berlin: last Sunday in March is a 23-hour day; the window ends before October.
            day = date.fromisoformat(row["date"])
            spring = day.month == 3 and day.weekday() == 6 and day.day >= 25
            assert row["hours"] == (23 if spring else 24)
            assert all(isinstance(row["energy_gwh"][k], (int, float)) and math.isfinite(row["energy_gwh"][k]) and row["energy_gwh"][k] >= 0 for k in KEYS + ["load"])
        totals = {k: sum(r["energy_gwh"][k] for r in rows) / 1000 for k in KEYS + ["load"]}
        total, renewable = sum(totals[k] for k in KEYS), sum(totals[k] for k in RENEWABLE)
        hours = sum(r["hours"] for r in rows)
        numerator = sum(r["price_eur_mwh"] * r["hours"] for r in rows)
        periods.append({
            "year": year, "start": rows[0]["date"], "end": rows[-1]["date"], "days": len(rows),
            "energy_days": len(rows), "price_days": len(rows), "hours": hours,
            "generation_twh": f"{total:.6f}", "renewable_twh": f"{renewable:.6f}",
            "renewable_share_pct": f"{100 * renewable / total:.6f}", "load_twh": f"{totals['load']:.6f}",
            "price_hour_sum": f"{numerator:.6f}", "price_eur_mwh": f"{numerator / hours:.6f}",
            "negative_mean_days": sum(r["price_eur_mwh"] < 0 for r in rows),
        })
        for key in KEYS:
            mixes.append({"year": year, "source": key, "generation_twh": f"{totals[key]:.6f}"})
        if year in (2025, 2026):
            comparison.append({"year": year, "wind_onshore_twh": f"{totals['wind_onshore']:.6f}",
                               "solar_twh": f"{totals['solar']:.6f}",
                               "other_twh": f"{total - totals['wind_onshore'] - totals['solar']:.6f}"})
            for label, start, end in QUARTERS:
                part = window(rows, year, start, end)
                q_hours = sum(r["hours"] for r in part)
                q_numerator = sum(r["price_eur_mwh"] * r["hours"] for r in part)
                quarters.setdefault(label, {"quarter": label})
                quarters[label].update({
                    f"days_{year}": len(part), f"hours_{year}": q_hours,
                    f"price_hour_sum_{year}": f"{q_numerator:.6f}",
                    f"price_{year}": f"{q_numerator / q_hours:.6f}",
                    f"wind_onshore_{year}": f"{sum(r['energy_gwh']['wind_onshore'] for r in part) / 1000:.6f}",
                    f"solar_{year}": f"{sum(r['energy_gwh']['solar'] for r in part) / 1000:.6f}",
                })
    assert len(periods) == 8
    payloads = {"periods.csv": csv_bytes(periods), "mix_by_year.csv": csv_bytes(mixes),
                "comparison.csv": csv_bytes(comparison), "quarters.csv": csv_bytes(list(quarters.values()))}
    metadata = {
        "schema_version": 2, "entity": "strom_ytd", "methodology_version": "same-calendar-window-v2",
        "source_commit": COMMIT, "source_commit_time": COMMIT_TIME,
        "source_last_date": SOURCE_LAST_DATE, "observation_cutoff": f"2026-{END_MONTH:02d}-{END_DAY:02d}",
        "prepared_on": "2026-10-03",
        "upstream_retrieved_at": None, "timezone": "Europe/Berlin", "price_zone": "DE-LU",
        "source": history["source"], "source_files": sources,
        "editorial_sources": [
            {"url": "https://www.smard.de/page/home/wiki-article/446/384/so-funktioniert-der-strommarkt", "scope": "Merit order and day-ahead market", "consulted_on": "2026-10-03"},
            {"url": "https://www.smard.de/page/home/topic-article/444/209624", "scope": "Full year 2022: gas crisis, price-setting gas plants, French nuclear availability", "consulted_on": "2026-10-03"},
            {"url": "https://www.smard.de/page/home/topic-article/444/220298/nettoexport-von-strom-im-ersten-quartal", "scope": "Q1 2026 versus Q1 2025: lower price from high renewables and lower quarterly gas prices; gas up from late February", "consulted_on": "2026-10-03"},
            {"url": "https://www.smard.de/page/home/topic-article/444/221002/erzeugung-und-verbrauch-leicht-gestiegen", "scope": "Q2 2026 versus Q2 2025: gas prices up about 25 percent, more conventional generation, June heat wave", "consulted_on": "2026-10-03"},
        ],
        "exporter": "frontend/src/data_ingestion/freeze_strom_ytd.py",
        "units": {"energy": "TWh", "source_energy": "GWh", "share": "% of public net generation",
                  "price": "EUR/MWh, nominal", "price_hour_sum": "(EUR/MWh)*h", "hours": "h"},
        "coverage": {"years": list(range(2019, 2027)), "start_month_day": "01-01",
                     "end_month_day": f"{END_MONTH:02d}-{END_DAY:02d}",
                     "leap_day": "included; 274 days in 2020/2024, otherwise 273",
                     "quarters": "2025 and 2026: Q1-Q3, calendar quarters, reconciled to the period totals",
                     "missing_energy_days": 0, "missing_price_days": 0},
        "methodology": {
            "energy": "Sum daily GWh / 1000; generation includes all 12 sources including pumped storage and nuclear, excludes load.",
            "renewable": "Sum biomass, hydro, wind_offshore, wind_onshore, solar, other_renewables / total generation; no mean of daily shares.",
            "price": "Sum(daily price_eur_mwh * hours) / sum(hours); source daily prices are rounded; no load weighting.",
            "missing": "Reject missing dates, energy or prices; no gap filling. Preserve source-derived nuclear zero after 2023-04-15.",
            "scope": "Public net generation DE; no PV self-consumption, industrial or railway grids. Not gross consumption or retail prices.",
            "limitations": "Daily source sums can include upstream partial data/interpolation; the latest 35 days were still inside the dashboard correction window when frozen. No causal attribution from these aggregates.",
        },
        "payloads": {},
    }
    for name, raw in payloads.items():
        parsed = list(csv.reader(io.StringIO(raw.decode())))
        metadata["payloads"][name] = {"sha256": digest(raw), "bytes": len(raw), "rows": len(parsed) - 1, "columns": parsed[0]}
    return payloads, metadata


if __name__ == "__main__":
    payloads, metadata = build_package()
    # All sources and aggregates validated before writing; stale payloads removed; manifest promoted last.
    for stale in ENTITY.glob("*.csv"):
        if stale.name not in payloads:
            stale.unlink()
    for name, raw in payloads.items():
        (ENTITY / name).write_bytes(raw)
    (ENTITY / "manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    for name in ("periods.csv", "comparison.csv", "quarters.csv"):
        print(payloads[name].decode())
