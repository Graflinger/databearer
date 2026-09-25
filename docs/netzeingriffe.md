# Frozen article: Netzeingriffe

Article: `frontend/src/posts/2026/netzeingriffe-netzstabilitaet.md`.
Keep publication date **2026-09-11**, revision **2026-09-14** and existing route
`/posts/2026/netzeingriffe-netzstabilitaet/`. It ends at `/dashboards/strom/`.

## Evidence and verified claims

The complete entity is `frontend/src/data_ingestion/data/2026/netzeingriffe/`:
two byte-preserved CSVs, a derived summary JSON, and a provenance manifest.
Source: `frontend/src/_data/germanElectricityProgress.json` at
**dd0c7f8deef858a844be777a5fd1e78949386413**; raw file SHA-256
`cb434822ce5f16e9f6603875cbeff5d50a26b04415a9c9e0ad3e54cebfd801fd`.
This is the upstream *repository snapshot* hash, not the raw SMARD CSV hash.
The snapshot contains no acquisition timestamp. `upstream_retrieved_at: null`
preserves that uncertainty; September 14 is review date, not observation cutoff.

- Annual independent source aggregates: 2015–2025, 11 observations.
- Monthly source aggregates: July 2022–May 2026, 47 observations. Both end years
  are partial in this series. No interpolation or zero-filled gaps.
- Units: GWh measures energy; nominal million EUR costs; Europe/Berlin calendar
  periods. Both upward and downward interventions count, including both sides of
  an intervention. These are not lost generation or renewable-only curtailment.
- Total includes market/reserve redispatch and countertrading, including
  cross-border interventions. Monthly market redispatch is a subset, not additive.
- 2022 → 2025: 36,455 → 30,327 GWh, **−6,128 GWh / −16.809765%**.
- 2024 → 2025: 30,318 → 30,327 GWh, **+9 GWh / +0.029685%**, effectively flat.
- Costs 2024 → 2025: 2,954 → 3,058 million EUR, **+104 / +3.520650%**.
- December 2024: 4,624.45 GWh; May 2026: 1,119.86 GWh. Descriptive monthly
  examples, not a same-season comparison or an inferred 2026 annual trend.
- Redispatch 2.0 transition October 2021; former feed-in management fully included
  in market redispatch since 2022. Caveat adjacent to both annual charts. The source
  does **not** quantify how much of the increase is explained by the transition.
- Annual values are not forced to match sums of independently revised monthly
  data. The article table supplies static evidence without JavaScript.

## Official source research — accessed 2026-09-14

