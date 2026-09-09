from __future__ import annotations

import logging
import re
import struct
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import pandas as pd
import requests
from lxml import etree


logger = logging.getLogger(__name__)

DATA_DOWNLOAD_PAGE_URL = 'https://www.marktstammdatenregister.de/MaStR/Datendownload'
DEFAULT_RAW_DIR = Path('.data/raw/mastr')
EOCD_SIGNATURE = b'PK\x05\x06'
CENTRAL_DIRECTORY_SIGNATURE = b'PK\x01\x02'
LOCAL_FILE_HEADER_SIGNATURE = b'PK\x03\x04'


@dataclass(frozen=True)
class MastrXmlTable:
    xml_filename: str
    record_tag: str
    table_name: str
    columns: tuple[str, ...]


@dataclass(frozen=True)
class RemoteZipMember:
    filename: str
    compressed_size: int
    uncompressed_size: int
    local_header_offset: int
    central_directory_entry: bytes


MASTR_BATTERY_TABLES: tuple[MastrXmlTable, ...] = (
    MastrXmlTable(
        xml_filename='EinheitenStromSpeicher.xml',
        record_tag='EinheitStromSpeicher',
        table_name='mastr_einheiten_strom_speicher',
        columns=(
            'EinheitMastrNummer',
            'DatumLetzteAktualisierung',
            'LokationMaStRNummer',
            'NetzbetreiberpruefungStatus',
            'NetzbetreiberpruefungDatum',
            'AnlagenbetreiberMastrNummer',
            'Land',
            'Bundesland',
            'Landkreis',
            'Gemeinde',
            'Gemeindeschluessel',
            'Postleitzahl',
            'Ort',
            'Laengengrad',
            'Breitengrad',
            'Registrierungsdatum',
            'Inbetriebnahmedatum',
            'GeplantesInbetriebnahmedatum',
            'DatumEndgueltigeStilllegung',
            'DatumBeginnVoruebergehendeStilllegung',
            'DatumWiederaufnahmeBetrieb',
            'EinheitSystemstatus',
            'EinheitBetriebsstatus',
            'NameStromerzeugungseinheit',
            'Energietraeger',
            'Bruttoleistung',
            'Nettonennleistung',
            'FernsteuerbarkeitNb',
            'FernsteuerbarkeitDv',
            'Einspeisungsart',
            'Einsatzort',
            'AcDcKoppelung',
            'Batterietechnologie',
            'Notstromaggregat',
            'NettonennleistungDeutschland',
            'ZugeordnenteWirkleistungWechselrichter',
            'SpeMastrNummer',
            'EegMaStRNummer',
            'EegAnlagentyp',
            'Technologie',
            'GemeinsamRegistrierteSolareinheitMastrNummer',
            'NetzreserveZugeordnet',
            'DatumNetzreserve',
            'KapazitaetsreserveZugeordnet',
            'DatumKapazitaetsreserve',
            'InbetriebnahmedatumAmAktuellenStandort',
        ),
    ),
    MastrXmlTable(
        xml_filename='AnlagenStromSpeicher.xml',
        record_tag='AnlageStromSpeicher',
        table_name='mastr_anlagen_strom_speicher',
        columns=(
            'MaStRNummer',
            'Registrierungsdatum',
            'DatumLetzteAktualisierung',
            'NutzbareSpeicherkapazitaet',
            'VerknuepfteEinheitenMaStRNummern',
            'AnlageBetriebsstatus',
        ),
    ),
    MastrXmlTable(
        xml_filename='AnlagenEegSpeicher.xml',
        record_tag='AnlageEegSpeicher',
        table_name='mastr_anlagen_eeg_speicher',
        columns=(
            'Registrierungsdatum',
            'DatumLetzteAktualisierung',
            'EegInbetriebnahmedatum',
            'EegMaStRNummer',
            'AnlagenschluesselEeg',
            'AusschreibungZuschlag',
            'Zuschlagsnummer',
            'VerknuepfteEinheitenMaStRNummern',
        ),
    ),
    MastrXmlTable(
        xml_filename='Katalogwerte.xml',
        record_tag='Katalogwert',
        table_name='mastr_katalogwerte',
        columns=('Id', 'Wert', 'KatalogKategorieId'),
    ),
    MastrXmlTable(
        xml_filename='Katalogkategorien.xml',
        record_tag='Katalogkategorie',
        table_name='mastr_katalogkategorien',
        columns=('Id', 'Name'),
    ),
)


