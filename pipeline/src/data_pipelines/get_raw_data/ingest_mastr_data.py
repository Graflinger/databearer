from __future__ import annotations

import logging
from argparse import ArgumentParser
from pathlib import Path

from src.tools.datasources.mastr_helper.mastr_export import (
    MASTR_BATTERY_TABLES,
    discover_current_export_url,
    download_export_zip,
    download_selected_export_zip,
    ingest_xml_table,
)
from src.tools.duckdb_utils.duckdb_utils import get_duckdb_connection


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def ingest_mastr_battery_data(
    export_url: str | None = None,
    zip_path: Path | None = None,
    full_export: bool = False,
) -> None:
    """Ingest MaStR Stromspeicher/Batteriespeicher tables into DuckDB staging."""
    if zip_path is None:
        export_url = export_url or discover_current_export_url()
        if full_export:
            zip_path = download_export_zip(export_url)
        else:
            zip_path = download_selected_export_zip(export_url)

    with get_duckdb_connection() as con:
        for table in MASTR_BATTERY_TABLES:
            row_count = ingest_xml_table(con=con, zip_path=zip_path, table=table)
            logging.info('Table %s ingested into duckdb with %s rows', table.table_name, row_count)

        con.commit()


def main() -> None:
    parser = ArgumentParser(description='Ingest MaStR battery/storage XML tables into DuckDB.')
    parser.add_argument('--export-url', help='MaStR Gesamtdatenexport ZIP URL. Defaults to current export.')
    parser.add_argument('--zip-path', type=Path, help='Existing local MaStR Gesamtdatenexport ZIP path.')
    parser.add_argument(
        '--full-export',
        action='store_true',
        help='Download the full multi-GB MaStR export instead of a battery/XML subset via range requests.',
    )
    args = parser.parse_args()

    ingest_mastr_battery_data(
        export_url=args.export_url,
        zip_path=args.zip_path,
        full_export=args.full_export,
    )


if __name__ == '__main__':
    main()