All page inspections and the single bounded CSV request below were on this date.
The handbook's compact-data licensing was previously verified on 2026-09-10 in
[electricity_progress.md](electricity_progress.md#licensing-and-independently-verified-capacity-metadata);
its link is retained here as that prior evidence, not a newly retrieved PDF.

| Source URL | Finding / decision |
| --- | --- |
| [SMARD annual congestion](https://www.smard.de/page/home/topic-article/211972/217842/entwicklung-des-netzengpassmanagements) | Definitions, up/down measures, reserve and countertrading scope, saldierte costs and October 2021/2022 transition verified directly. CSV/XLS export offered. |
| [SMARD compact electricity](https://www.smard.de/home/energiedaten-kompakt/strom) | Static response exposes a JavaScript-loaded catalogue; not a complete inventory of chart titles. No reliability route verified from this page. |
| [SMARD compact CSV](https://www.smard.de/resource/blob/217306/-/data-csv-data.csv) | One request, 15-second socket timeout, hard 2,000,000-byte read limit; actual **759,184 bytes, 132 groups**. Inspected group IDs in memory. No documented SAIDI, interruption-quality or frequency-measurement group mapping established. Opaque numeric groups are not proof of absence. No data from this request used to refresh the article. |
| [SMARD Netzfrequenz](https://www.smard.de/page/home/wiki-article/594/211042/netzfrequenz) | Explanatory 50 Hz / balancing-reserve page, no downloadable measured frequency time series identified. Reserve activity is not itself frequency stability. |
| [SMARD data terms](https://www.smard.de/home/datennutzung) | Exact attribution **Bundesnetzagentur \| SMARD.de**; CC BY 4.0 expressly stated for market data. For compact data use the broader handbook evidence below. |
| [SMARD September 2026 handbook](https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf) | Prior verification: printed p. 6 (PDF p. 7) covers SMARD data and mentions compact monitoring data under CC BY 4.0; printed p. 12 (PDF p. 13) describes compact CSV/XLSX exports. No claim that this licenses other BNetzA downloads. |
| [BNetzA SAIDI Strom](https://www.bundesnetzagentur.de/saidi-Strom) | Official interruption reliability source, page dated 2025-10-09, latest listed national year **2024**. National 2006–2024 PDF (92 KB) and Länder XLSX since 2008 (86 KB) provide compact potential routes. Individual-event files are 9–12 MB each and were not downloaded. |
| [BNetzA national PDF](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Versorgungssicherheit/Versorgungsunterbrechungen/Auswertung_Strom/Kennzahlentwicklung2006_2024.pdf?__blob=publicationFile&v=6) | Link verified on SAIDI page; payload not fetched or transcribed. A potentially small national annual series, but PDF reuse/adaptation terms not established for this article. |
| [BNetzA Länder XLSX](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Versorgungssicherheit/Versorgungsunterbrechungen/Auswertung_Strom/TabelleBL.xlsx?__blob=publicationFile&v=4) | Link verified; payload not fetched. Länder assignment follows operator headquarters for cross-state networks, not exact geographic exposure. No national series inferred by averaging Länder. |
| [BNetzA imprint](https://www.bundesnetzagentur.de/DE/Service/Impressum/start.html) | Legal note 4 names **“Datenlizenz Deutschland – Namensnennung – Version 4.0”** for XLS/XLSX/CSV unless otherwise marked, but supplies no license-text link there. Copyright section separately links **CC BY-ND 4.0** for website content. The literal data-license version and its applicable terms remain unverified; do not silently substitute DL-DE BY 2.0 or SMARD CC BY 4.0. |

SAIDI comparability from the official methodology page: interruptions **over three
minutes** only; SAIDI EnWG covers specified unplanned causes (atmospheric effects,
third parties, network operator responsibility, knock-on disturbances). It excludes
other causes such as force majeure and does not count all brief disturbances.
SAIDI and ASIDI have different weighting bases (customers versus connected rated
apparent power); the national total combines them. The separate ARegV quality
indicator includes some planned interruptions at 50% and has a different cause
selection. Never splice these series. SAIDI concerns **interruption duration**, not
interruption count, voltage quality or frequency deviations in Hz.

**Verdict:** official reliability evidence exists outside the verified SMARD route,
and compact downloads are possible in principle. A clearly licensed, mapped small
additional series was **not fully verified in this bounded research**. No new
reliability/stability series, numeric reliability claim or proxy was added. This
does not claim that such data do not exist. No frequency-quality dataset was
verified; no reserve/redispatch proxy is substituted. Clarify the BNetzA download
license and inspect the compact payload before a future separate reliability post.

## Reproduction, validation and changes

`netzeingriffeValidation.js` is topic-specific. The chart config calls it before
exporting configs, so a missing, mixed or corrupt evidence package fails generation.
It validates exact allowlists, regular files, directory symlinks, a bounded file
size, hashes, headers, row counts, consecutive periods, numeric values, subset
relationships, fixed source/window/license metadata and the supporting summary.
Hashes establish internal package consistency, not independent source authenticity.
The 2026-09-14 audit compared every observation with `git show dd0c7f8:…` and
confirmed both CSVs byte-identical to their original d150bb9 versions. Focused tests
pin those audited CSV hashes independently of the manifest. Builds and tests read
only frozen files and need neither Git history nor a network.

The former flat CSVs moved byte-for-byte. Fields map as follows:
`year → jahr`, `energy_gwh → massnahmenenergie_gwh` (annual) / `gesamt_gwh`
(monthly), `cost_million_eur → kosten_mio_eur` (annual),
`month → monat`, `redispatch_energy_gwh → redispatch_marktkraftwerke_gwh`.
The summary is deterministic, using `(new/old − 1) × 100`, rounded to six decimals.

For an intentional refresh, prepare the entire small package in ignored staging,
record a new source commit/hash and actual windows, and validate it before promotion.
Update fixed contract, summary, article numbers/dates and tests together. Promote
manifest last and revalidate the destination; interrupted file-by-file replacement
is not directory-atomic. Never refresh from live dashboard files during a build.

From `frontend/`, Node 20:

```sh
npm ci
npm test -- --runInBand
npm run lint
npm run build
```

Chart URLs and container IDs remain stable under
`/js/charts/netzeingriffe_stabilitaet/{massnahmenenergie,kosten,monate}.js`.
Custom single-series colors use `seriesKeys`; all line segments are straight.
The monthly labels are shortened and fully defined directly above the chart,
avoiding a global chart-layout change. Mobile layout is checked in server-rendered
ECharts tests; final browser review belongs to the integrating agent.
Ingestion files have no public download route and must not appear in `_site`.