def discover_current_export_url(
    download_page_url: str = DATA_DOWNLOAD_PAGE_URL,
) -> str:
    """Return the first/current Gesamtdatenexport ZIP URL from the MaStR download page."""
    response = requests.get(download_page_url, timeout=60)
    response.raise_for_status()

    match = re.search(
        r'href="(?P<url>[^"]*Gesamtdatenexport_\d{8}_[^"]+?\.zip)"',
        response.text,
        re.IGNORECASE,
    )
    if match is None:
        raise ValueError(f'No MaStR Gesamtdatenexport ZIP found at {download_page_url}')

    return urljoin(download_page_url, match.group('url'))


def download_export_zip(
    export_url: str,
    raw_dir: Path = DEFAULT_RAW_DIR,
    max_retries: int = 10,
) -> Path:
    """Download the MaStR export ZIP if it is not already present locally."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    filename = unquote(Path(urlparse(export_url).path).name)
    destination = raw_dir / filename

    if destination.exists() and destination.stat().st_size > 0:
        logger.info('Using existing MaStR export at %s', destination)
        return destination

    tmp_destination = destination.with_suffix(destination.suffix + '.part')
    expected_size = _get_remote_content_length(export_url)

    if expected_size and tmp_destination.exists() and tmp_destination.stat().st_size >= expected_size:
        tmp_destination.rename(destination)
        return destination

    logger.info('Downloading MaStR export from %s to %s', export_url, destination)
    for attempt in range(1, max_retries + 1):
        downloaded_size = tmp_destination.stat().st_size if tmp_destination.exists() else 0
        headers = {'Range': f'bytes={downloaded_size}-'} if downloaded_size else None
        file_mode = 'ab' if downloaded_size else 'wb'

        if expected_size:
            logger.info(
                'MaStR download attempt %s/%s from byte %s of %s',
                attempt,
                max_retries,
                downloaded_size,
                expected_size,
            )
        else:
            logger.info('MaStR download attempt %s/%s from byte %s', attempt, max_retries, downloaded_size)

        try:
            with requests.get(
                export_url,
                headers=headers,
                stream=True,
                timeout=(10, 300),
            ) as response:
                if response.status_code == 416 and expected_size and downloaded_size >= expected_size:
                    tmp_destination.rename(destination)
                    return destination

                if downloaded_size and response.status_code == 200:
                    logger.warning('MaStR server did not resume download; restarting from byte 0')
                    file_mode = 'wb'
                    downloaded_size = 0
                elif response.status_code not in (200, 206):
                    response.raise_for_status()

                with tmp_destination.open(file_mode) as file:
                    for chunk in response.iter_content(chunk_size=16 * 1024 * 1024):
                        if chunk:
                            file.write(chunk)
        except (OSError, requests.RequestException) as exc:
            if attempt == max_retries:
                raise
            logger.warning('MaStR download attempt %s failed: %s', attempt, exc)
            continue

        current_size = tmp_destination.stat().st_size
        if expected_size is None or current_size >= expected_size:
            tmp_destination.rename(destination)
            return destination

        logger.warning(
            'MaStR download stopped early at %s of %s bytes; retrying',
            current_size,
            expected_size,
        )

    raise RuntimeError(f'Could not download complete MaStR export after {max_retries} attempts')


def download_selected_export_zip(
    export_url: str,
    tables: Iterable[MastrXmlTable] = MASTR_BATTERY_TABLES,
    raw_dir: Path = DEFAULT_RAW_DIR,
) -> Path:
    """Download a valid ZIP containing only the MaStR XML members needed by ``tables``.

    The public MaStR export is several GB. The download host supports HTTP range
    requests, so we can read the ZIP central directory, copy only relevant local
    ZIP members, and write a much smaller ZIP that Python's ``zipfile`` can read.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    filename = unquote(Path(urlparse(export_url).path).name)
    destination = raw_dir / f'{Path(filename).stem}_battery_subset.zip'

    if destination.exists() and destination.stat().st_size > 0:
        logger.info('Using existing MaStR battery subset export at %s', destination)
        return destination

    expected_xml_files = tuple(table.xml_filename for table in tables)
    members = _get_remote_zip_members(export_url)
    selected_members = [
        member for member in members if _member_matches_expected_xml(member.filename, expected_xml_files)
    ]

    if not selected_members:
        raise ValueError(f'No MaStR battery XML members found in {export_url}')

    logger.info(
        'Downloading %s of %s MaStR ZIP members into %s',
        len(selected_members),
        len(members),
        destination,
    )

    tmp_destination = destination.with_suffix(destination.suffix + '.part')
    central_directory_entries: list[bytes] = []
    current_offset = 0

    with tmp_destination.open('wb') as output_zip:
        for member in selected_members:
            local_member = _fetch_remote_zip_member(export_url, member)
            output_zip.write(local_member)

            central_directory_entries.append(
                member.central_directory_entry[:42]
                + struct.pack('<L', current_offset)
                + member.central_directory_entry[46:]
            )
            current_offset += len(local_member)
            logger.info('Copied MaStR ZIP member %s', member.filename)

        central_directory_offset = current_offset
        central_directory = b''.join(central_directory_entries)
        output_zip.write(central_directory)
        output_zip.write(
            struct.pack(
                '<4s4H2LH',
                EOCD_SIGNATURE,
                0,
                0,
                len(central_directory_entries),
                len(central_directory_entries),
                len(central_directory),
                central_directory_offset,
                0,
            )
        )

    tmp_destination.rename(destination)
    return destination


