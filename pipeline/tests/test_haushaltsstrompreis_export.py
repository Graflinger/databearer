"""Sparse, order-independent Eurostat decoding and signed tax arithmetic."""
import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/data_pipelines/export_data/2026/haushaltsstrompreis/export.py"
SPEC = importlib.util.spec_from_file_location("household_export", PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class HouseholdExportTests(unittest.TestCase):
    def test_sparse_indices_and_zero_are_preserved(self):
        fixture = {
            "class": "dataset", "source": "ESTAT", "id": ["geo", "tax"], "size": [2, 2],
            "dimension": {
                "geo": {"category": {"index": {"NL": 1, "DE": 0}}},
                "tax": {"category": {"index": {"I_TAX": 1, "X_TAX": 0}}},
            },
            "value": {"3": 0.244, "0": 0}, "status": {"3": "p"},
        }
        rows = MODULE.decode(fixture)
        self.assertEqual([(r["geo"], r["tax"], r["value"]) for r in rows],
                         [("DE", "X_TAX", 0), ("DE", "I_TAX", None),
                          ("NL", "X_TAX", None), ("NL", "I_TAX", 0.244)])
        self.assertEqual(rows[-1]["flag"], "p")

    def test_negative_net_tax_is_not_clamped(self):
        self.assertEqual(MODULE.tax_values({"I_TAX": 0.244, "X_TAX": 0.2681, "X_VAT": 0.2016}),
                         ["24.40", "26.81", "20.16", "-2.41", "-9.88"])

    def test_missing_required_price_fails(self):
        with self.assertRaisesRegex(ValueError, "Missing required"):
            MODULE.tax_values({"I_TAX": 0.36, "X_TAX": None, "X_VAT": 0.3})


if __name__ == "__main__":
    unittest.main()
