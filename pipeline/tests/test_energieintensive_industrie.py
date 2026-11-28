"""Offline checks for source selection, missing values and frozen publication integrity."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "src/data_pipelines/export_data/2026/energieintensive_industrie/export.py"
spec = importlib.util.spec_from_file_location("industrie_export", SCRIPT)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)

PRESS = """Pressemitteilung Nr. 355 vom 7. Oktober 2026
In den energieintensiven Industriezweigen ist die Produktion im August 2026 gegenüber Juli 2026 saison- und kalenderbereinigt um 0,5 % gesunken.
Im Dreimonatsvergleich war die Produktion in den energieintensiven Industriezweigen von Juni bis August 2026 um 2,9 % niedriger als in den drei Monaten zuvor.
Verglichen mit dem Vorjahresmonat August 2025 war die energieintensive Produktion im August 2026 kalenderbereinigt um 2,1 % niedriger.
Bezogen auf das Berichtsjahr 2021 benötigten sie zusammen 77 % des gesamten industriellen Energieverbrauchs.
Ihr Anteil an der industriellen Bruttowertschöpfung betrug 17 %."""


def production_html():
    rows = []
    recent = {"2026-03": 81.9, "2026-04": 83.3, "2026-05": 83.7,
              "2026-06": 82.0, "2026-07": 80.1, "2026-08": 79.7}
    for month in exporter.months("2018-01", "2026-08"):
        value = str(recent.get(month, 100.0)).replace(".", ",")
        rows.append(f"<tr><th>{month.replace('-', '/')}/01</th><td>100,0</td><td>{value}</td></tr>")
    return "<table><tr><th>Datum</th><th>industrie</th><th>energieintens_industrie</th></tr>" + "".join(rows) + "</table>"


def price_json():
    categories = {"freq": ["S"], "siec": ["E7000"], "nrg_cons": ["MWH2000-19999"],
                  "unit": ["KWH"], "tax": ["X_VAT"], "currency": ["EUR"],
                  "geo": ["EU27_2020", "DE"],
                  "time": [f"{y}-S{s}" for y in range(2018, 2027) for s in (1, 2) if f"{y}-S{s}" <= "2026-S1"]}
    return {"id": list(categories), "size": [len(v) for v in categories.values()], "source": "ESTAT",
            "updated": "2026-10-19T11:00:00+0200",
            "dimension": {k: {"category": {"index": {v: i for i, v in enumerate(values)}}} for k, values in categories.items()},
            "value": {str(i): .1559 if i < 17 else .1742 for i in range(34)}, "status": {"33": "p"}}


class IndustryExportTests(unittest.TestCase):
    def test_press_figures_require_the_right_period_sector_and_adjustment(self):
        self.assertEqual(exporter.press_evidence(PRESS)["energy_intensive_yoy_ca_pct"], -2.1)
        for old, new in [("August 2025", "August 2024"), ("um 2,1 %", "um 3,1 %"),
                         ("2021 benötigten", "2022 benötigten"), ("kalenderbereinigt um 2,1", "unbereinigt um 2,1")]:
            with self.assertRaises(ValueError):
                exporter.press_evidence(PRESS.replace(old, new))

    def test_source_table_parsing_and_complete_months(self):
        rows = exporter.production_rows(production_html())
        self.assertEqual(len(rows), 104)
        self.assertEqual(rows[-1], ["2026-08", 100, 79.7])
        annual, metrics = exporter.summary(rows, exporter.price_rows(price_json()))
        self.assertEqual(annual[-1][1], 8)
        self.assertAlmostEqual(metrics["energy_intensive"]["vs_february_2022_pct"], -20.3)
        self.assertAlmostEqual(metrics["prices"]["de_premium_pct"], 11.7382937781)

    def test_missing_duplicate_and_new_cutoff_fail(self):
        original = production_html()
        for changed in [original.replace("2018/02/01", "2018/01/01"),
                        original.replace("2026/08/01", "2026/09/01"),
                        original.replace("<td>79,7</td>", "<td>...</td>"),
                        original.replace("energieintens_industrie", "different_series")]:
            with self.subTest(changed=changed[-120:]), self.assertRaises(ValueError):
                exporter.production_rows(changed)

    def test_json_stat_geography_positions_and_unit_conversion(self):
        data = price_json()
        self.assertEqual(exporter.price_rows(data)[-1], ["2026-S1", 17.42, 15.59, "p", ""])
        swapped = copy.deepcopy(data)
        swapped["dimension"]["geo"]["category"]["index"] = {"DE": 0, "EU27_2020": 1}
        swapped["value"] = {str(i): data["value"][str((i + 17) % 34)] for i in range(34)}
        swapped["status"] = {"16": "p"}
        self.assertEqual(exporter.price_rows(data), exporter.price_rows(swapped))

    def test_missing_price_flags_tax_and_units_fail(self):
        for mutation in [lambda d: d["value"].pop("1"),
                         lambda d: d["value"].update({"1": float("nan")}),
                         lambda d: d["status"].update({"1": "b"}),
                         lambda d: d["dimension"]["tax"]["category"].update(index={"I_TAX": 0}),
                         lambda d: d["dimension"]["unit"]["category"].update(index={"MWH": 0})]:
            data = price_json()
            mutation(data)
            with self.assertRaises(ValueError):
                exporter.price_rows(data)

    def test_offline_export_determinism_and_last_good_on_corruption(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            raw, out = root / "raw", root / "out"
            raw.mkdir()
            contract = json.loads(exporter.CONTRACT.read_text())
            payloads = {"production": production_html().encode(), "prices": json.dumps(price_json()).encode(),
                        "press": PRESS.encode()}
            evidence = {}
            for key, payload in payloads.items():
                (raw / f"{key}.raw").write_bytes(payload)
                evidence[key] = {"url": contract["sources"][key]["url"], "retrieved_at": "2026-11-05T12:00:00+00:00",
                                 "sha256": exporter.sha(payload), "bytes": len(payload)}
            (raw / "acquisition.json").write_text(json.dumps(evidence))
            exporter.export(raw, out)
            before = {p.name: p.read_bytes() for p in out.iterdir()}
            exporter.export(raw, out)
            self.assertEqual(before, {p.name: p.read_bytes() for p in out.iterdir()})
            (raw / "prices.raw").write_text("corrupt")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                exporter.export(raw, out)
            self.assertEqual(before, {p.name: p.read_bytes() for p in out.iterdir()})


if __name__ == "__main__":
    unittest.main()
