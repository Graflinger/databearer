"""Bounded, manual MaStR battery snapshot acquisition and staging.

No full-export fallback, automatic cache reuse, or general pipeline DB access.
ZIP metadata is parsed by Python's ZIP64-aware zipfile implementation; compressed
members are copied in chunks and the resulting archive is CRC-checked before use.
"""
from __future__ import annotations

import codecs
import hashlib
import io
import json
import math
import os
import re
import struct
import tempfile
import time
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from xml.parsers import expat

import requests


DATA_DOWNLOAD_PAGE_URL = 'https://www.marktstammdatenregister.de/MaStR/Datendownload'
OFFICIAL_HOSTS = frozenset({'www.marktstammdatenregister.de', 'download.marktstammdatenregister.de'})
DEFAULT_RAW_DIR = Path('.data/raw/mastr')
CHUNK_SIZE = 64 * 1024
MAX_DIRECTORY_BYTES = 16 * 1024 * 1024
MAX_ARCHIVE_BYTES = 100_000_000_000
MAX_LOCAL_HEADER_BYTES = 30 + 2 * 65535
MAX_XML_TOKEN_BYTES = 16_384
MAX_XML_NAME_CHARACTERS = 256
MAX_XML_ATTRIBUTES = 16
MAX_XML_ATTRIBUTE_CHARACTERS = 1024


@dataclass(frozen=True)
class MastrXmlTable:
    xml_filename: str
    record_tag: str
    table_name: str
    columns: tuple[str, ...]
    key: str
    required_columns: tuple[str, ...]


# Column names and the five table names are the contract recovered from 53b4954.
# Required columns are family-level presence checks. Nullable source fields stay
# nullable; only the primary key must be populated in every record.
MASTR_BATTERY_TABLES = (
    MastrXmlTable(
        'EinheitenStromSpeicher.xml', 'EinheitStromSpeicher', 'mastr_einheiten_strom_speicher',
        ('EinheitMastrNummer', 'DatumLetzteAktualisierung', 'LokationMaStRNummer',
         'NetzbetreiberpruefungStatus', 'NetzbetreiberpruefungDatum', 'AnlagenbetreiberMastrNummer',
         'Land', 'Bundesland', 'Landkreis', 'Gemeinde', 'Gemeindeschluessel', 'Postleitzahl', 'Ort',
         'Laengengrad', 'Breitengrad', 'Registrierungsdatum', 'Inbetriebnahmedatum',
         'GeplantesInbetriebnahmedatum', 'DatumEndgueltigeStilllegung',
         'DatumBeginnVoruebergehendeStilllegung', 'DatumWiederaufnahmeBetrieb', 'EinheitSystemstatus',
         'EinheitBetriebsstatus', 'NameStromerzeugungseinheit', 'Energietraeger', 'Bruttoleistung',
         'Nettonennleistung', 'FernsteuerbarkeitNb', 'FernsteuerbarkeitDv', 'Einspeisungsart',
         'Einsatzort', 'AcDcKoppelung', 'Batterietechnologie', 'Notstromaggregat',
         'NettonennleistungDeutschland', 'ZugeordnenteWirkleistungWechselrichter', 'SpeMastrNummer',
         'EegMaStRNummer', 'EegAnlagentyp', 'Technologie', 'GemeinsamRegistrierteSolareinheitMastrNummer',
         'NetzreserveZugeordnet', 'DatumNetzreserve', 'KapazitaetsreserveZugeordnet',
         'DatumKapazitaetsreserve', 'InbetriebnahmedatumAmAktuellenStandort'),
        'EinheitMastrNummer', ('EinheitMastrNummer', 'EinheitBetriebsstatus', 'Nettonennleistung',
                              'Batterietechnologie', 'SpeMastrNummer', 'Land', 'Technologie',
                              'EinheitSystemstatus')),
    MastrXmlTable(
        'AnlagenStromSpeicher.xml', 'AnlageStromSpeicher', 'mastr_anlagen_strom_speicher',
        ('MaStRNummer', 'Registrierungsdatum', 'DatumLetzteAktualisierung', 'NutzbareSpeicherkapazitaet',
         'VerknuepfteEinheitenMaStRNummern', 'AnlageBetriebsstatus'),
        'MaStRNummer', ('MaStRNummer', 'NutzbareSpeicherkapazitaet',
                        'VerknuepfteEinheitenMaStRNummern', 'AnlageBetriebsstatus')),
    MastrXmlTable(
        'AnlagenEegSpeicher.xml', 'AnlageEegSpeicher', 'mastr_anlagen_eeg_speicher',
        ('Registrierungsdatum', 'DatumLetzteAktualisierung', 'EegInbetriebnahmedatum', 'EegMaStRNummer',
         'AnlagenschluesselEeg', 'AusschreibungZuschlag', 'Zuschlagsnummer',
         'VerknuepfteEinheitenMaStRNummern'),
        'EegMaStRNummer', ('EegMaStRNummer', 'VerknuepfteEinheitenMaStRNummern')),
    MastrXmlTable('Katalogwerte.xml', 'Katalogwert', 'mastr_katalogwerte',
                  ('Id', 'Wert', 'KatalogKategorieId'), 'Id', ('Id', 'Wert', 'KatalogKategorieId')),
    MastrXmlTable('Katalogkategorien.xml', 'Katalogkategorie', 'mastr_katalogkategorien',
                  ('Id', 'Name'), 'Id', ('Id', 'Name')),
)


