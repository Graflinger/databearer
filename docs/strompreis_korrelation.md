# Electricity price vs. renewables and gas (2026 article)

Frozen evidence for `/posts/2026/strompreis-gaspreis-erneuerbare/`: monthly German
day-ahead electricity prices compared with the renewable generation share and the
European gas benchmark, January 2019–December 2025 (84 months).

## Sources and licenses

| Input | Source | License / terms | Grain |
| --- | --- | --- | --- |
| DE-LU day-ahead price, net public generation | Tracked SMARD history partitions in `frontend/src/data-history/german-electricity/` (closed years only, raw-byte SHA-256 checked) | Bundesnetzagentur \| SMARD.de, CC BY 4.0 | daily → monthly |
| Natural gas, Europe (TTF since April 2015) | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), monthly workbook | [CC BY 4.0](https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections) | monthly average, USD/MMBtu |
| USD per EUR | [ECB `EXR.M.USD.EUR.SP00.A`](https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A) | [ECB terms](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html): free reuse, cite source, state modifications | monthly average |

Trading Hub Europe (THE) daily prices were **not** used: its website requires prior
written consent to reproduce data. The World Bank series is a monthly benchmark, not
a day-ahead spot price; the article says so explicitly.

## Reproduce

From `pipeline/` (Python 3.11, `requirements.txt`):

```sh
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_gas_price_data.py        # 2 requests; raw bytes + sidecars in .data/raw/gas_prices/
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_gas_price_data.py --from-raw  # offline reload
dbt build --target prod --select +fact_gas_price_europe_monthly \
  --profiles-dir src/data_pipelines/databearer_dbt/ --project-dir src/data_pipelines/databearer_dbt/
PYTHONPATH=. python src/data_pipelines/export_data/2026/strompreis_korrelation/export.py   # → .data/output/strompreis_korrelation
PYTHONPATH=. python src/data_pipelines/export_data/2026/strompreis_korrelation/export.py \
  --output-dir ../frontend/src/data_ingestion/data/2026/strompreis-korrelation              # explicit article update
PYTHONPATH=. python -m unittest discover -s tests -p test_strompreis_korrelation.py -v
```

The exporter stages and verifies the full set, then replaces files with the manifest
last. `strompreis_korrelation_metadata.json` records source hashes, the Pink Sheet
release (2 September 2026), retrieval times, history partition hashes and the
exporter's own SHA-256. The frontend chart config revalidates hashes and contracts
before generating charts (`frontend/src/data_ingestion/utils/strompreisKorrelationValidation.js`).

## Method (summary)

- Monthly price: hour-weighted mean of daily means; renewable share: monthly energy
  sums (pumped storage and nuclear count as generation, not renewable).
- Gas: USD/MMBtu ÷ USD per EUR ÷ 0.29307107017 MWh/MMBtu.
- Statistics run on the rounded values in the published monthly CSV. Pearson and
  Spearman correlations, partial correlations, month-to-month changes; OLS with
  Newey–West (lag 3) intervals. Periods 2019–2020, 2021–2022, 2023–2025 were fixed
  before computing results.
- Robustness: calendar-month dummies and load remove most of the full-period
  renewable coefficient (−0.24, CI −0.94…0.45). The article reports this.

## Refresh policy

This is a frozen article snapshot. Do not refresh incidentally. A later Pink Sheet
vintage can revise past months; a deliberate refresh must rerun all steps, update the
article numbers and tables together, and set `lastUpdated` with a visible note. Any
edit to `export.py` changes `exporter_sha256`, so rerun the export and the tests.
The new pipeline tests are not in CI (CI runs `test_german_electricity*.py` only);
run them locally.
