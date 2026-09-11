"""Offline battery-only recovery tests. No production DB access or live HTTP."""
import hashlib
import io
import json
import struct
import tempfile
import unittest
import zipfile
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import duckdb
import requests

from src.data_pipelines.get_raw_data import ingest_mastr_data as ingestion
from src.tools.datasources.mastr_helper import mastr_export as m


URL = 'https://download.marktstammdatenregister.de/Gesamtdatenexport_20260911_26.1.zip'
DAY = '2026-09-11'


def xml(table, key='1', *, missing=None):
    fields = ''.join(f'<{column}>{key if column == table.key else "value"}</{column}>'
                     for column in table.columns if column != missing)
    return (f'<{Path(table.xml_filename).stem}><{table.record_tag}>{fields}</{table.record_tag}>'
            f'</{Path(table.xml_filename).stem}>').encode()


def fixture(*, changes=None, omit=None, zip64=False, extra=None, stored=False):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED) as archive:
        for table in m.MASTR_BATTERY_TABLES:
            if table.xml_filename == omit:
                continue
            value = (changes or {}).get(table.xml_filename, xml(table))
            with archive.open(table.xml_filename, 'w', force_zip64=zip64) as member:
                member.write(value)
        for name, value in (extra or {}).items():
            archive.writestr(name, value)
    return output.getvalue()


class Response:
    def __init__(self, body, status=200, headers=None, chunks=None):
        self.body, self.status_code = body, status
        self.headers = {'Content-Length': str(len(body)), **(headers or {})}
        self.chunks = chunks

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def iter_content(self, size):
        if self.chunks is not None:
            yield from self.chunks
        else:
            for offset in range(0, len(self.body), size):
                yield self.body[offset:offset + size]

    def raise_for_status(self):
        raise requests.HTTPError(str(self.status_code))