@dataclass(frozen=True)
class Limits:
    download_seconds: float = 600
    max_bytes: int = 900_000_000
    max_requests: int = 96
    retries: int = 1
    parse_seconds: float = 1800
    max_uncompressed_bytes: int = 20_000_000_000
    max_rows_per_table: int = 10_000_000
    max_members: int = 256

    def __post_init__(self):
        for key, value in vars(self).items():
            if not math.isfinite(value) or value < (0 if key == 'retries' else 1):
                raise ValueError(f'Invalid limit: {key}')
        if self.retries > 2:
            raise ValueError('At most two retries per request are allowed')


class Deadline:
    def __init__(self, seconds):
        self.ends = time.monotonic() + seconds

    def check(self):
        remaining = self.ends - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('MaStR operation deadline exceeded')
        return remaining


def official_url(url: str) -> str:
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname not in OFFICIAL_HOSTS
            or parsed.username or parsed.password or parsed.port not in (None, 443)
            or parsed.fragment or parsed.query or '\\' in url):
        raise ValueError(f'Expected an allowlisted official HTTPS MaStR URL: {url}')
    return url


def snapshot_from_url(url: str) -> date:
    official_url(url)
    match = re.fullmatch(r'Gesamtdatenexport_(\d{8})_[A-Za-z0-9_.-]+\.zip',
                         unquote(Path(urlsplit(url).path).name), re.IGNORECASE)
    if not match:
        raise ValueError('Source URL must identify a dated Gesamtdatenexport ZIP')
    return datetime.strptime(match[1], '%Y%m%d').date()


class BoundedHTTP:
    """Shared budget for discovery, metadata, member bytes and all retry traffic.

    Redirects are rejected. Timeout checks are cooperative, with each blocking
    socket operation capped at 5s connect / 15s read (and remaining time).
    """
    def __init__(self, limits: Limits):
        self.limits = limits
        self.deadline = Deadline(limits.download_seconds)
        self.requests = 0
        self.bytes = 0
        self.total = None
        self.etag = None

    def get(self, url, sink, *, start=None, end=None, cap=MAX_DIRECTORY_BYTES):
        official_url(url)
        position = sink.tell()
        for attempt in range(self.limits.retries + 1):
            remaining = self.deadline.check()
            if self.requests >= self.limits.max_requests:
                raise ValueError('HTTP request budget exceeded')
            if start is not None and (start < 0 or end < start):
                raise ValueError('Invalid requested range')
            expected = end - start + 1 if start is not None else None
            if self.bytes + (expected or 1) > self.limits.max_bytes:
                raise ValueError('HTTP byte budget exceeded')
            headers = {'Accept-Encoding': 'identity'}
            if start is not None:
                headers['Range'] = f'bytes={start}-{end}'
                if self.etag:
                    headers['If-Match'] = self.etag
            self.requests += 1
            try:
                with requests.get(url, headers=headers, stream=True, allow_redirects=False,
                                  timeout=(min(5, remaining), min(15, remaining))) as response:
                    if response.status_code in (429, 500, 502, 503, 504):
                        response.raise_for_status()
                    if response.status_code != (206 if expected is not None else 200):
                        raise ValueError(f'Unexpected HTTP status {response.status_code}; no redirects/fallback')
                    if response.headers.get('Content-Encoding', 'identity').lower() != 'identity':
                        raise ValueError('Encoded HTTP body is not a byte range')
                    length = response.headers.get('Content-Length')
                    if length is None or not length.isdecimal():
                        raise ValueError('Missing/invalid Content-Length')
                    length = int(length)
                    if length > cap or self.bytes + length > self.limits.max_bytes:
                        raise ValueError('HTTP response exceeds byte budget')
                    if expected is not None:
                        match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',
                                             response.headers.get('Content-Range', ''))
                        if not match or tuple(map(int, match.group(1, 2))) != (start, end):
                            raise ValueError('Invalid Content-Range')
                        total = int(match[3])
                        if total <= end or total > MAX_ARCHIVE_BYTES or length != expected:
                            raise ValueError('Inconsistent range length/total')
                        if self.total is not None and total != self.total:
                            raise ValueError('Remote archive length changed')
                        self.total = total
                        etag = response.headers.get('ETag')
                        if self.etag is not None and etag != self.etag:
                            raise ValueError('Remote archive ETag changed')
                        if etag and not etag.startswith('W/'):
                            self.etag = etag
                    received = 0
                    for chunk in response.iter_content(CHUNK_SIZE):
                        self.deadline.check()
                        self.bytes += len(chunk)
                        received += len(chunk)
                        if received > length or self.bytes > self.limits.max_bytes:
                            raise ValueError('HTTP body exceeds declared length/budget')
                        sink.write(chunk)
                    if received != length:
                        raise ValueError('Truncated HTTP body')
                    return
            except requests.RequestException:
                if attempt == self.limits.retries:
                    raise
                sink.seek(position)
                sink.truncate()
        raise AssertionError('Unreachable')

    def range(self, url, start, end):
        result = io.BytesIO()
        self.get(url, result, start=start, end=end)
        return result.getvalue()


