# Haushaltsstrompreis

Topic: `haushaltsstrompreis`; branch: `feature/haushaltsstrompreis`;
draft PR: [#57](https://github.com/Graflinger/databearer/pull/57) against `main`.
Editorial decision, 2026-11-05: the user approved completing the Eurostat-only
article after the wholesale-price licence gate failed. No new SMARD numbers,
derived wholesale data or quantitative pass-through analysis are included.
The existing gas-price article and dashboard are contextual internal links.

## Licence gate — checked directly with publishers on 2026-11-05

This is a public-repository and potentially commercial-use check, irrespective
of the site's currently disabled AdSense switch. Raw downloads remain ignored.

| Source / scope | Licence and version | Decision and conditions |
| --- | --- | --- |
| Eurostat `nrg_pc_204`, `nrg_pc_204_c`: DE, EU27_2020 and EU member states only | Eurostat statistical-data reuse authorisation under Commission Decision **2011/833/EU**, 12 December 2011; no separate numbered Eurostat data licence. EU-owned editorial content: **CC BY 4.0 International**. | **With conditions; usable.** Commercial and non-commercial reuse expressly allowed, including modified data in public Git. Cite source/datacode and access date; identify transformations and disclaim Eurostat responsibility. No dataset-specific third-party ownership notice found in API source/annotations/description. |
| Bundesnetzagentur / SMARD Day-Ahead prices, including existing history copies | General market-data notice: **CC BY 4.0 International**, but an explicit current wholesale-price exception says licensing is under review in HEDWIG and these prices should not be reused for now. | **Not used.** The specific uncertainty overrides reliance on the general notice for this new publication. No conclusion about retroactive rights of previously published articles is made. |
| Fraunhofer ISE / Energy-Charts `/price`, DE–LU | General API **CC BY 4.0**; endpoint says DE–LU comes unchanged from **Bundesnetzagentur \| SMARD.de**. Other zones can be private/internal-use only. | **Not used.** Not an independent rights-cleared alternative to SMARD. No price payload downloaded. |
| Statistisches Bundesamt (Destatis), method and press-release text | **Copyright allgemein**, unversioned website authorisation, checked 2026-11-05 | **With conditions; context only.** Text/data/graphics may be reproduced and adapted commercially and online with attribution and modification notice. No GENESIS payload, third-party image or numerical series imported. |
| BDEW / other association price analyses | Not checked / no licence assigned | **Not used.** |

Publisher terms and exact credit requirements:

- [Eurostat copyright and free reuse](https://ec.europa.eu/eurostat/web/main/help/copyright-notice):
  for customised datasets, `Source: [Eurostat dataset datacode link], [access date]`.
  Implemented as `Quelle: Eurostat, nrg_pc_204 [or nrg_pc_204_c], Abruf 05.11.2026` with
  datacode link; `© Europäische Union, 2026. Eigene Auswahl, Umrechnung und Darstellung.
  Eurostat ist für diese Bearbeitung nicht verantwortlich.` Source names and notices
  accompany the CSVs in the manifest and appear in article source lines.
- [Commission legal notice](https://commission.europa.eu/legal-notice_en) links
  [Decision 2011/833/EU](https://eur-lex.europa.eu/eli/dec/2011/833/oj) and
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en).
  The Eurostat-specific data authorisation is recorded distinctly from the
  editorial CC licence. The Decision is identified from the publisher's notice;
  direct EUR-Lex requests returned no readable body in this check.
- Database rights: permission explicitly covers reuse of statistical datasets,
  not merely viewing pages. CC BY 4.0 sections 1/4 additionally cover licensed sui
  generis database rights where CC applies. No proprietary rights in third-party
  material are assumed; no blanket relicensing of upstream data under repository
  code licensing. Eurostat's exceptions for third-party works, non-EU/EFTA/candidate
  countries and specified trade tables are excluded by the selected EU electricity
  scope. No logos, photos, maps or co-published works are copied.
- [SMARD terms](https://www.smard.de/home/datennutzung): exact general credit
  `Bundesnetzagentur | SMARD.de`; adaptations must be indicated and CC linked.
  Key exception: “Wir überprüfen rechtliche Fragen zur Lizenzierung der
  Großhandelspreise derzeit umfassend im Rahmen des aktuellen Festlegungsverfahrens
  HEDWIG. Diese sollten daher bis auf weiteres nicht weiterverwendet werden.”
  General CC permits commercial sharing/adaptation and database reuse only for
  rights licensable by the publisher; it does not resolve this specific issue.
- [Energy-Charts API publisher documentation](https://api.energy-charts.info/openapi.json),
  `info.description` and `paths./price.get.description`: credit
  `Energy-Charts.info` and upstream `Bundesnetzagentur | SMARD.de`; DE–LU rights
  are attributed to SMARD. This check does not rely on secondary summaries.
- [Destatis Copyright allgemein](https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html):
  `© Statistisches Bundesamt (Destatis), 2026. Vervielfältigung und Verbreitung,
  auch auszugsweise, mit Quellennachweis gestattet.` Cite precise page, publisher
  and retrieval date; mark paraphrase as own summary. No separately numbered
  licence or standalone database-right clause is asserted; no Destatis database
  extraction is made. Explicit third-party rights remain excluded.

## Data and interpretation contract

- `nrg_pc_204`: `freq=S`, `siec=E7000`, `unit=KWH`, `currency=EUR`,
  `nrg_cons=KWH2500-4999` (DC, 2,500 to **under** 5,000 kWh/year),
  `tax=I_TAX` (all taxes/levies), `X_TAX` (none), `X_VAT` (excluding VAT and
  other recoverable taxes/levies). Germany: 2008-S1–2026-S1; EU comparison:
  2026-S1, current EU27 plus the official EU27_2020 aggregate.
- `nrg_pc_204_c`: `freq=A`, same band/currency, `geo=DE`; components
  `NRG_SUP` energy and supply, `NETC` network, `TAX_FEE_LEV_CHRG` total taxes,
  fees, levies and charges **including VAT**. VAT and sub-taxes are not added
  again. Exported component years: 2020–2025. 2017/2018 lack the total tax
  component; 2019 is omitted because collection began in S2 and the component
  total matches S2 alone. No missing year is reconstructed.
- All chart prices are nominal ct/kWh, converted by multiplying EUR/kWh by 100.
  No PPS or inflation adjustment. Tax share = (I_TAX − X_TAX) / I_TAX × 100;
  taxes other than VAT = X_VAT − X_TAX. Negative net levies are permitted.
- Half-years are consumption-weighted national end-user prices, including fixed
  charges and new/existing contracts, not a quote or all-household average.
  The annual component total is the sum of annual components, **not** an invented
  consumption-weighted mean of the two half-year prices. Small differences from
  their simple arithmetic average are expected.
- Germany's statistical collection changed with 2019-S2 (Destatis took over).
  Do not attribute every movement in the long series to market forces.
- Relief measures and price brakes affect the paid-price series. Do not interpret
  the tax residual as a fixed list of statutory rates or taxes as gross fiscal
  receipts; subsidies/allowances can reduce it. Missing values are not zeros.
- No measurement of supplier procurement vintages, margins or a causal lag;
  energy and supply is broader than spot-market procurement.
- Malta and Poland have `p` (provisional) on all three tax levels in H1 2026.
  Flags are retained in the manifest and disclosed next to the EU chart. The
  Netherlands has negative net taxes; these are preserved. The tax-subcomponent
  check is skipped in 2022/2023 because nuclear-tax cells are missing, not assumed
  zero. All three published top-level components remain available in these years.

## Primary-source context

- [Eurostat Electricity price statistics, October 2026](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Electricity_price_statistics):
  band, six-month means, consumption-weighted EU aggregate, PPS distinction and
  national allowance notes. Germany's note has no 2026 update and reports rising
  levies in 2025; this is not evidence that no measures existed in 2026.
- [Destatis method overview](https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Erdgas-Strom-DurchschnittsPreise/_inhalt.html):
  2019-S2 collection change, volume weighting, fixed charges, bonuses and all tariffs.
- [Destatis release 375/2024](https://www.destatis.de/DE/Presse/Pressemitteilungen/2024/09/PD24_375_61243.html):
  qualitative confirmation of falling wholesale/energy-and-supply costs and rising
  network charges; expiry of price brakes at end-2023. Its all-household headline
  figures are not substituted for band DC.
- [Destatis release 388/2023](https://www.destatis.de/DE/Presse/Pressemitteilungen/2023/09/PD23_388_61243.html):
  explicitly confirms inclusion of the 2023 price brakes and explains delayed
  pass-through through longer household contracts and longer-term procurement.

## Reproduction and verification

The exporter uses Python's standard library because its inputs are already
published national aggregates: no DuckDB, dbt model, live dashboard refresh or
hourly data download is needed. Three bounded data requests (2 MB/60 s each)
produce sorted, two-decimal CSVs. The manifest preserves exact request URLs,
response byte hashes and acquisition timestamps, source update date, all source
licence decisions, observation flags and payload hashes/sizes/rows/headers.
Exploratory API inspection preceded the frozen fetch; only the three frozen
requests are used as numerical provenance. Raw responses remain under ignored
`pipeline/.data/raw/haushaltsstrompreis/`.

From `pipeline/`:

```sh
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/haushaltsstrompreis/export.py
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/haushaltsstrompreis/export.py --offline
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_haushaltsstrompreis_export.py' -v
```

Before a deliberate refresh, recheck licences and update the pinned period,
source flags, article and tests together. `--offline` verifies cached response
hashes and preserves retrieval dates. The default output is ignored staging at
`pipeline/.data/output/haushaltsstrompreis/`; validate it using
`validateHaushaltsstrompreis(stage)` from the frontend utility before copying the
four CSVs and **manifest last** into
`frontend/src/data_ingestion/data/2026/haushaltsstrompreis/`. Validate again after
copying. This is a manifest-last publication, not a directory-atomic transaction;
an interrupted/mixed package fails the build. No automatic network access occurs
during frontend builds.

`verlauf.csv`: 37 half-years; `komponenten.csv`: six years; `eu.csv`: 27 EU members
plus official EU average; `eu-auswahl.csv`: six display categories backed by the
complete ranking. Hashes establish package consistency, not independent source
authenticity. The build validates all four files, including supporting exports,
and rejects missing/extra files, symlinks, changed bytes, incompatible dates,
licence changes, lost flags, component-sum errors and inconsistent DE/EU values.
Tests compare article tables to the CSVs and check headline arithmetic.

From `frontend/`, Node 20:

```sh
node src/data_ingestion/generate-charts.js haushaltsstrompreis.js
npm test -- --runInBand
npm run lint
npm run build
npm run test:seo-output
```

## Status

Article remains `draft: true`. Card image and editorial publication approval are
open. No image generation, release promotion or deployment is part of this task.

QA on 2026-11-05: Node 20.20.2; 689 frontend tests passed (28 suites; 19 tests
skipped by existing suite configuration), lint and production build passed,
122 generated-output SEO checks passed with the draft excluded. The temporarily
enabled local preview also passed generated-output checks. Desktop (1440 px)
and mobile (390 px), light/dark rendering inspected; a separate Chromium run
verified all three live chart series, three static tables, no page errors and
no document overflow. With JavaScript disabled, all three evidence tables remain
available and wide tables scroll within their own regions. The mobile EU chart
uses explained country codes so no country label is omitted. Three focused
Python tests passed (sparse indices, missing values, negative net taxes).

Primary findings checked from the frozen payloads: H1 2026 DE 36.18 ct/kWh,
EU 28.32 ct/kWh, DE rank 2/27 and +27.8% versus EU; DE tax share 34.0%, EU 28.4%.
2023→2025 energy/supply −5.11 ct/kWh, networks/taxes +2.88 ct/kWh, total −2.23
ct/kWh. Against H1 2021, DE H1 2026 remains 13.3% more expensive in nominal terms.