class FakeServer:
    def __init__(self, data, page=None):
        self.data, self.page = data, page
        self.calls = []

    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        assert kwargs['allow_redirects'] is False
        assert kwargs['stream'] is True
        if 'Range' not in kwargs['headers']:
            return Response(self.page)
        start, end = map(int, kwargs['headers']['Range'][6:].split('-'))
        return Response(self.data[start:end + 1], 206,
                        {'Content-Range': f'bytes {start}-{end}/{len(self.data)}', 'ETag': '"fixture"'})


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / 'input.zip'
        self.database = self.root / 'battery.duckdb'
        self.archive.write_bytes(fixture())
        self.no_network = patch.object(m.requests, 'get', side_effect=AssertionError('No live HTTP'))
        self.no_network.start()
        self.addCleanup(self.no_network.stop)

    def ingest(self, **kwargs):
        return ingestion.ingest_mastr_battery_data(URL, self.archive, snapshot_date=DAY,
                                                   database=self.database, **kwargs)

    def prior_state(self):
        with duckdb.connect(str(self.database)) as con:
            return {table: con.execute(f'SELECT * FROM staging.{table}').fetchall()
                    for table in [t.table_name for t in m.MASTR_BATTERY_TABLES] + ['mastr_snapshot']}

    def assert_rollback(self, data, **kwargs):
        self.ingest()
        before = self.prior_state()
        m.manifest_path(self.archive).unlink()
        self.archive.write_bytes(data)
        with self.assertRaises(Exception):
            self.ingest(**kwargs)
        self.assertEqual(before, self.prior_state())

    def test_all_five_tables_columns_keys_counts_and_provenance(self):
        counts = self.ingest()
        self.assertEqual(counts, {t.table_name: 1 for t in m.MASTR_BATTERY_TABLES})
        with duckdb.connect(str(self.database)) as con:
            for table in m.MASTR_BATTERY_TABLES:
                columns = con.execute(f'DESCRIBE staging.{table.table_name}').fetchall()
                self.assertEqual(tuple(row[0] for row in columns), table.columns)
            row = con.execute('SELECT * FROM staging.mastr_snapshot').fetchone()
            self.assertEqual(str(row[0]), DAY)
            self.assertEqual(row[1:], (URL, hashlib.sha256(self.archive.read_bytes()).hexdigest(), 'input.zip'))
        manifest = json.loads(m.manifest_path(self.archive).read_text())
        self.assertEqual(manifest['acquisition'], 'local_user_supplied')
        self.assertNotIn('retrieved_at', manifest)
        self.assertIn('verified_at', manifest)
        self.assertEqual(self.ingest(), counts)

    def test_local_requires_explicit_date_and_source(self):
        for args in ({}, {'snapshot_date': DAY}, {'export_url': URL}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                ingestion.ingest_mastr_battery_data(zip_path=self.archive, database=self.database, **args)
        self.assertFalse(self.database.exists())

    def test_batch_preserves_source_strings_nulls_and_escaping(self):
        from xml.sax.saxutils import escape
        table = m.MASTR_BATTERY_TABLES[0]
        values = ['001.2300', 'NaN', 'ä "quoted" \\ path\nsecond line', None]
        source = xml(table)
        for column, value in zip(table.columns[1:5], values):
            source = source.replace(f'<{column}>value</{column}>'.encode(),
                                    f'<{column}>{escape(value or "")}</{column}>'.encode())
        self.archive.write_bytes(fixture(changes={table.xml_filename: source}))
        self.ingest()
        with duckdb.connect(str(self.database)) as con:
            columns = ', '.join(f'"{column}"' for column in table.columns[1:5])
            self.assertEqual(con.execute(f'SELECT {columns} FROM staging.{table.table_name}').fetchone(),
                             tuple(values))

    def test_snapshot_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'snapshot date'):
            ingestion.ingest_mastr_battery_data(URL, self.archive, snapshot_date='2026-06-30', database=self.database)
        self.assertFalse(self.database.exists())

    def test_protected_database_and_symlink_rejected_before_io(self):
        with self.assertRaisesRegex(ValueError, 'protected'):
            ingestion.ingest_mastr_battery_data(database=ingestion.PROTECTED_DATABASE)
        alias = self.root / 'alias.duckdb'
        alias.symlink_to(ingestion.PROTECTED_DATABASE)
        with self.assertRaisesRegex(ValueError, 'protected'):
            ingestion.ingest_mastr_battery_data(database=alias)

    def test_every_missing_family_preflight(self):
        for table in m.MASTR_BATTERY_TABLES:
            with self.subTest(table=table.table_name):
                self.archive.write_bytes(fixture(omit=table.xml_filename))
                with self.assertRaisesRegex(ValueError, 'Missing XML family'):
                    self.ingest()
                self.assertFalse(self.database.exists())

    def test_malformed_last_family_rolls_back_all_five_and_snapshot(self):
        last = m.MASTR_BATTERY_TABLES[-1]
        self.assert_rollback(fixture(changes={last.xml_filename: xml(last)[:-10]}))

    def test_duplicate_ids_across_parts_roll_back(self):
        table = m.MASTR_BATTERY_TABLES[0]
        self.assert_rollback(fixture(extra={'EinheitenStromSpeicher_2.xml': xml(table)}))

    def test_numeric_parts_accepted(self):
        table = m.MASTR_BATTERY_TABLES[0]
        self.archive.write_bytes(fixture(extra={'EinheitenStromSpeicher_2.xml': xml(table, '2')}))
        self.assertEqual(self.ingest()[table.table_name], 2)

    def test_missing_required_column_rolls_back(self):
        table = m.MASTR_BATTERY_TABLES[-1]
        self.assert_rollback(fixture(changes={table.xml_filename: xml(table, missing='Name')}))

    def test_each_analysis_contract_column_missing_rolls_back(self):
        self.ingest()
        before = self.prior_state()
        m.manifest_path(self.archive).unlink()
        for table, fields in ((m.MASTR_BATTERY_TABLES[0], ('Land', 'Technologie', 'EinheitSystemstatus')),
                              (m.MASTR_BATTERY_TABLES[1], ('VerknuepfteEinheitenMaStRNummern',
                                                          'AnlageBetriebsstatus'))):
            for field in fields:
                with self.subTest(field=field):
                    self.archive.write_bytes(fixture(changes={table.xml_filename: xml(table, missing=field)}))
                    with self.assertRaisesRegex(ValueError, 'Missing required source columns.*' + field):
                        self.ingest()
                    self.assertEqual(before, self.prior_state())

    def test_required_presence_across_parts_allows_row_nulls(self):
        table = m.MASTR_BATTERY_TABLES[0]
        # The first part omits Land, the second explicitly contains an empty Land.
        second = xml(table, '2').replace(b'<Land>value</Land>', b'<Land NV="true"/>')
        self.archive.write_bytes(fixture(changes={table.xml_filename: xml(table, missing='Land')},
                                        extra={'EinheitenStromSpeicher_2.xml': second}))
        self.assertEqual(self.ingest()[table.table_name], 2)
        with duckdb.connect(str(self.database)) as con:
            self.assertEqual(con.execute(f'SELECT Land FROM staging.{table.table_name}').fetchall(),
                             [(None,), (None,)])

    def test_invalid_null_marker_rolls_back(self):
        table = m.MASTR_BATTERY_TABLES[-1]
        self.assert_rollback(fixture(changes={table.xml_filename: xml(table).replace(
            b'<Name>value</Name>', b'<Name NV="true">value</Name>')}))

    def test_missing_key_rolls_back(self):
        table = m.MASTR_BATTERY_TABLES[-1]
        self.assert_rollback(fixture(changes={table.xml_filename: xml(table, missing='Id')}))

    def test_empty_wrong_root_and_dtd_rejected(self):
        table = m.MASTR_BATTERY_TABLES[-1]
        for value in (b'<Katalogkategorien/>', b'<wrong/>',
                      b'<!DOCTYPE Katalogkategorien [<!ENTITY x "boom">]>' + xml(table)):
            with self.subTest(value=value):
                self.archive.write_bytes(fixture(changes={table.xml_filename: value}))
                with self.assertRaises(ValueError):
                    self.ingest()

    def test_changed_archive_does_not_trust_stale_manifest(self):
        self.ingest()
        before = self.prior_state()
        self.archive.write_bytes(fixture(zip64=True))
        with self.assertRaisesRegex(ValueError, 'manifest mismatch'):
            self.ingest()
        self.assertEqual(before, self.prior_state())

    def test_wrong_provenance_url_rejected(self):
        self.ingest()
        path = m.manifest_path(self.archive)
        manifest = json.loads(path.read_text())
        manifest['source_url'] = URL.replace('26.1', '26.2')
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'source_url'):
            self.ingest()

    def test_crc_corruption_rolls_back(self):
        data = bytearray(fixture(stored=True))
        table = m.MASTR_BATTERY_TABLES[-1]
        position = data.index(xml(table))
        data[position + xml(table).index(b'value')] = ord('V')
        self.assert_rollback(bytes(data))

    def test_row_and_uncompressed_budgets(self):
        table = m.MASTR_BATTERY_TABLES[0]
        self.assert_rollback(fixture(extra={'EinheitenStromSpeicher_2.xml': xml(table, '2')}),
                             limits=replace(m.Limits(), max_rows_per_table=1))
        with self.assertRaisesRegex(ValueError, 'Uncompressed'):
            self.ingest(limits=replace(m.Limits(), max_uncompressed_bytes=1))

    def test_deadline_failure_preserves_staging(self):
        self.ingest()
        before = self.prior_state()
        with patch.object(m.Deadline, 'check', side_effect=TimeoutError('deadline')):
            with self.assertRaises(TimeoutError):
                self.ingest()
        self.assertEqual(before, self.prior_state())

    def test_deadline_during_second_table_rolls_back_first_replacement(self):
        self.ingest()
        before = self.prior_state()
        original = m._parse_member
        calls = 0

        def expire(*args):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise TimeoutError('parse deadline')
            return original(*args)

        with patch.object(m, '_parse_member', side_effect=expire):
            with self.assertRaises(TimeoutError):
                self.ingest()
        self.assertEqual(calls, 2)
        self.assertEqual(before, self.prior_state())

    def test_namespaced_source_xml(self):
        changes = {}
        for table in m.MASTR_BATTERY_TABLES:
            root = Path(table.xml_filename).stem.encode()
            changes[table.xml_filename] = xml(table).replace(
                b'<' + root + b'>', b'<' + root + b' xmlns="urn:mastr-fixture">', 1)
        self.archive.write_bytes(fixture(changes=changes))
        self.assertEqual(sum(self.ingest().values()), 5)

    def test_manifest_write_failure_rolls_back(self):
        self.ingest()
        before = self.prior_state()
        with patch.object(ingestion, 'atomic_json', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.ingest()
        self.assertEqual(before, self.prior_state())


class XMLBoundsTests(unittest.TestCase):
    def parse(self, data, member=None):
        rows = []
        count, seen = m._parse_member(member or io.BytesIO(data), m.MASTR_BATTERY_TABLES[-1],
                                     rows.append, m.Deadline(10))
        return count, seen, rows

    def test_5mb_attribute_stopped_before_expat_buffers_it(self):
        data = xml(m.MASTR_BATTERY_TABLES[-1]).replace(b'<Name>', b'<Name NV="' + b'x' * 5_000_000 + b'">')
        member = io.BytesIO(data)
        original = m.expat.ParserCreate
        parser = original(namespace_separator='}')

        class Spy:
            def __init__(self):
                object.__setattr__(self, 'fed', 0)

            def __setattr__(self, name, value):
                setattr(parser, name, value)

            def Parse(self, chunk, final):
                object.__setattr__(self, 'fed', self.fed + len(chunk))
                parser.Parse(chunk, final)

        spy = Spy()
        with patch.object(m.expat, 'ParserCreate', return_value=spy):
            with self.assertRaisesRegex(ValueError, 'before Expat'):
                self.parse(data, member)
        self.assertLessEqual(member.tell(), m.CHUNK_SIZE)
        self.assertLessEqual(spy.fed, m.MAX_XML_TOKEN_BYTES)

    def test_token_guard_handles_quotes_and_chunk_boundaries(self):
        guard = m._XMLTokenGuard()
        for chunk in (b'<Name NV="', b'>' * 8000, b'>' * 8000):
            guard.feed(chunk)
        with self.assertRaisesRegex(ValueError, 'before Expat'):
            guard.feed(b'x' * 500)
        for size in (1, 7, 64):
            guard = m._XMLTokenGuard()
            data = b'<?xml version="1.0"?><r><!-- <x> --><![CDATA[<a>]]><n a="a>b"/>x&amp;y</r>'
            for offset in range(0, len(data), size):
                guard.feed(data[offset:offset + size])
            self.assertEqual(guard.pending, b'')

    def test_large_name_attribute_value_and_count_rejected(self):
        for tag, message in (
                (b'<' + b'x' * 257 + b'/>', 'name length'),
                (b'<Name NV="' + b'x' * 1025 + b'"/>', 'attribute name/value'),
                (b'<Name ' + b' '.join(f'a{i}="x"'.encode() for i in range(17)) + b'/>', 'attribute count'),
                (b'<Name other="x"/>', 'Unsupported XML attribute'),
                (b'<Name ' + b'x' * 257 + b'="x"/>', 'attribute name/value')):
            data = xml(m.MASTR_BATTERY_TABLES[-1]).replace(b'<Name>value</Name>', tag)
            with self.subTest(tag=tag[:50]), self.assertRaisesRegex(ValueError, message):
                self.parse(data)

    def test_unknown_fields_never_accumulate_in_family_seen(self):
        records = []
        for i in range(2000):
            records.append(f'<Katalogkategorie><Id>{i}</Id><Name>value</Name>'
                           f'<unknown_{i}>ignored</unknown_{i}></Katalogkategorie>')
        count, seen, rows = self.parse(('<Katalogkategorien>' + ''.join(records) + '</Katalogkategorien>').encode())
        self.assertEqual(count, 2000)
        self.assertEqual(seen, {'Id', 'Name'})
        self.assertTrue(all(set(row) == {'Id', 'Name'} for row in rows))

    def test_unknown_fields_bounded_per_record(self):
        data = xml(m.MASTR_BATTERY_TABLES[-1]).replace(
            b'</Katalogkategorie>', b''.join(f'<x{i}/>'.encode() for i in range(513)) + b'</Katalogkategorie>')
        with self.assertRaisesRegex(ValueError, 'Too many fields'):
            self.parse(data)

    def test_nv_null_marker_lexical_contract(self):
        for marker, content, expected in (('true', '', None), ('1', ' ', None),
                                           ('false', 'value', 'value'), ('0', 'value', 'value')):
            data = xml(m.MASTR_BATTERY_TABLES[-1]).replace(
                b'<Name>value</Name>', f'<Name NV="{marker}">{content}</Name>'.encode())
            count, seen, rows = self.parse(data)
            self.assertEqual((count, seen, rows[0]['Name']), (1, {'Id', 'Name'}, expected))
        for marker in ('', 'yes', 'True', '2'):
            data = xml(m.MASTR_BATTERY_TABLES[-1]).replace(
                b'<Name>value</Name>', f'<Name NV="{marker}"/>'.encode())
            with self.assertRaisesRegex(ValueError, 'Invalid NV'):
                self.parse(data)

    def test_utf16_cannot_bypass_token_guard(self):
        with self.assertRaisesRegex(ValueError, 'ASCII-compatible'):
            self.parse(xml(m.MASTR_BATTERY_TABLES[-1]).decode().encode('utf-16'))


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def download(self, data, **kwargs):
        server = FakeServer(data)
        with patch.object(m.requests, 'get', side_effect=server):
            path = m.download_selected_export_zip(URL, self.root, **kwargs)
        return path, server

    def test_classic_and_zip64_streamed_subset_crc_and_manifest(self):
        for zip64 in (False, True):
            with self.subTest(zip64=zip64):
                path, server = self.download(fixture(zip64=zip64, extra={'unrelated.xml': b'unused'}))
                with zipfile.ZipFile(path) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(set(archive.namelist()), {t.xml_filename for t in m.MASTR_BATTERY_TABLES})
                    for table in m.MASTR_BATTERY_TABLES:
                        self.assertEqual(archive.read(table.xml_filename), xml(table))
                manifest = json.loads(m.manifest_path(path).read_text())
                self.assertEqual(manifest['archive_sha256'], hashlib.sha256(path.read_bytes()).hexdigest())
                self.assertEqual(manifest['source_url'], URL)
                self.assertEqual(manifest['http_requests'], len(server.calls))
                self.assertIn('retrieved_at', manifest)
                # Feed our canonical ZIP64 central directory back as the remote source.
                recovered, _ = self.download(path.read_bytes())
                with zipfile.ZipFile(recovered) as archive:
                    self.assertIsNone(archive.testzip())

    def test_stale_nonempty_file_is_replaced_only_after_validation(self):
        destination = self.root / 'Gesamtdatenexport_20260911_26.1_battery_subset.zip'
        destination.write_bytes(b'stale')
        path, server = self.download(fixture())
        self.assertEqual(path, destination)
        self.assertTrue(server.calls)
        self.assertNotEqual(path.read_bytes(), b'stale')
        prior = path.read_bytes()
        data = bytearray(fixture(stored=True))
        data[data.index(b'value')] = ord('V')
        with self.assertRaises(zipfile.BadZipFile):
            self.download(bytes(data))
        self.assertEqual(path.read_bytes(), prior)
        self.assertFalse(list(self.root.glob('*.part')))

    def test_82_members_success_with_discovery_and_zip64_under_96_requests(self):
        extras = {f'EinheitenStromSpeicher_{i}.xml': xml(m.MASTR_BATTERY_TABLES[0], str(i))
                  for i in range(2, 79)}
        extras['unrelated.xml'] = b'not selected' * 20000
        for zip64 in (False, True):
            with self.subTest(zip64=zip64):
                # Force genuine ZIP64 EOCD/locator/CD as well as local sizes.
                with patch.object(zipfile, 'ZIP64_LIMIT', 1 if zip64 else zipfile.ZIP64_LIMIT):
                    data = fixture(extra=extras, stored=True, zip64=zip64)
                server = FakeServer(data, f'<a href="{URL}">snapshot</a>'.encode())
                limits = replace(m.Limits(), max_requests=96)
                client = m.BoundedHTTP(limits)
                with patch.object(m.requests, 'get', side_effect=server):
                    url = m.discover_current_export_url(client=client)
                    path = m.download_selected_export_zip(url, self.root, limits=limits, client=client)
                self.assertLessEqual(client.requests, 96)
                self.assertEqual(client.requests, len(server.calls))
                with zipfile.ZipFile(path) as subset:
                    self.assertEqual(len(subset.infolist()), 82)
                    self.assertIsNone(subset.testzip())
                with zipfile.ZipFile(io.BytesIO(data)) as source:
                    selected = m.select_members(source, limits)
                    for group in selected.values():
                        for info in group:
                            calls = [kwargs for _, kwargs in server.calls
                                     if kwargs['headers'].get('Range', '').startswith(f'bytes={info.header_offset}-')
                                     and kwargs['headers']['Range'] != 'bytes=0-0']
                            self.assertEqual(len(calls), 1, info.filename)
                manifest = json.loads(m.manifest_path(path).read_text())
                self.assertEqual(manifest['http_requests'], client.requests)

    def test_member_sink_streams_payload_and_rewinds_partial_retry(self):
        data = fixture(stored=True, changes={m.MASTR_BATTERY_TABLES[0].xml_filename:
                                             xml(m.MASTR_BATTERY_TABLES[0]) + b' ' * 300000})
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            info = archive.infolist()[0]
            end = archive.infolist()[1].header_offset
        output = io.BytesIO()
        sink = m._MemberSink(output, info, end)

        def broken():
            yield data[:100000]
            self.assertGreater(output.tell(), 0)
            self.assertLessEqual(len(sink.header), m.MAX_LOCAL_HEADER_BYTES)
            raise requests.ConnectionError('payload interrupted')

        headers = {'Content-Range': f'bytes 0-{end - 1}/{len(data)}'}
        responses = [Response(data[:end], 206, headers, chunks=broken()), Response(data[:end], 206, headers)]
        with patch.object(m.requests, 'get', side_effect=responses):
            client = m.BoundedHTTP(m.Limits())
            client.get(URL, sink, start=0, end=end - 1)
        sink.finish()
        self.assertEqual(client.requests, 2)
        self.assertEqual(client.bytes, 100000 + end)
        m._write_directory(output, [(info, 0)])
        with zipfile.ZipFile(output) as archive:
            self.assertIsNone(archive.testzip())

    def test_member_header_cannot_cross_next_local_header(self):
        data = bytearray(fixture())
        struct.pack_into('<H', data, 28, 65535)
        with self.assertRaisesRegex(ValueError, 'overlaps next header'):
            self.download(bytes(data))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_missing_family_rejected_before_output_writes(self):
        with self.assertRaisesRegex(ValueError, 'Missing XML family'):
            self.download(fixture(omit='Katalogwerte.xml'))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_local_header_mismatch_rejected_before_output_writes(self):
        data = bytearray(fixture())
        data[30] = ord('X')
        with self.assertRaisesRegex(ValueError, 'filename mismatch'):
            self.download(bytes(data))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_discovered_snapshot_pin_fails_before_archive_fetch(self):
        with patch.object(ingestion, 'discover_current_export_url', return_value=URL), \
                patch.object(ingestion, 'download_selected_export_zip') as download:
            with self.assertRaisesRegex(ValueError, 'snapshot date'):
                ingestion.ingest_mastr_battery_data(snapshot_date='2026-09-10',
                                                   database=self.root / 'battery.duckdb')
            download.assert_not_called()
        self.assertEqual(list(self.root.iterdir()), [])

    def test_multidisk_and_wrong_counts_rejected_before_output_writes(self):
        for offset, value in ((4, 1), (8, 3), (10, 3)):
            data = bytearray(fixture())
            end = data.rfind(b'PK\x05\x06')
            struct.pack_into('<H', data, end + offset, value)
            with self.subTest(offset=offset), self.assertRaises(ValueError):
                self.download(bytes(data))
            self.assertEqual(list(self.root.iterdir()), [])

    def test_bad_ranges_lengths_status_encoding_rejected_no_retry(self):
        cases = [Response(b'x', 200), Response(b'x', 302),
                 Response(b'x', 206, {'Content-Range': 'bytes 1-1/100'}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/*'}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/0'}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/100', 'Content-Length': '2'}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/100', 'Content-Encoding': 'gzip'}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/100', 'Content-Length': None}),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/100'}, chunks=[]),
                 Response(b'x', 206, {'Content-Range': 'bytes 0-0/100'}, chunks=[b'xx'])]
        for response in cases:
            with self.subTest(headers=response.headers), patch.object(m.requests, 'get', return_value=response) as get:
                with self.assertRaises(ValueError):
                    m.BoundedHTTP(m.Limits()).range(URL, 0, 0)
                self.assertEqual(get.call_count, 1)

    def test_total_and_etag_change_rejected(self):
        for headers in ({'Content-Range': 'bytes 1-1/101', 'ETag': '"a"'},
                        {'Content-Range': 'bytes 1-1/100', 'ETag': '"b"'}):
            responses = [Response(b'x', 206, {'Content-Range': 'bytes 0-0/100', 'ETag': '"a"'}),
                         Response(b'x', 206, headers)]
            with patch.object(m.requests, 'get', side_effect=responses):
                client = m.BoundedHTTP(m.Limits())
                client.range(URL, 0, 0)
                with self.assertRaises(ValueError):
                    client.range(URL, 1, 1)

    def test_small_retry_and_shared_request_byte_budgets(self):
        with patch.object(m.requests, 'get', side_effect=requests.ConnectionError) as get:
            with self.assertRaises(requests.ConnectionError):
                m.BoundedHTTP(m.Limits()).range(URL, 0, 0)
            self.assertEqual(get.call_count, 2)
        for limits in (replace(m.Limits(), max_requests=1), replace(m.Limits(), max_bytes=1)):
            server = FakeServer(fixture())
            with patch.object(m.requests, 'get', side_effect=server):
                client = m.BoundedHTTP(limits)
                client.range(URL, 0, 0)
                with self.assertRaises(ValueError):
                    client.range(URL, 0, 0)
            self.assertEqual(len(server.calls), 1)

    def test_partial_retry_counts_bytes_and_truncates_output(self):
        def broken():
            yield b'x'
            raise requests.ConnectionError('interrupted')
        responses = [Response(b'xx', 206, {'Content-Range': 'bytes 0-1/100'}, chunks=broken()),
                     Response(b'xx', 206, {'Content-Range': 'bytes 0-1/100'})]
        client = m.BoundedHTTP(m.Limits())
        with patch.object(m.requests, 'get', side_effect=responses):
            self.assertEqual(client.range(URL, 0, 1), b'xx')
        self.assertEqual(client.bytes, 3)
        self.assertEqual(client.requests, 2)

    def test_deadline_before_request(self):
        with patch.object(m.requests, 'get') as get:
            client = m.BoundedHTTP(m.Limits())
            client.deadline.ends = 0
            with self.assertRaises(TimeoutError):
                client.range(URL, 0, 0)
            get.assert_not_called()

    def test_discovery_newest_official_link_not_first(self):
        old = URL.replace('20260911', '20260630')
        page = f"<a href='{old}'>old</a><a href='{URL}'>current</a>".encode()
        server = FakeServer(b'', page)
        client = m.BoundedHTTP(m.Limits())
        with patch.object(m.requests, 'get', side_effect=server):
            self.assertEqual(m.discover_current_export_url(client=client), URL)
        self.assertEqual(client.requests, 1)

    def test_discovery_missing_ambiguous_unofficial(self):
        for page in (b'<html/>',
                     f'<a href="{URL}">one</a><a href="{URL.replace("26.1", "26.2")}">two</a>'.encode(),
                     f'<a href="{URL.replace("download.marktstammdatenregister.de", "evil.test")}">x</a>'.encode()):
            with patch.object(m.requests, 'get', return_value=Response(page)):
                with self.assertRaises(ValueError):
                    m.discover_current_export_url()

    def test_official_https_allowlist_before_network(self):
        for url in (URL.replace('https:', 'http:'), URL.replace('download.', 'evil.'),
                    URL.replace('https://', 'https://user:pass@'), URL + '?token=x', URL + '#fragment',
                    URL.replace('.de/', '.de:444/')):
            with self.subTest(url=url), patch.object(m.requests, 'get') as get:
                with self.assertRaises(ValueError):
                    m.BoundedHTTP(m.Limits()).range(url, 0, 0)
                get.assert_not_called()


if __name__ == '__main__':
    unittest.main()