class _Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self.links.extend(value for key, value in attrs if key.lower() == 'href' and value)


def discover_current_export_url(download_page_url=DATA_DOWNLOAD_PAGE_URL, *, client=None):
    client = client or BoundedHTTP(Limits())
    page = io.BytesIO()
    client.get(download_page_url, page, cap=2_000_000)
    parser = _Links()
    parser.feed(page.getvalue().decode('utf-8'))
    candidates = set()
    for href in parser.links:
        if 'gesamtdatenexport_' not in href.lower() or not href.lower().endswith('.zip'):
            continue
        url = urljoin(download_page_url, href)
        candidates.add((snapshot_from_url(url), url))
    if not candidates:
        raise ValueError('No dated official MaStR Gesamtdatenexport ZIP found')
    latest = max(day for day, _ in candidates)
    urls = {url for day, url in candidates if day == latest}
    if len(urls) != 1:
        raise ValueError('Ambiguous latest MaStR export URLs')
    return urls.pop()


class RemoteZipReader(io.RawIOBase):
    """Seekable metadata view, bounded even when a malformed ZIP declares huge CD."""
    def __init__(self, url, client):
        self.url = official_url(url)
        self.client = client
        client.range(url, 0, 0)
        self.size = client.total
        self.position = 0
        self._validate_end_records()

    def _validate_end_records(self):
        self.seek(max(0, self.size - 65557))
        tail = self.read()
        offset = tail.rfind(b'PK\x05\x06')
        if offset < 0 or len(tail) - offset < 22:
            raise ValueError('Missing/truncated ZIP end record')
        end = struct.unpack_from('<4s4H2LH', tail, offset)
        if len(tail) - offset != 22 + end[-1] or end[1:3] != (0, 0) or end[3] != end[4]:
            raise ValueError('Invalid/multi-disk ZIP end record')
        end_position = self.size - len(tail) + offset
        has_zip64_locator = offset >= 20 and tail[offset - 20:offset - 16] == b'PK\x06\x07'
        if has_zip64_locator or 0xffff in end[3:5] or 0xffffffff in end[5:7]:
            if end_position < 20:
                raise ValueError('Missing ZIP64 locator')
            self.seek(end_position - 20)
            locator = struct.unpack('<4sLQL', self.read(20))
            if locator[0] != b'PK\x06\x07' or locator[1] != 0 or locator[3] != 1:
                raise ValueError('Invalid/multi-disk ZIP64 locator')
            self.seek(locator[2])
            raw = self.read(56)
            if len(raw) != 56:
                raise ValueError('Truncated ZIP64 end record')
            record = struct.unpack('<4sQ2H2L4Q', raw)
            if (record[0] != b'PK\x06\x06' or record[1] != 44 or record[4:6] != (0, 0)
                    or record[6] != record[7] or locator[2] + 56 != end_position - 20):
                raise ValueError('Unsupported ZIP64 end record (including extensible/multi-disk)')
            count, size, start = record[7:10]
            directory_end = locator[2]
        else:
            count, size, start = end[4:7]
            directory_end = end_position
        if not count or size > MAX_DIRECTORY_BYTES or start + size != directory_end:
            raise ValueError('Invalid/oversized ZIP central directory')
        self.entry_count = count

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        position = offset + (0 if whence == 0 else self.position if whence == 1 else self.size)
        if not 0 <= position <= self.size:
            raise ValueError('ZIP seek outside archive')
        self.position = position
        return position

    def read(self, size=-1):
        size = self.size - self.position if size < 0 else min(size, self.size - self.position)
        if size > MAX_DIRECTORY_BYTES:
            raise ValueError('ZIP metadata exceeds 16 MiB limit')
        if not size:
            return b''
        result = self.client.range(self.url, self.position, self.position + size - 1)
        self.position += len(result)
        return result