def _get_remote_content_length(export_url: str) -> int | None:
    response = requests.head(export_url, allow_redirects=True, timeout=60)
    response.raise_for_status()
    content_length = response.headers.get('Content-Length')
    return int(content_length) if content_length else None


def iter_xml_records(
    zip_path: Path,
    xml_filename: str,
    record_tag: str,
    columns: Iterable[str],
) -> Iterable[dict[str, str | None]]:
    """Yield selected XML record fields from a member of the MaStR export ZIP."""
    columns = tuple(columns)
    with zipfile.ZipFile(zip_path) as export_zip:
        member_names = _find_zip_members(export_zip, xml_filename)
        for member_name in member_names:
            with export_zip.open(member_name) as xml_file:
                context = etree.iterparse(xml_file, events=('end',), tag=record_tag)
                for _, element in context:
                    values = {child.tag: child.text for child in element}
                    yield {column: values.get(column) for column in columns}

                    element.clear()
                    while element.getprevious() is not None:
                        del element.getparent()[0]


def ingest_xml_table(
    con,
    zip_path: Path,
    table: MastrXmlTable,
    batch_size: int = 50_000,
) -> int:
    """Load a MaStR XML table into the DuckDB staging schema in batches."""
    con.sql('CREATE SCHEMA IF NOT EXISTS staging')
    quoted_columns = ', '.join(f'"{column}" VARCHAR' for column in table.columns)
    con.sql(f'CREATE OR REPLACE TABLE staging.{table.table_name} ({quoted_columns})')

    total_rows = 0
    batch: list[dict[str, str | None]] = []
    for record in iter_xml_records(
        zip_path=zip_path,
        xml_filename=table.xml_filename,
        record_tag=table.record_tag,
        columns=table.columns,
    ):
        batch.append(record)
        if len(batch) >= batch_size:
            _insert_batch(con, table, batch)
            total_rows += len(batch)
            logger.info('Inserted %s rows into staging.%s', total_rows, table.table_name)
            batch.clear()

    if batch:
        _insert_batch(con, table, batch)
        total_rows += len(batch)

    logger.info('Finished staging.%s with %s rows', table.table_name, total_rows)
    return total_rows


def _insert_batch(con, table: MastrXmlTable, batch: list[dict[str, str | None]]) -> None:
    df = pd.DataFrame.from_records(batch, columns=table.columns)
    con.register('mastr_batch_df', df)
    column_list = ', '.join(f'"{column}"' for column in table.columns)
    con.sql(f'INSERT INTO staging.{table.table_name} ({column_list}) SELECT {column_list} FROM mastr_batch_df')
    con.unregister('mastr_batch_df')


