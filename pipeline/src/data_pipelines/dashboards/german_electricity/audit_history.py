"""Read-only live source audit; never publishes data. Run explicitly as a module."""

import argparse
from datetime import date, datetime, timedelta
import json
from pathlib import Path

from . import history as h


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", type=date.fromisoformat, default=datetime.now(h.BERLIN).date())
    parser.add_argument("--recent-snapshot", type=Path, default=h.DEFAULT_OUTPUT)
    args = parser.parse_args()
    client = h.DailyClient()
    snapshot, cutoff = h.recent_snapshot(args.recent_snapshot, args.as_of)
    observations = h.fetch_daily(client, list(range(2015, cutoff.year + 1)))
    missing = []
    for day in h.days(h.FIRST_DAY, cutoff):
        for column in h.ENERGY:
            if column == "nuclear" and day > h.SHUTDOWN:
                continue
            if observations[day.year][column].get(day) is None:
                missing.append(f"{day}/{column}")
        price_column = "price_old" if day < h.PRICE_SPLIT else "price"
        if day >= h.PRICE_START and observations[day.year][price_column].get(day) is None:
            missing.append(f"{day}/price")
    print(json.dumps({"missing": missing, "requests": client.requests, "bytes": client.bytes_downloaded}))
    weeks = {}
    for gap in missing:
        day_text, column = gap.split("/")
        day = date.fromisoformat(day_text)
        week = h.midnight_ms(day - timedelta(days=day.weekday()))
        series_id = h.ENERGY[column]
        key = series_id, week
        if key not in weeks:
            weeks[key] = client.get(f"https://www.smard.de/app/chart_data/{series_id}/DE/{series_id}_DE_hour_{week}.json")
        payload = weeks[key]
        points = [point for point in payload["series"] if h.midnight_ms(day) <= point[0] < h.midnight_ms(day + timedelta(days=1))]
        print(json.dumps({"gap": gap, "hourly_points": len(points), "null_hours": sum(p[1] is None for p in points)}))
    rows = h.make_rows(observations, date(cutoff.year, 1, 1), cutoff)
    print(json.dumps(h.compare_hourly(rows, snapshot)))
    print(json.dumps({"total_requests": client.requests, "total_bytes": client.bytes_downloaded}))


if __name__ == "__main__":
    main()