def _matches(name, table):
    # Only the documented family and numeric split suffixes; no fuzzy prefix match.
    return re.fullmatch(re.escape(Path(table.xml_filename).stem) + r'(?:_\d+)?\.xml',
                        name, re.IGNORECASE) is not None


def select_members(archive, limits):
    all_members = archive.infolist()
    if len({info.filename for info in all_members}) != len(all_members):
        raise ValueError('Duplicate ZIP member names')
    selected = {}
    for table in MASTR_BATTERY_TABLES:
        members = [info for info in all_members if _matches(info.filename, table)]
        if not members:
            raise ValueError(f'Missing XML family: {table.xml_filename}')
        selected[table.table_name] = sorted(members, key=lambda info: info.filename)
    infos = [info for members in selected.values() for info in members]
    if len(infos) > limits.max_members:
        raise ValueError('Too many selected ZIP members')
    if sum(info.file_size for info in infos) > limits.max_uncompressed_bytes:
        raise ValueError('Uncompressed ZIP byte budget exceeded')
    for info in infos:
        if (info.file_size <= 0 or info.compress_size <= 0 or info.volume != 0
                or info.flag_bits & ~0x80e or info.compress_type not in (0, 8)):
            raise ValueError(f'Unsupported/empty/encrypted ZIP member: {info.filename}')
    return selected


def _validate_member_header(header_bytes, info):
    reader = io.BytesIO(header_bytes)
    header = reader.read(30)
    if len(header) != 30:
        raise ValueError('Truncated local ZIP header')
    values = struct.unpack('<4s5H3L2H', header)
    if values[0] != b'PK\x03\x04' or values[2] != info.flag_bits or values[3] != info.compress_type:
        raise ValueError('Local/central ZIP header mismatch')
    name = reader.read(values[-2])
    extra = reader.read(values[-1])
    if name.decode('utf-8' if info.flag_bits & 0x800 else 'cp437') != info.filename:
        raise ValueError('Local/central ZIP filename mismatch')
    compressed, uncompressed = values[7:9]
    if compressed == 0xffffffff or uncompressed == 0xffffffff:
        payload = None
        offset = 0
        while offset < len(extra):
            if len(extra) - offset < 4:
                raise ValueError('Invalid ZIP extra field')
            kind, size = struct.unpack_from('<HH', extra, offset)
            offset += 4
            if offset + size > len(extra):
                raise ValueError('Truncated ZIP extra field')
            if kind == 1:
                payload = extra[offset:offset + size]
            offset += size
        needed = 8 * ((uncompressed == 0xffffffff) + (compressed == 0xffffffff))
        if payload is None or len(payload) < needed:
            raise ValueError('Missing ZIP64 local sizes')
        position = 0
        if uncompressed == 0xffffffff:
            uncompressed = struct.unpack_from('<Q', payload)[0]
            position = 8
        if compressed == 0xffffffff:
            compressed = struct.unpack_from('<Q', payload, position)[0]
    if not info.flag_bits & 8 and (values[6], compressed, uncompressed) != (
            info.CRC, info.compress_size, info.file_size):
        raise ValueError('Local/central ZIP CRC or size mismatch')
    return reader.tell()


