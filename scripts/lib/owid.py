from __future__ import annotations

import csv
import json
from io import StringIO
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


USER_AGENT = "databearer-source-scout/1.0"


def get_json(url: str, params: dict[str, object] | None = None) -> dict:
    if params:
        url = f"{url}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def get_text_lines(url: str, max_lines: int) -> list[str]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    lines: list[str] = []
    with urlopen(request, timeout=30) as response:
        for index, raw_line in enumerate(response):
            if index >= max_lines:
                break
            lines.append(raw_line.decode("utf-8", errors="replace"))
    return lines


def search_charts(
    query: str,
    limit: int = 10,
    countries: str | None = None,
    topics: str | None = None,
    require_all_countries: bool = False,
) -> dict:
    params: dict[str, object] = {
        "q": query,
        "type": "charts",
        "hitsPerPage": max(1, min(limit, 100)),
    }
    if countries:
        params["countries"] = countries
        params["requireAllCountries"] = str(require_all_countries).lower()
    if topics:
        params["topics"] = topics
    return get_json("https://ourworldindata.org/api/search", params)


def search_pages(query: str, limit: int = 5) -> dict:
    return get_json(
        "https://ourworldindata.org/api/search",
        {"q": query, "type": "pages", "hitsPerPage": max(1, min(limit, 100))},
    )


def search_indicators(query: str, limit: int = 10, min_popularity: float | None = None) -> dict:
    params: dict[str, object] = {"q": query, "limit": max(1, min(limit, 50))}
    if min_popularity is not None:
        params["min_popularity"] = min_popularity
    return get_json("https://search.owid.io/indicators", params)


def slug_from_input(value: str) -> str:
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        path = parsed.path.rstrip("/")
        slug = path.split("/")[-1]
        for suffix in (".metadata.json", ".readme.md", ".config.json", ".values.json", ".csv", ".zip"):
            if slug.endswith(suffix):
                slug = slug[: -len(suffix)]
        return slug
    return value.strip().removesuffix(".csv").removesuffix(".metadata.json")


def chart_metadata(slug_or_url: str) -> dict:
    slug = slug_from_input(slug_or_url)
    return get_json(f"https://ourworldindata.org/grapher/{slug}.metadata.json")


def chart_csv_sample(slug_or_url: str, rows: int = 100) -> tuple[list[str], list[dict[str, str]]]:
    slug = slug_from_input(slug_or_url)
    lines = get_text_lines(f"https://ourworldindata.org/grapher/{slug}.csv", rows + 1)
    reader = csv.DictReader(StringIO("".join(lines)))
    return reader.fieldnames or [], list(reader)


def summarize_chart(slug_or_url: str, rows: int = 300) -> dict:
    slug = slug_from_input(slug_or_url)
    metadata = chart_metadata(slug)
    headers, sample = chart_csv_sample(slug, rows=rows)
    time_key = _first_existing(headers, ["Year", "Day"])
    entities = sorted({row.get("Entity", "") for row in sample if row.get("Entity")})
    times = [row.get(time_key, "") for row in sample if time_key and row.get(time_key)]

    return {
        "slug": slug,
        "url": f"https://ourworldindata.org/grapher/{slug}",
        "title": metadata.get("chart", {}).get("title", ""),
        "subtitle": metadata.get("chart", {}).get("subtitle", ""),
        "citation": metadata.get("chart", {}).get("citation", ""),
        "date_downloaded": metadata.get("dateDownloaded", ""),
        "columns": list(metadata.get("columns", {}).keys()),
        "csv_headers": headers,
        "time_column": time_key,
        "time_min": min(times) if times else "",
        "time_max": max(times) if times else "",
        "sample_entities": entities[:20],
        "sample_entity_count": len(entities),
        "metadata": metadata,
    }


def grapher_slug_from_search_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.path.startswith("/grapher/"):
        return slug_from_input(url)
    query = parse_qs(parsed.query)
    return query.get("slug", [""])[0]


def _first_existing(values: list[str], candidates: list[str]) -> str:
    for candidate in candidates:
        if candidate in values:
            return candidate
    return ""
