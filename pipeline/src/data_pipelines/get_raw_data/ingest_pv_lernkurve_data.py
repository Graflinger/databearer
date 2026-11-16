"""Ingest the pinned Our World in Data tables for the 2026 PV learning-curve article.

Run from ``pipeline/``::

    PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_pv_lernkurve_data.py
    PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_pv_lernkurve_data.py --from-raw

Four bounded requests for dated OWID catalog Parquet files (IRENA capacity, PV module
price, Global Carbon Budget, Ember electricity mix). Raw bytes plus a small provenance
sidecar are kept in ignored ``.data/raw/pv_lernkurve/``; ``--from-raw`` reloads them
without network access. Only the documented columns are written, unchanged, to DuckDB
staging tables. Shares, additions and the learning rate are computed in dbt and in
the frozen export.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import requests
import yaml

METADATA = Path("src/config/datasource_metadata/pv_lernkurve_sources.yaml")
DEFAULT_RAW_DIR = Path(".data/raw/pv_lernkurve")
DEFAULT_DATABASE = Path(".data/duckdb.db")
TIMEOUT_SECONDS = 60
# Staging table per source; the column list comes from the metadata file.
TABLES = {
    "irena_capacity": "owid_irena_solar_pv_capacity",
    "pv_module_cost": "owid_pv_module_cost_capacity",
    "co2_share": "owid_gcp_co2_share",
    "solar_electricity_share": "owid_solar_electricity_share",
}


class SourceError(ValueError):
    """Raised when a source file does not match its documented contract."""


def require(condition, message):
    if not condition:
        raise SourceError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_sources(path: Path = METADATA) -> dict:
    with open(path, encoding="utf-8") as file:
        sources = yaml.safe_load(file)["sources"]
    require(set(sources) == set(TABLES), "Source metadata does not match the staging tables")
    return sources


def download(url: str, max_bytes: int, session=requests) -> bytes:
    """Download one file with a timeout and a hard size cap."""
    with session.get(url, timeout=TIMEOUT_SECONDS, stream=True) as response:
        response.raise_for_status()
        chunks, size = [], 0
        for chunk in response.iter_content(65536):
            size += len(chunk)
            require(size <= max_bytes, f"Response exceeds {max_bytes} bytes: {url}")
            chunks.append(chunk)
    data = b"".join(chunks)
    require(data, f"Empty response: {url}")
    return data


def read_columns(raw: bytes, columns: list[str]) -> list[tuple]:
    """Return the documented columns of a Parquet file; fail on missing columns or keys."""
    with tempfile.NamedTemporaryFile(suffix=".parquet") as file:
        file.write(raw)
        file.flush()
        with duckdb.connect() as con:
            try:
                available = [row[0] for row in con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [file.name]).fetchall()]
            except duckdb.Error as error:
                raise SourceError(f"Not a readable Parquet file: {error}") from error
            missing = [name for name in columns if name not in available]
            require(not missing, f"Parquet file lacks columns {missing}")
            selected = ", ".join(f'"{name}"' for name in columns)
            rows = con.execute(f"SELECT {selected} FROM read_parquet(?) ORDER BY 1, 2", [file.name]).fetchall()
    require(rows, "Parquet file has no rows")
    keys = [(row[0], row[1]) for row in rows]
    require(len(set(keys)) == len(keys), "Duplicate country/year rows")
    require(all(isinstance(country, str) and country and isinstance(year, int) for country, year in keys), "Invalid country/year keys")
    return rows


def store_raw(raw_dir: Path, filename: str, data: bytes, url: str) -> dict:
    raw_dir.mkdir(parents=True, exist_ok=True)
    provenance = {
        "filename": filename, "url": url, "sha256": sha256(data), "bytes": len(data),
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    temporary = raw_dir / f".{filename}.tmp"
    temporary.write_bytes(data)
    temporary.replace(raw_dir / filename)
    (raw_dir / f"{filename}.json").write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return provenance


def read_raw(raw_dir: Path, filename: str) -> tuple[bytes, dict]:
    data = (raw_dir / filename).read_bytes()
    provenance = json.loads((raw_dir / f"{filename}.json").read_text(encoding="utf-8"))
    require(provenance["sha256"] == sha256(data) and provenance["bytes"] == len(data), f"Raw file {filename} does not match its sidecar")
    return data, provenance


def load_staging(con, key: str, columns: list[str], rows: list[tuple], provenance: dict) -> None:
    table = TABLES[key]
    definitions = ", ".join(["country VARCHAR", "year INTEGER"] + [f"{name} DOUBLE" for name in columns[2:]])
    con.execute("CREATE SCHEMA IF NOT EXISTS staging")
    con.execute(f"CREATE OR REPLACE TABLE staging.{table} ({definitions}, source_url VARCHAR, source_sha256 VARCHAR, retrieved_at VARCHAR)")
    placeholders = ", ".join("?" for _ in range(len(columns) + 3))
    con.executemany(f"INSERT INTO staging.{table} VALUES ({placeholders})",
                    [(*row, provenance["url"], provenance["sha256"], provenance["retrieved_at"]) for row in rows])


def ingest(database: Path = DEFAULT_DATABASE, raw_dir: Path = DEFAULT_RAW_DIR, from_raw: bool = False, session=requests) -> dict:
    sources = load_sources()
    parsed = {}
    for key, source in sources.items():
        filename = f"{key}.parquet"
        if from_raw:
            raw, provenance = read_raw(raw_dir, filename)
        else:
            raw, provenance = download(source["url"], source["max_bytes"], session), None
        # Parse before storing so that a malformed download never replaces good raw files.
        parsed[key] = (raw, provenance, read_columns(raw, source["columns"]))
    for key, (raw, provenance, rows) in parsed.items():
        if provenance is None:
            provenance = store_raw(raw_dir, f"{key}.parquet", raw, sources[key]["url"])
        parsed[key] = (raw, provenance, rows)
    with duckdb.connect(str(database)) as con:
        con.execute("BEGIN")
        for key, (_, provenance, rows) in parsed.items():
            load_staging(con, key, sources[key]["columns"], rows, provenance)
        con.execute("COMMIT")
    return {TABLES[key]: len(rows) for key, (_, _, rows) in parsed.items()}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--from-raw", action="store_true", help="reload stored raw files without network access")
    args = parser.parse_args(argv)
    print(json.dumps(ingest(args.database, args.raw_dir, args.from_raw), sort_keys=True))


if __name__ == "__main__":
    main()