class _MemberSink:
    """Validate a bounded local header, then copy only compressed payload bytes.

    One HTTP range includes header + payload and at most bounded trailing bytes.
    Its upper bound is the next local header (including unselected members), the
    central directory, or compressed size + maximum possible local header size.
    Retry rewind restores both parser state and the unpublished output position.
    """
    def __init__(self, output, info, range_size):
        self.output, self.info, self.range_size = output, info, range_size
        self.output_start = output.tell()
        self.seek(0)

    def tell(self):
        return self.received

    def seek(self, position):
        if position != 0:
            raise ValueError('Member stream can only rewind to its beginning')
        self.output.seek(self.output_start)
        self.header = bytearray()
        self.header_size = 30
        self.validated = False
        self.received = self.copied = 0

    def truncate(self):
        self.output.truncate()

    def write(self, chunk):
        self.received += len(chunk)
        chunk = memoryview(chunk)
        while not self.validated:
            take = min(self.header_size - len(self.header), len(chunk))
            self.header.extend(chunk[:take])
            chunk = chunk[take:]
            if len(self.header) < self.header_size:
                return
            if self.header_size == 30:
                name_size, extra_size = struct.unpack_from('<HH', self.header, 26)
                self.header_size = 30 + name_size + extra_size
                if self.header_size + self.info.compress_size > self.range_size:
                    raise ValueError('ZIP member overlaps next header/central directory')
                if len(self.header) < self.header_size:
                    continue
            _validate_member_header(self.header, self.info)
            _write_member_header(self.output, self.info)
            self.validated = True
            self.header.clear()
        take = min(len(chunk), self.info.compress_size - self.copied)
        self.output.write(chunk[:take])
        self.copied += take

    def finish(self):
        if not self.validated or self.copied != self.info.compress_size:
            raise ValueError('Truncated ZIP member header/payload')


def _write_member_header(output, info):
    name = info.filename.encode('utf-8')
    large = max(info.file_size, info.compress_size) >= 0xffffffff
    extra = struct.pack('<HHQQ', 1, 16, info.file_size, info.compress_size) if large else b''
    size, compressed = ((0xffffffff, 0xffffffff) if large else (info.file_size, info.compress_size))
    output.write(struct.pack('<4s5H3L2H', b'PK\x03\x04', 45 if large else 20, 0x800,
                             info.compress_type, 0, 33, info.CRC, compressed, size, len(name), len(extra)))
    output.write(name + extra)


def _write_directory(output, entries):
    start = output.tell()
    for info, offset in entries:
        name = info.filename.encode('utf-8')
        # Canonical ZIP64 CD fields avoid stale original offsets/extra fields.
        extra = struct.pack('<HHQQQ', 1, 24, info.file_size, info.compress_size, offset)
        output.write(struct.pack('<4s6H3L5H2L', b'PK\x01\x02', 45, 45, 0x800,
                                 info.compress_type, 0, 33, info.CRC, 0xffffffff, 0xffffffff,
                                 len(name), len(extra), 0, 0, 0, 0, 0xffffffff))
        output.write(name + extra)
    size = output.tell() - start
    zip64_offset = output.tell()
    output.write(struct.pack('<4sQ2H2L4Q', b'PK\x06\x06', 44, 45, 45, 0, 0,
                             len(entries), len(entries), size, start))
    output.write(struct.pack('<4sLQL', b'PK\x06\x07', 0, zip64_offset, 1))
    output.write(struct.pack('<4s4H2LH', b'PK\x05\x06', 0, 0, 0xffff, 0xffff,
                             0xffffffff, 0xffffffff, 0))


def sha256_archive(path, deadline):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(CHUNK_SIZE):
            deadline.check()
            digest.update(chunk)
    return digest.hexdigest()


def manifest_path(path):
    return path.with_suffix(path.suffix + '.manifest.json')


