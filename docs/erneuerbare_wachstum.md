# Solar boomt, Wind wächst — frozen article evidence

Article: `frontend/src/posts/2026/solar-boomt-wind-waechst.md`.
Route: `/posts/2026/solar-boomt-wind-waechst/`. Published/updated date: 2026-09-14.
Entity: `frontend/src/data_ingestion/data/2026/erneuerbare_wachstum/`.
Charts: `erneuerbare_wachstum.js`, standard line builder, separate GW/TWh axes,
straight segments, short labels. Existing wind card reused as an explicit symbol image.

## Evidence and dates

Pinned origin/main revision: `4be5f678d5d318056ac2f87b720549f75032c4a1`.
No source refresh, pipeline ingestion, or network request is part of extraction/build.
The article freeze date is not an upstream acquisition or publication timestamp.
Unknown acquisition timestamps are JSON null, never fabricated from Git dates.

Inputs and their exact SHA-256, byte sizes, repository paths and roles are recorded in
`metadata.json`. This includes progress, annual supplements, history manifest and
the manifest-selected 2015–2026 content-addressed partitions. The existing trends
builder validates trade, the recent snapshot (history-overlap check) and current-year history too; these are explicitly ancillary,
not plotted article observations. No trade or partial-year statistics enter this post.

- Capacity: existing `germanElectricityProgress.json`, verified by `readProgress`.
  Fifteen year-end rows, 2011–2025. Three selected series, already GW. Official
  compact chart evaluation date **2026-06-26**, rechecked 2026-09-14; observation
  cutoff **2025-12-31**, all values provisional. Source CSV contains no release date.
- Generation: existing `readTrends().summary.energy`, validating history and annual
  supplements. Eleven closed years, 2015–2025, three series in TWh, retaining annual
  method, calendar day count and complete-day count. Existing history ends 2026-09-12;
  the partial 2026 generation year is excluded.
- `summary.csv`: three technology rows supporting all table values and growth claims.
  Stock changes are year-end differences, **not gross commissioning**. Percentages
  use source precision; derived outputs round to eight decimals. Text/table round to
  one decimal (chart growth summary to integer percentages).
- `quality.json`: counts, exclusions, annual methods and the five preserved daily gaps.

The 2016/2018 values replace the whole annual mix using official SMARD annual
aggregates before selection of solar/onshore/offshore. The 2016 other-renewables gap
and four 2018 pumped-storage gaps are not filled. `complete_days` describes all twelve
generation categories (365/366 in 2016; 361/365 in 2018), not only the three plotted
technologies. Annual aggregates do not certify complete underlying hours/days.

## Scope and licensing

Attribution: **Bundesnetzagentur | SMARD.de, CC BY 4.0**. Changes are selection,
GWh→TWh via the existing validated trends builder, stock differences and rounding.

Capacity is **Gemeldete Kraftwerksliste – Nettonennleistung**, including capacity
at and outside the electricity market. The list includes foreign plants feeding the
German grid from Denmark, Luxembourg, Austria and Switzerland. Small units, wind and
PV are aggregated; this is not a series of individually disclosed plants >=10 MW.
Small storage below 13.2 kW and predominantly non-publicly-feeding emergency generators
are excluded. The compact CSV has no country dimension, so the foreign contribution
to each selected series cannot be established or removed. Do not label this a certified
geographic German total. PV net nominal output and installed DC/module rating differ.

Generation is SMARD DE net generation fed to the public grid, not gross national
generation; household PV self-consumption, rail, industrial and closed distribution
networks are outside scope. Do not compute capacity factors using these differently
bounded datasets or turn net capacity into statutory target-achievement ratios.

Licensing evidence: [September 2026 SMARD handbook](https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf),
printed pp. 6 and 12, as previously independently verified and documented in
[`electricity_progress.md`](electricity_progress.md). Annual handling is documented in
[`electricity_annual.md`](electricity_annual.md).

## Official-source research, verified 2026-09-14

Pages were fetched and read directly (PDF downloaded outside Git and parsed). These
are editorial/context references, not newly ingested datasets. No third-party search
snippet alone supplies an article claim.

