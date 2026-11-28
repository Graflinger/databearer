"""Offline checks for publisher parsing, rounded estimates and failed promotion."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "src/data_pipelines/export_data/2026/waermepumpen/export.py"
SPEC = importlib.util.spec_from_file_location("waermepumpen_export", SCRIPT)
export = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(export)


class WaermepumpenExportTests(unittest.TestCase):
    def test_estimates_round_half_up_to_hundreds(self):
        self.assertEqual(export.estimate(96800, "64.6"), 62500)
        self.assertEqual(export.estimate(76100, "69.4"), 52800)
        self.assertEqual(export.estimate(58900, "73.6"), 43400)
        self.assertEqual(export.estimate(1000, "65.0"), 700)

    def test_source_extraction_handles_html_and_nonbreaking_spaces(self):
        body = export.text('<p>2023 fertiggestellten knapp 96&nbsp;800 Wohngebäude</p>'.encode())
        self.assertEqual(export.extract(r"2023 fertiggestellten knapp ([\d ]+) Wohngebäude", body), 96800)
        with self.assertRaisesRegex(ValueError, "evidence changed"):
            export.extract(r"2024 fertiggestellten knapp ([\d ]+) Wohngebäude", body)

    def test_deterministic_csv_serialization_for_identical_acquisition(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            # Acquisition metadata is an input; it is not replaced by an invented fixed time.
            sources = {"trend": {"url": "https://www.destatis.de/example", "publication_date": "2026-06-10", "retrieved_at": "2026-11-05T12:00:00Z"}}
            rows = {"neubau.csv": [[2025, 58900, export.Decimal("73.6"), 43400]]}
            export.write_package(Path(first), rows, sources)
            export.write_package(Path(second), rows, sources)
            for name in ["neubau.csv", "manifest.json"]:
                self.assertEqual((Path(first) / name).read_bytes(), (Path(second) / name).read_bytes())

    def test_failed_validation_preserves_frontend_evidence(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "frontend"
            target.mkdir()
            (target / "last-good").write_text("preserve")
            with patch.object(export, "TARGET", target), patch.object(export, "validate", side_effect=ValueError("invalid package")):
                with self.assertRaisesRegex(ValueError, "invalid package"):
                    export.promote()
            self.assertEqual((target / "last-good").read_text(), "preserve")


if __name__ == "__main__":
    unittest.main()