def atomic_json(path, value):
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                     prefix=path.name + '.', suffix='.part', delete=False) as output:
        temporary = Path(output.name)
        try:
            json.dump(value, output, indent=2, sort_keys=True)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def download_selected_export_zip(export_url, raw_dir=DEFAULT_RAW_DIR, *, limits=None, client=None):
    limits = limits or Limits()
    client = client or BoundedHTTP(limits)
    snapshot = snapshot_from_url(export_url)
    reader = RemoteZipReader(export_url, client)
    # Preflight directory contracts/budgets. Local headers are validated during
    # each single streamed member request, before copying its compressed payload.
    with zipfile.ZipFile(reader) as archive:
        if len(archive.infolist()) != reader.entry_count:
            raise ValueError('ZIP central directory entry count mismatch')
        selected = select_members(archive, limits)
        members = [info for group in selected.values() for info in group]
        offsets = sorted(info.header_offset for info in archive.infolist())
        if len(set(offsets)) != len(offsets) or offsets[0] < 0 or offsets[-1] >= archive.start_dir:
            raise ValueError('Duplicate/out-of-bounds ZIP local header offsets')
        boundaries = dict(zip(offsets, offsets[1:] + [archive.start_dir]))
        spans = []
        for info in members:
            end = min(boundaries[info.header_offset],
                      info.header_offset + info.compress_size + MAX_LOCAL_HEADER_BYTES)
            if info.header_offset + 30 + info.compress_size > end:
                raise ValueError('Overlapping ZIP members')
            spans.append((info, end))
    if sum(end - info.header_offset for info, end in spans) + client.bytes > limits.max_bytes:
        raise ValueError('Selected members exceed remaining HTTP byte budget')
    if client.requests + len(members) > limits.max_requests:
        raise ValueError('Selected members exceed remaining HTTP request budget')
    raw_dir = Path(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    destination = raw_dir / (Path(urlsplit(export_url).path).stem + '_battery_subset.zip')
    with tempfile.NamedTemporaryFile(dir=raw_dir, prefix=destination.name + '.',
                                     suffix='.part', delete=False) as output:
        temporary = Path(output.name)
        try:
            entries = []
            for info, end in spans:
                client.deadline.check()
                entries.append((info, output.tell()))
                sink = _MemberSink(output, info, end - info.header_offset)
                client.get(export_url, sink, start=info.header_offset, end=end - 1,
                           cap=limits.max_bytes)
                sink.finish()
            _write_directory(output, entries)
            output.flush()
            os.fsync(output.fileno())
            # CRC validation streams inflated data; no 12+ GB in-memory members.
            with zipfile.ZipFile(temporary) as subset:
                for info in subset.infolist():
                    with subset.open(info) as member:
                        while member.read(CHUNK_SIZE):
                            client.deadline.check()
            digest = sha256_archive(temporary, client.deadline)
            manifest = {'schema_version': 1, 'acquisition': 'http_range_subset',
                        'snapshot_date': snapshot.isoformat(), 'source_url': export_url,
                        'archive_sha256': digest, 'filename': destination.name,
                        'archive_bytes': temporary.stat().st_size,
                        'source_archive_bytes': reader.size,
                        'source_etag': client.etag,
                        'retrieved_at': datetime.now(timezone.utc).isoformat(),
                        'http_requests': client.requests, 'http_bytes': client.bytes,
                        'members': [info.filename for info in members]}
            os.replace(temporary, destination)
            atomic_json(manifest_path(destination), manifest)
        finally:
            temporary.unlink(missing_ok=True)
    return destination


def local_provenance(path, source_url, snapshot_date, deadline):
    """Hash the actual input every time; sidecars are evidence, never cache validity."""
    snapshot = date.fromisoformat(str(snapshot_date))
    if snapshot_from_url(source_url) != snapshot:
        raise ValueError('Explicit snapshot date does not match source URL')
    digest = sha256_archive(path, deadline)
    supplied = {'schema_version': 1, 'acquisition': 'local_user_supplied',
                'snapshot_date': snapshot.isoformat(), 'source_url': source_url,
                'archive_sha256': digest, 'filename': path.name, 'archive_bytes': path.stat().st_size,
                'verified_at': datetime.now(timezone.utc).isoformat()}
    sidecar = manifest_path(path)
    if sidecar.exists():
        if sidecar.stat().st_size > 1_000_000:
            raise ValueError('Oversized provenance manifest')
        existing = json.loads(sidecar.read_text())
        for key in ('snapshot_date', 'source_url', 'archive_sha256', 'filename', 'archive_bytes'):
            if existing.get(key) != supplied[key]:
                raise ValueError(f'Provenance manifest mismatch: {key}')
        return existing
    return supplied


class _XMLTokenGuard:
    """Bound incomplete tokens *before* feeding Expat's internal token buffer.

    ASCII-compatible XML only. Tags respect quoted '>' characters; comments,
    CDATA, processing instructions and entity references have their own ends.
    Text is skipped with a C regex search; only an incomplete token is retained.
    """
    starts = re.compile(rb'[<&]')
    tag_delimiters = re.compile(rb'[>\x22\x27]')

    def __init__(self):
        self.pending = b''

    def feed(self, chunk):
        if b'\x00' in chunk:
            raise ValueError('Only ASCII-compatible XML encodings are supported')
        data = self.pending + chunk
        self.pending = b''
        position = 0
        while match := self.starts.search(data, position):
            start = match.start()
            stop = min(len(data), start + MAX_XML_TOKEN_BYTES + 1)
            end = -1
            token = data[start:min(stop, start + 9)]
            special = ((b'<!--', b'-->'), (b'<![CDATA[', b']]>'), (b'<?', b'?>'))
            incomplete_prefix = any(len(token) < len(prefix) and prefix.startswith(token)
                                    for prefix, _ in special)
            if data[start] == ord('&'):
                found = data.find(b';', start + 1, stop)
                if found >= 0:
                    end = found + 1
            elif incomplete_prefix:
                pass
            elif token.startswith(tuple(prefix for prefix, _ in special)):
                prefix, terminator = next(pair for pair in special if token.startswith(pair[0]))
                found = data.find(terminator, start + len(prefix), stop)
                if found >= 0:
                    end = found + len(terminator)
            elif token.startswith(b'<!'):
                raise ValueError('DTD/entity declarations are forbidden in MaStR XML')
            else:
                quote = None
                for delimiter in self.tag_delimiters.finditer(data, start + 1, stop):
                    value = data[delimiter.start()]
                    if quote is not None:
                        if value == quote:
                            quote = None
                    elif value == ord('>'):
                        end = delimiter.end()
                        break
                    else:
                        quote = value
            if (end < 0 and len(data) - start > MAX_XML_TOKEN_BYTES) or end - start > MAX_XML_TOKEN_BYTES:
                raise ValueError('XML token exceeds 16 KiB limit before Expat')
            if end < 0:
                self.pending = data[start:]
                return
            position = end


def _parse_member(member, table, emit, deadline):
    """Streaming XML with bounded lexical tokens, names, attributes and fields."""
    # Official exports use BOM-marked UTF-16. Decode only bounded chunks for
    # lexical checks; Expat receives the original bytes after those checks.
    # Strict incremental decoding handles split code units/surrogates without
    # letting zero bytes hide oversized tokens from the ASCII-compatible guard.
    prefix = b''
    while len(prefix) < 4:
        deadline.check()
        part = member.read(4 - len(prefix))
        if not part:
            break
        prefix += part
    if prefix.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)):
        raise ValueError('UTF-32 XML is not supported')
    utf16 = prefix.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE))
    decoder = codecs.getincrementaldecoder('utf-16')(errors='strict') if utf16 else None
    parser = expat.ParserCreate(namespace_separator='}')
    guard = _XMLTokenGuard()
    stack = []
    record = None
    field_text = []
    field_size = 0
    record_size = 0
    null_field = False
    namespace_count = 0
    seen = set()
    required = frozenset(table.required_columns)
    count = 0

    def reject(*args):
        raise ValueError('DTD/entity declarations are forbidden in MaStR XML')

    def namespace(prefix, uri):
        nonlocal namespace_count
        namespace_count += 1
        if (namespace_count > MAX_XML_ATTRIBUTES or len(prefix or '') > MAX_XML_NAME_CHARACTERS
                or len(uri or '') > MAX_XML_ATTRIBUTE_CHARACTERS):
            raise ValueError('XML namespace attribute limit exceeded')

    def declaration(version, encoding, standalone):
        allowed = ('utf-16',) if utf16 else ('utf-8', 'us-ascii')
        if encoding and encoding.lower() not in allowed:
            raise ValueError('XML encoding declaration does not match supported input encoding')

    def start(name, attrs):
        nonlocal record, field_text, field_size, record_size, null_field, namespace_count
        if len(name) > MAX_XML_NAME_CHARACTERS:
            raise ValueError('XML name length limit exceeded')
        if len(attrs) + namespace_count > MAX_XML_ATTRIBUTES:
            raise ValueError('XML attribute count limit exceeded')
        namespace_count = 0
        for attr, value in attrs.items():
            if len(attr) > MAX_XML_NAME_CHARACTERS or len(value) > MAX_XML_ATTRIBUTE_CHARACTERS:
                raise ValueError('XML attribute name/value limit exceeded')
            if attr == 'NV' and len(stack) == 2:
                if value not in ('true', 'false', '1', '0'):
                    raise ValueError('Invalid NV null marker; expected true/false/1/0')
            elif len(stack) == 0 and attr in (
                    'http://www.w3.org/2001/XMLSchema-instance}schemaLocation',
                    'http://www.w3.org/2001/XMLSchema-instance}noNamespaceSchemaLocation'):
                pass
            else:
                raise ValueError(f'Unsupported XML attribute: {attr}')
        name = name.rsplit('}', 1)[-1]
        stack.append(name)
        if len(stack) > 32:
            raise ValueError('XML nesting limit exceeded')
        if len(stack) == 1 and name != Path(table.xml_filename).stem:
            raise ValueError(f'Unexpected XML root {name}')
        if len(stack) == 2:
            if name != table.record_tag:
                raise ValueError(f'Unexpected record tag {name}')
            record = {}
            record_size = 0
        if len(stack) == 3:
            field_text, field_size = [], 0
            null_field = attrs.get('NV') in ('true', '1')
            if len(record) >= 512:
                raise ValueError('Too many fields in XML record')
            if name in record:
                raise ValueError(f'Duplicate XML field {name}')

    def text(value):
        nonlocal field_size, record_size
        if len(stack) >= 3:
            field_size += len(value)
            record_size += len(value)
            if field_size > 1_000_000:
                raise ValueError('XML field exceeds 1M character limit')
            if record_size > 4_000_000:
                raise ValueError('XML record exceeds 4M character limit')
            field_text.append(value)

    def end(name):
        nonlocal record, count
        name = name.rsplit('}', 1)[-1]
        if len(stack) == 3:
            value = ''.join(field_text).strip() or None
            if null_field and value is not None:
                raise ValueError('NV null marker conflicts with nonempty field content')
            record[name] = value
        elif len(stack) == 2:
            if not record.get(table.key):
                raise ValueError(f'Missing required key {table.key}')
            seen.update(required.intersection(record))
            emit({column: record.get(column) for column in table.columns})
            count += 1
            record = None
        stack.pop()

    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.CharacterDataHandler = text
    parser.StartDoctypeDeclHandler = reject
    parser.EntityDeclHandler = reject
    parser.ExternalEntityRefHandler = reject
    parser.StartNamespaceDeclHandler = namespace
    parser.XmlDeclHandler = declaration
    chunk = prefix + member.read(CHUNK_SIZE - len(prefix))
    while chunk:
        deadline.check()
        guard.feed(decoder.decode(chunk).encode('utf-8') if decoder else chunk)
        parser.Parse(chunk, False)
        chunk = member.read(CHUNK_SIZE)
    if decoder:
        guard.feed(decoder.decode(b'', final=True).encode('utf-8'))
    parser.Parse(b'', True)
    if not count:
        raise ValueError(f'Empty XML member for {table.table_name}')
    return count, seen