1. [SMARD compact net capacity](https://www.smard.de/page/home/topic-article/211972/212382/entwicklung-der-nettonennleistung):
   year-end reference, market/non-market coverage, provisional status and 26.06.2026
   evaluation date confirmed. Numerical source remains the existing snapshot, not
   a newly downloaded compact CSV.
2. [BNetzA Kraftwerksliste](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Versorgungssicherheit/Erzeugungskapazitaeten/Kraftwerksliste/start.html):
   foreign countries, aggregated small/wind/PV units and exclusions verified.
3. [SMARD, Stromerzeugung in Deutschland, 01.07.2017](https://www.smard.de/page/home/topic-article/444/510/stromerzeugung-in-deutschland-erneuerbare-energien-veraendern-das-system):
   explicitly attributes low PV costs to technological development and cost reductions.
   Used as dated long-run context, not proof of a 2025 module-price fall or causal
   decomposition of the recent boom. No current cost ranking inferred from it.
4. [BNetzA, Ausbau Erneuerbarer Energien 2025, 08.01.2026](https://www.bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2026/20260108_EEG.html):
   approximately half of 2025 PV additions on buildings/half on open land; balcony
   installations only 3.2% of that release's solar additions. Supports multiple scales
   and deployment settings, not a measured modularity/time causal effect. The release
   partly estimated December and reported 117 GW installed solar and 9.5 GW offshore.
   Those numbers must not replace our later net-capacity series (104.856/9.733 GW).
5. [BNetzA decision 4.08.01.01/1#38, 17.12.2024, second solar segment 2025](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Ausschreibungen/_DL/Solar2/Festlegungen/FestlegungSolarII2025.pdf?__blob=publicationFile&v=3):
   **p. 7**: finance requires sufficiently secure revenues; **p. 9**: assumes one-year
   realization from award to commissioning for large rooftop reference plants, **not
   observed all-PV construction time**; **pp. 10–11**: potential self-consumption cost
   benefits, heterogeneous and uncertain extra revenues; **p. 11**: stable conditions.
   Does not support a universal solar-versus-wind commissioning-time claim.
6. [BNetzA EEG funding](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Foerderung/start.html):
   feed-in tariff up to 100 kW, differentiation by commissioning date/size, full/partial
   feed-in, direct-marketing premium and auction routes. Article describes mechanisms,
   not current tariff amounts, future law, or a guaranteed investment return.
7. [SMARD first quarter 2025, 23.04.2025](https://www.smard.de/page/home/topic-article/444/216802):
   weaker wind phases in March, unusually strong prior-year comparison and weather
   effects documented. Used at its quarterly scope; no full-year weather attribution
   or statistical weather adjustment inferred.
8. [SMARD year 2025, 05.01.2026](https://www.smard.de/page/home/topic-article/444/218954/hoechste-pv-einspeisung-in-jedem-quartal):
   expansion plus above-average spring/summer irradiation cited for PV; public-grid
   definition and exclusion of household self-consumption explicit. Its early-vintage
   74.1 TWh/+17.3% PV differs from frozen later series 73.78383021 TWh/+16.84190202%.
   Likewise offshore +1.7% in prose versus +2.05352841% frozen. Do not mix vintages.
9. [MaStR quality-assurance notes](https://www.marktstammdatenregister.de/MaStRHilfe/subpages/infoNetzbetreiberAktionenQS.html):
   30.10.2023/15.03.2024 sections establish EEG installed solar capacity equals gross
   unit rating; 07.04.2025 section relates gross rating to module count/panel rating.
   Together with [SMARD net-capacity definition](https://www.smard.de/page/home/wiki-article/446/2362/installierte-erzeugungsleistung)
   this supports separating module rating from net output. No subtraction of the two
   published totals to infer losses, self-consumption or geographic contributions.

## Numerical claims

| Series | GW 2020 | GW 2024 | GW 2025 | Change 2025 GW | Growth 2020–25 | TWh 2024 | TWh 2025 | Energy change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Solar | 49.709 | 90.028 | 104.856 | 14.828 | 110.93966887% | 63.148433 | 73.78383021 | 16.84190202% |
| Wind land | 54.247 | 63.522 | 68.112 | 4.590 | 25.55901709% | 112.560417 | 106.76789243 | −5.14614704% |
| Wind sea | 7.874 | 9.215 | 9.733 | 0.518 | 23.60934722% | 25.66747975 | 26.19456874 | 2.05352841% |

## Offline reproduction and validation

From `frontend/`, Node 20 and `npm ci`. The extractor uses only existing local files
and `git show` to verify that each is byte-identical to the pinned revision. Current
live data changes must not silently refresh the article: use the pinned checkout to
reproduce or review a new freeze with synchronized article/dates/contracts/tests.

```sh
node src/data_ingestion/extract-erneuerbare-wachstum.js extract src/data_ingestion/data/erneuerbare-wachstum-staging
```

The staging parent must already exist; the target must not exist. Full package
validation follows export. Initial promotion only (refuses an existing frozen entity):

```sh
node src/data_ingestion/extract-erneuerbare-wachstum.js promote src/data_ingestion/data/erneuerbare-wachstum-staging
```

Promotion renames the complete validated directory on the same filesystem, rather
than replacing payloads of a published package one by one. Manifest is written last
in staging; failed extraction cannot change existing evidence. After interruption,
validate/re-extract staging before promotion. Normal build validates **only frozen
entity files** and never reads rotating dashboard data through this chart config.

Validator enforces exact directory/payload/source-path allowlists, regular files,
bounded sizes, SHA-256, headers/rows, finite numbers, calendar sequences, source dates,
units/scopes, annual supplement methods, original daily gap counts and summary
reconciliation. Hashes establish package consistency, not independent source authenticity;
the offline reproduction test reconstructs historical inputs from Git and ties provenance
hashes and outputs to those bytes, independently of later rolling dashboard updates.
Only that reproduction test skips in shallow checkouts without the pinned Git commit;
all frozen-package contract tests and build validation run without historical Git objects.

```sh
npm test -- --runInBand
npm run lint
npm run build
node src/data_ingestion/verify-erneuerbare-wachstum-page.js
```

Focused tests cover deterministic reproduction, missing/corrupt/mixed packages,
supporting-file corruption, extra/unsafe paths, symlinks, metadata scope/date changes,
rehash-resistant semantic errors, table numbers and chart isolation. Post-build QA
checks the rendered route, static table, local links/assets, chart series/units,
feed/search/sitemap/topic listing, word count and absence of ingestion payloads in output.
Browser/visual QA is handed back to the coordinating agent.

Verified locally on 2026-09-14 with Node **20.20.2**: `npm ci`, all **412 tests
passed / 1 existing skipped (17 suites)**, including **16 article-specific tests**;
lint and production build passed. Post-build verifier passed: **744 words**, a
**157-character excerpt**, one H1, static table reconciliation, two generated chart
assets and feed/search/sitemap/topic visibility. No incidental tracked build changes.