def _get_remote_zip_members(export_url: str) -> list[RemoteZipMember]:
    export_size = _get_remote_content_length(export_url)
    if export_size is None:
        raise ValueError(f'Could not determine MaStR export size for {export_url}')

    tail_size = min(export_size, 131_072)
    tail = _fetch_range(export_url, export_size - tail_size, export_size - 1)
    eocd_offset_in_tail = tail.rfind(EOCD_SIGNATURE)
    if eocd_offset_in_tail < 0:
        raise ValueError(f'Could not find ZIP end-of-central-directory in {export_url}')

    eocd = tail[eocd_offset_in_tail : eocd_offset_in_tail + 22]
    (
        _,
        _,
        _,
        _,
        total_entries,
        central_directory_size,
        central_directory_offset,
        comment_length,
    ) = struct.unpack('<4s4H2LH', eocd)

    if comment_length:
        logger.info('Ignoring MaStR ZIP EOCD comment of %s bytes', comment_length)

    central_directory = _fetch_range(
        export_url,
        central_directory_offset,
        central_directory_offset + central_directory_size - 1,
    )

    members: list[RemoteZipMember] = []
    offset = 0
    while offset < len(central_directory):
        if central_directory[offset : offset + 4] != CENTRAL_DIRECTORY_SIGNATURE:
            raise ValueError(f'Invalid central directory signature at byte {offset}')

        values = struct.unpack_from('<4s6H3L5H2L', central_directory, offset)
        (
            _,
            _,
            _,
            _,
            _,
            _,
            _,
            _,
            compressed_size,
            uncompressed_size,
            filename_length,
            extra_length,
            comment_length,
            _,
            _,
            _,
            local_header_offset,
        ) = values

        entry_length = 46 + filename_length + extra_length + comment_length
        entry = central_directory[offset : offset + entry_length]
        filename = central_directory[offset + 46 : offset + 46 + filename_length].decode(
            'utf-8',
            errors='replace',
        )

        members.append(
            RemoteZipMember(
                filename=filename,
                compressed_size=compressed_size,
                uncompressed_size=uncompressed_size,
                local_header_offset=local_header_offset,
                central_directory_entry=entry,
            )
        )
        offset += entry_length

    if len(members) != total_entries:
        logger.warning('Expected %s ZIP entries but parsed %s', total_entries, len(members))

    return members


def _fetch_remote_zip_member(export_url: str, member: RemoteZipMember) -> bytes:
    local_header = _fetch_range(export_url, member.local_header_offset, member.local_header_offset + 29)
    if local_header[:4] != LOCAL_FILE_HEADER_SIGNATURE:
        raise ValueError(f'Invalid local file header signature for {member.filename}')

    (
        _,
        _,
        _,
        _,
        _,
        _,
        _,
        _,
        _,
        filename_length,
        extra_length,
    ) = struct.unpack('<4s5H3L2H', local_header)
    member_length = 30 + filename_length + extra_length + member.compressed_size
    return _fetch_range(
        export_url,
        member.local_header_offset,
        member.local_header_offset + member_length - 1,
    )


def _fetch_range(export_url: str, start: int, end: int, max_retries: int = 10) -> bytes:
    headers = {'Range': f'bytes={start}-{end}'}
    expected_length = end - start + 1
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(export_url, headers=headers, timeout=(10, 300))
            response.raise_for_status()
            if response.status_code != 206:
                raise ValueError(f'Expected HTTP 206 for range request, got {response.status_code}')
            if len(response.content) != expected_length:
                raise ValueError(
                    f'Expected {expected_length} bytes for range {start}-{end}, got {len(response.content)}'
                )
            return response.content
        except (OSError, requests.RequestException, ValueError) as exc:
            if attempt == max_retries:
                raise
            logger.warning('Range request %s-%s attempt %s failed: %s', start, end, attempt, exc)

    raise RuntimeError(f'Could not fetch range {start}-{end} from {export_url}')


def _find_zip_members(export_zip: zipfile.ZipFile, expected_filename: str) -> list[str]:
    matched_members = [
        member_name
        for member_name in export_zip.namelist()
        if _member_matches_expected_xml(member_name, (expected_filename,))
    ]

    if matched_members:
        return sorted(matched_members, key=_natural_sort_key)

    raise FileNotFoundError(f'{expected_filename} not found in {export_zip.filename}')


def _member_matches_expected_xml(member_name: str, expected_filenames: Iterable[str]) -> bool:
    member_path = Path(member_name)
    member_stem = member_path.stem.lower()
    member_suffix = member_path.suffix.lower()
    if member_suffix != '.xml':
        return False

    for expected_filename in expected_filenames:
        expected_stem = Path(expected_filename).stem.lower()
        if member_stem == expected_stem or member_stem.startswith(f'{expected_stem}_'):
            return True

    return False


def _natural_sort_key(value: str) -> list[int | str]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r'(\d+)', value)]