def ingest_xml_table(con, archive, members, table, limits, deadline, batch_size=10_000):
    columns = ', '.join(f'"{column}" VARCHAR' + (' PRIMARY KEY' if column == table.key else '')
                        for column in table.columns)
    con.execute(f'CREATE OR REPLACE TABLE staging.{table.table_name} ({columns})')
    batch = []
    batch_characters = 0
    rows = 0
    seen = set()
    # One typed JSON parameter avoids DuckDB 1.1.x's costly Python list binding
    # across dozens of columns. Preserve source strings/nulls without inference.
    batch_schema = json.dumps([{column: 'VARCHAR' for column in table.columns}])

    def flush():
        nonlocal batch_characters
        if batch:
            deadline.check()
            con.execute(f'INSERT INTO staging.{table.table_name} '
                        'SELECT record.* FROM (SELECT unnest(from_json(?, ?)) AS record)',
                        [json.dumps(batch), batch_schema])
            batch.clear()
            batch_characters = 0
            deadline.check()

    def emit(record):
        nonlocal rows, batch_characters
        rows += 1
        if rows > limits.max_rows_per_table:
            raise ValueError('Table row budget exceeded')
        batch.append(record)
        batch_characters += sum(len(value) for value in record.values() if value is not None)
        if len(batch) >= batch_size or batch_characters >= 8_000_000:
            flush()

    for info in members:
        with archive.open(info) as member:
            _, fields = _parse_member(member, table, emit, deadline)
            seen.update(fields)
    if missing := set(table.required_columns) - seen:
        raise ValueError(f'Missing required source columns in {table.table_name}: {sorted(missing)}')
    flush()
    actual = con.execute(f'SELECT count(*) FROM staging.{table.table_name}').fetchone()[0]
    if actual != rows or rows == 0:
        raise ValueError(f'Invalid row count in {table.table_name}')
    return rows
