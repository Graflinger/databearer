# Electricity price vs. renewables and gas (2026 article)

Frozen evidence for `/posts/2026/strompreis-gaspreis-erneuerbare/`: monthly German
day-ahead electricity prices compared with the renewable generation share and the
European gas benchmark. All statistics use January 2019–December 2025 (84 months);
January–September 2026 is an out-of-sample comparison only.

## Sources and licenses

| Input | Source | License / terms | Grain |
| --- | --- | --- | --- |
| DE-LU day-ahead price, net public generation 2019–2025 | Tracked SMARD history partitions in `frontend/src/data-history/german-electricity/` (closed years only, raw-byte SHA-256 checked) | Bundesnetzagentur \| SMARD.de, CC BY 4.0 | daily → monthly |
| Same, January–September 2026 | 2026 partition at dashboard refresh commit `66035ab8b186fe975a55d065982a00963e3cee93` (history through 2026-10-01), read with `git show`, SHA-256 checked | as above | daily → monthly |
| Natural gas, Europe (TTF since April 2015) | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), monthly workbook, release of 2 October 2026 | [CC BY 4.0](https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections) | monthly average, USD/MMBtu |
| USD per EUR, 2019-01..2026-09 | [ECB `EXR.M.USD.EUR.SP00.A`](https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A) | [ECB terms](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html): free reuse, cite source, state modifications | monthly average |

Trading Hub Europe (THE) daily prices were **not** used: its website requires prior
written consent to reproduce data. The World Bank series is a monthly benchmark, not
a day-ahead spot price and not the German THE price; the article says so explicitly.

The 2026 partition is pinned to the same commit as the electricity YTD article
(`docs/strom_ytd.md`), so both articles report identical 2026 prices. The open year
changes with every dashboard refresh and its hashed filename disappears from the
working tree, hence the Git-object read. September 2026 was still inside the
dashboard's 35-day correction window; the article says recent weeks may be revised.

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

The exporter needs the pinned commit in the local Git history. It stages and
verifies the full set, then replaces files with the manifest last.
`strompreis_korrelation_metadata.json` (schema 2) records source hashes, the Pink
Sheet release, retrieval times, history partition hashes (including the pinned 2026
partition and commit), the 2023–2025 model coefficients and the exporter's own
SHA-256. The frontend chart config revalidates hashes, contracts and the 2026
expected values before generating charts
(`frontend/src/data_ingestion/utils/strompreisKorrelationValidation.js`).

Refresh of 4 October 2026 (before first publication): the Pink Sheet release of
2 October 2026 and ECB rates through September 2026 were ingested. All 2019–2025 gas
and exchange-rate values were unchanged, so the monthly, correlation and regression
files are byte-identical to the September export; only provenance changed. The new
file `strompreis_korrelation_2026.csv` adds January–September 2026.

## Method

- **Electricity price:** hour-weighted monthly mean of daily DE-LU day-ahead means
  (time-weighted). Monthly values match SMARD's monthly resolution to ±0.01 €/MWh.
- **Renewable share:** biomass, hydro, wind onshore/offshore, solar and other
  renewables divided by total net public generation, both as monthly energy sums (not
  means of daily shares). Pumped storage and nuclear count as generation, not as
  renewable, as in the electricity dashboard. All 2,557 days of 2019–2025 and all 273
  days of January–September 2026 are complete; no value is estimated.
- **Gas:** USD/MMBtu ÷ USD per EUR ÷ 0.29307107017 MWh/MMBtu, monthly averages
  (an approximation to converting daily quotes).
- **Statistics** run on the rounded values in the published monthly CSV. Pearson
  correlations of monthly levels; the CSV also holds Spearman rank correlations
  (robustness) and partial correlations (linear removal of the other variable), which
  the article no longer shows. Changes are month-to-month differences inside each
  period. OLS with intercept; 95 % intervals from Newey–West HAC standard errors,
  Bartlett kernel, lag 3, normal approximation, indicative only for 24–84 months.
  Periods 2019–2020, 2021–2022, 2023–2025 were fixed before computing results.
- **Robustness:** calendar-month dummies and load remove most of the full-period
  renewable coefficient (−0.24, CI −0.94…0.45). The article reports this.
- **2026 comparison:** `Erwartet_EUR_MWh` = intercept + gas coefficient × gas price +
  renewable coefficient × renewable share, using the OLS point estimates of the
  2023–2025 model refitted from the rounded monthly CSV and the rounded 2026 inputs.
  2026 enters no correlation or regression. Quarter values in the article are
  hour-weighted means of the monthly values, rounded to whole euros (consistent with
  the YTD article's quarterly prices). The largest absolute 2023–2025 in-sample
  deviation is 19.6 €/MWh; June–September 2026 deviate by 20.1–31.6 €/MWh. September
  2026 gas (75.3 €/MWh) lies above the 2023–2025 range (maximum 63.9 €/MWh in January
  2023), so that month's expectation is an extrapolation; the article says so.

The article keeps only a short "Daten und Quellen" section (one-author voice, no file
names, hashes or tooling). Correlation tables show period, months and the Pearson
value; the full regression table sits in a closed `post-data-details` disclosure
with a `table-note` source line.

## Refresh policy

This is a frozen article snapshot. Do not refresh incidentally. A later Pink Sheet
vintage can revise past months; a deliberate refresh must rerun all steps, update the
pinned commit and cut-off if 2026 moves, update the article numbers and tables
together, and set `lastUpdated` with a visible note after publication. Any edit to
`export.py` changes `exporter_sha256`, so rerun the export and the tests.

`test_strompreis_korrelation.py` runs in the `pipeline` job of `frontend-ci.yml`,
which checks out full history so the pinned 2026 commit is available. In shallow
checkouts only the Git-object reproduction test is skipped.
