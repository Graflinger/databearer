# PV learning curve article (`pv-lernkurve`)

Article: `/posts/2026/deutschland-solarstrom-lernkurve/`
(`frontend/src/posts/2026/deutschland-solarstrom-lernkurve.md`).

Claim: from 2004 to 2010 Germany accounted for 46 % of global photovoltaic additions,
exactly when module prices started their steep decline (−97 % in real terms 2004–2025).
The article states the cost (EEG surcharge, industry moving to China) and does not
claim a quantified causal share for Germany.

## Data entity

Frozen evidence: `frontend/src/data_ingestion/data/2026/pv-lernkurve/`.

| File | Grain | Content |
| --- | --- | --- |
| `pv_lernkurve_jahre.csv` | year 2000–2025 | Year-end PV capacity world/Germany/China (GW), Germany's stock share, Germany's CO₂ share, solar share of electricity (world, Germany) |
| `pv_lernkurve_zubau.csv` | year 2001–2025 | Net additions (GW) Germany/China/rest of world, Germany's addition and stock shares |
| `pv_lernkurve_modulpreis.csv` | year 2000–2025 | Module price, constant 2025 US$/W (chart input) |
| `pv_lernkurve_lernkurve.csv` | year 1975–2025 | Module price and global cumulative on-grid PV (MW) for the learning rate |
| `pv_lernkurve_kennzahlen.csv` | key figure | Learning rates, period shares, peak shares, doublings, price declines |
| `pv_lernkurve_metadata.json` | manifest | Source URLs/SHA-256/retrieval time, methodology, payload hashes/rows/columns |

Validator: `frontend/src/data_ingestion/utils/pvLernkurveValidation.js` (called by
`charts/pv_lernkurve.js` before generation). Tests:
`frontend/tests/pv-lernkurve-post.test.js`, `pipeline/tests/test_pv_lernkurve.py`.

## Sources

All inputs are dated Our World in Data catalog tables (Parquet), listed in
`pipeline/src/config/datasource_metadata/pv_lernkurve_sources.yaml`:

- IRENA Renewable Energy Statistics 2026 (`grapher/irena/2026-07-28/...`): PV capacity.
  PV = on-grid + off-grid photovoltaics, without concentrated solar power. Empty
  off-grid values count as zero.
- OWID `photovoltaic_cost_and_capacity` (`2026-10-23`): module price (Nemet 1975–2003,
  Farmer & Lafond 2004–2009, IRENA European pvXchange benchmarks from 2010) and global
  cumulative on-grid PV.
- Global Carbon Budget 2026 (`2026-11-10`): national share of fossil CO₂.
- Ember / Energy Institute electricity mix (`2026-06-30`): solar share of electricity.

Text-only facts (EEG tariffs, tender results, EEG surcharge, insolvencies, IEA supply
chain share, JRC polysilicon shortage) are cited with links in the article and not
part of the data entity.

## Pipeline

From `pipeline/`:

```bash
PYTHONPATH=. python src/data_pipelines/get_raw_data/ingest_pv_lernkurve_data.py   # or --from-raw
dbt build --target prod --select +fact_solar_pv_world_yearly pv_lernkurve_contract \
  --profiles-dir src/data_pipelines/databearer_dbt/ --project-dir src/data_pipelines/databearer_dbt/
PYTHONPATH=. python src/data_pipelines/export_data/2026/pv_lernkurve/export.py \
  --output-dir ../frontend/src/data_ingestion/data/2026/pv-lernkurve
PYTHONPATH=. python -m unittest discover -s tests -p test_pv_lernkurve.py -v
cd ../frontend && node src/data_ingestion/generate-charts.js pv_lernkurve.js
```

Raw Parquet files and provenance sidecars stay in ignored `.data/raw/pv_lernkurve/`.
Models: `cleaned/world_data/owid_pv_kapazitaet`, `owid_pv_modulpreis`, `owid_co2_anteil`,
`owid_solar_stromanteil`; curated `world/fact_solar_pv_world_yearly`; singular test
`tests/pv_lernkurve_contract.sql`.

## Method

- Capacities and prices are rounded first (GW/MW and US$/W to 3 decimals). Additions,
  shares, price declines and learning rates are computed from the rounded CSV values,
  so every article number can be reproduced from the published files.
- Annual net additions = year-end capacity minus previous year-end (retirements netted).
- Learning rate = 1 − 2^b, where b is the OLS slope of log2(price) on log2(cumulative
  capacity). 24.3 % for 1975–2025, 29.4 % for 2000–2025. Descriptive, not causal.
- Period shares use year-end differences: 2004–2010 = (DE2010 − DE2003)/(W2010 − W2003).

## Known caveats

- From 2022 IRENA reports less German capacity than Bundesnetzagentur/AGEE-Stat
  (end of 2022: 61.2 vs. 66.5 GW; 2022 addition 1.2 vs. 7.2 GW). Values are used as
  published; Germany's recent shares are rather understated. Boom-year values match
  national statistics closely.
- Countries report capacity with different conventions (AC/DC), so cross-country sums
  are approximate.
- Module price from 2010 is a European market benchmark, before that a global estimate.

## Refresh

This is frozen article evidence. Do not refresh it as part of unrelated builds. A
deliberate update needs new pinned catalog versions in the source YAML, a re-export,
updated article numbers/tables, tests and `lastUpdated` with a visible correction note.
