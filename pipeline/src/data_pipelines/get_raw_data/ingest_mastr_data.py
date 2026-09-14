"""Manual article refresh only; use a dedicated battery database."""
from __future__ import annotations

import json
import logging
import os
import zipfile
from argparse import ArgumentParser
from pathlib import Path

import duckdb

from src.tools.datasources.mastr_helper.mastr_export import (
    BoundedHTTP, Deadline, Limits, MASTR_BATTERY_TABLES, DEFAULT_RAW_DIR,
    atomic_json, discover_current_export_url, download_selected_export_zip,
    ingest_xml_table, local_provenance, manifest_path, select_members, snapshot_from_url,
)


DEFAULT_DATABASE = Path('.data/mastr_battery.duckdb')
PROTECTED_DATABASE = Path(__file__).resolve().parents[3] / '.data/duckdb.db'


def safe_database(database):
    database = Path(database).resolve()
    if database == PROTECTED_DATABASE or (
            database.exists() and PROTECTED_DATABASE.exists()
            and os.path.samefile(database, PROTECTED_DATABASE)):
        raise ValueError('The general .data/duckdb.db is protected; use a dedicated battery database')
    return database


def ingest_mastr_battery_data(export_url=None, zip_path=None, *, snapshot_date=None,
                             database=DEFAULT_DATABASE, raw_dir=DEFAULT_RAW_DIR, limits=None):
    limits = limits or Limits()
    database = safe_database(database)
    if zip_path is None:
        client = BoundedHTTP(limits)
        export_url = export_url or discover_current_export_url(client=client)
        actual_date = snapshot_from_url(export_url).isoformat()
        if snapshot_date is not None and str(snapshot_date) != actual_date:
            raise ValueError('Requested snapshot date does not match discovered source URL')
        snapshot_date = actual_date
        zip_path = download_selected_export_zip(export_url, raw_dir, limits=limits, client=client)
    elif export_url is None or snapshot_date is None:
        raise ValueError('Local --zip-path requires --export-url and explicit --snapshot-date')
    zip_path = Path(zip_path).resolve()
    if database == zip_path or database == manifest_path(zip_path):
        raise ValueError('Database must not overwrite archive/provenance')
    deadline = Deadline(limits.parse_seconds)
    before = zip_path.stat()
    if before.st_size > limits.max_bytes:
        raise ValueError('Local archive exceeds byte budget')
    provenance = local_provenance(zip_path, export_url, snapshot_date, deadline)
    counts = {}
    with zipfile.ZipFile(zip_path) as archive:
        selected = select_members(archive, limits)
        database.parent.mkdir(parents=True, exist_ok=True)
        with duckdb.connect(str(database)) as con:
            con.execute('BEGIN TRANSACTION')
            try:
                con.execute('CREATE SCHEMA IF NOT EXISTS staging')
                for table in MASTR_BATTERY_TABLES:
                    counts[table.table_name] = ingest_xml_table(
                        con, archive, selected[table.table_name], table, limits, deadline)
                con.execute('CREATE OR REPLACE TABLE staging.mastr_snapshot ('
                            'snapshot_date DATE NOT NULL, source_url VARCHAR NOT NULL, '
                            'archive_sha256 VARCHAR NOT NULL, filename VARCHAR NOT NULL)')
                con.execute('INSERT INTO staging.mastr_snapshot VALUES (?, ?, ?, ?)',
                            [provenance[key] for key in ('snapshot_date', 'source_url',
                                                        'archive_sha256', 'filename')])
                after = zip_path.stat()
                if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
                        after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
                    raise ValueError('Input archive changed during ingestion')
                deadline.check()
                # Write provenance before committing: sidecar failure also rolls back staging.
                # A sidecar records verified input, not a claim that a DB commit succeeded.
                atomic_json(manifest_path(zip_path), provenance)
                con.execute('COMMIT')
            except BaseException:
                con.execute('ROLLBACK')
                raise
    logging.info('Loaded snapshot %s into %s: %s', snapshot_date, database, counts)
    return counts


def main():
    parser = ArgumentParser(description='Bounded manual MaStR battery-only article refresh.')
    parser.add_argument('--export-url', help='Official dated ZIP URL; otherwise discover newest export.')
    parser.add_argument('--zip-path', type=Path, help='Existing local archive; requires source URL and snapshot date.')
    parser.add_argument('--snapshot-date', help='YYYY-MM-DD, required for local input; pins discovery when supplied.')
    parser.add_argument('--database', type=Path, default=DEFAULT_DATABASE)
    parser.add_argument('--raw-dir', type=Path, default=DEFAULT_RAW_DIR)
    for name, default in vars(Limits()).items():
        parser.add_argument('--' + name.replace('_', '-'), default=default,
                            type=float if name.endswith('seconds') else int)
    args = parser.parse_args()
    limits = Limits(**{key: getattr(args, key) for key in vars(Limits())})
    counts = ingest_mastr_battery_data(
        args.export_url, args.zip_path, snapshot_date=args.snapshot_date,
        database=args.database, raw_dir=args.raw_dir, limits=limits)
    print(json.dumps(counts, indent=2, sort_keys=True))


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
