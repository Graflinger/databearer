# Energieintensive Industrie

Topic: `energieintensive-industrie`. Research and licence review: 2026-11-05.
Article remains `draft: true` pending owner approval; card image is an open editorial item.

## Licence gate (before data acquisition)

The following publisher pages were read directly on 2026-11-05. Permission covers
commercial reuse, including a potentially advertising-funded website, and redistribution
of the selected, derived aggregates in this public Git repository, subject to the
attribution and change notices below. No permission is inferred from free API access.

### Destatis GENESIS-Online

- **Licence:** Datenlizenz Deutschland – Namensnennung – Version 2.0 (`dl-de/by-2-0`).
- [Publisher's terms](https://www.destatis.de/DE/Service/Impressum/copyright-genesis-online.html),
  [licence text](https://www.govdata.de/dl-de/by-2-0),
  [general copyright](https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html).
- Publisher copyright: `© Statistisches Bundesamt (Destatis), 2026`.
- Publisher's recommended wording for modified data (with optional retrieval date filled in):
  `Datenquelle: Statistisches Bundesamt (Destatis), Genesis-Online, 05.11.2026; Datenlizenz by-2-0; eigene Berechnung/eigene Darstellung`.
  Link **Datenlizenz by-2-0** to the licence text and identify/link table 42153-0001.
  Include the formal licence identifier `dl-de/by-2-0` in the package.
- Sections 1–3 expressly permit commercial copying, processing, combining, transmission
  to third parties and integration into public networks; changes must be marked.
  These permissions apply to the database's provided data and metadata; no separate
  database-right restriction is specified. No claim of public-domain status is made.
- Third-party rights and product-specific exceptions are not covered. Inspect the
  downloaded table's copyright/footnotes before promotion. Logos and images are not used.

### Destatis press release and explanatory page

- **Terms:** Destatis general copyright permission (no numbered licence version),
  [publisher terms](https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html).
- Exact notice: `© Statistisches Bundesamt (Destatis), 2026. Vervielfältigung und Verbreitung, auch auszugsweise, mit Quellennachweis gestattet.`
- Cite the specific page/title, publisher and retrieval date; identify own calculations
  and presentation. Commercial Internet redistribution is explicitly allowed.
- The explanatory page includes **third-party AG Energiebilanzen data in chart 1**;
  that chart/data is excluded. Only Destatis's own production definitions and structural
  figures are considered. No VDA data, photographs, logos or illustrations are reused.
- The text and August press release say 77% energy use in 2021, while the explanatory
  page's appendix chart 3 says 76%. Preserve this discrepancy in research; do not
  silently treat the rounded text figure as independently recomputed microdata.

### Eurostat nrg_pc_205

- **Terms:** Eurostat reuse policy for statistical data, implemented by Commission
  Decision **2011/833/EU** of 12 December 2011 (no separate numbered data licence).
  [Publisher's copyright and free-reuse notice](https://ec.europa.eu/eurostat/web/main/help/copyright-notice),
  [Decision](https://eur-lex.europa.eu/eli/dec/2011/833/oj).
  **Do not label the statistical data CC BY 4.0**: the notice expressly uses that
  licence for editorial content, and separately authorises reuse of statistical data.
- Commercial/non-commercial reuse and redistribution of statistics and metadata is
  authorised with source acknowledgement; no written licence application is needed.
  Public Git CSV distribution is reuse under these terms. No additional database-right
  restriction is specified for the selected statistics; third-party rights remain excluded.
- For a customised dataset the prescribed citation template is
  `Source: [Eurostat dataset datacode link], [access date]`.
  Use `Source: Eurostat, nrg_pc_205, https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table, 05.11.2026`;
  add `© European Union, 2026` and
  `Eigene Auswahl, Umrechnung und Darstellung. Eurostat ist für diese Bearbeitung nicht verantwortlich.`
- Changes/translations must be clearly identified and a Eurostat non-responsibility
  disclaimer included. Only Germany and EU-27 aggregates are selected. The exclusions
  for third-party content, certain non-European countries and Swiss/Austrian trade data
  do not apply to this selection. Check dataset-specific metadata for contrary terms.

## Work tracking

On 2026-11-05 all six open PRs already had tracker rows. The only non-refresh change
on main not in release was documentation-only #53; no release-promotion addition needed.
No pull-request template exists in the tracked `.github/` directory at this base.

## Actual source selection and access

GENESIS authentication via the owner's existing ignored local configuration succeeded;
no credentials were copied into the worktree, logs or committed files. The existing
helper was inspected, but not changed: its pivot/sum interface is unsuitable for a
strict monthly evidence export. `metadata/table`, `metadata/cube` and `catalogue/cubes`
worked. `data/table` and `data/tablefile` returned code 7000 (no data cube), including
explicit WERT03/X13JDKSB selection and a 2025 request. The cube catalogue listed
42153BM001 through August 2026, last update `06.10.2026 18:06:08h`; this is **not**
the timestamp of a successfully downloaded production table.

The actual production source is the [publisher's public chart data table](https://www.destatis.de/DE/Themen/Branchen-Unternehmen/Industrie-Verarbeitendes-Gewerbe/_Grafik/_Interaktiv/produktionsentwicklung-energieintensiven-industriezweige.html?showChartData=1).
It supplies monthly observations from 2015 to August 2026; the frozen selection starts
in January 2018. There is no separate revision timestamp on this page. Its general
Destatis permission, documented above, applies to this acquisition; the article does
not falsely attribute the download to GENESIS or relabel it as a dl-de/by-2-0 download.
The general permission explicitly covers commercial Internet redistribution of data.
There is no third-party notice on the selected chart/table.

The [Wochenvorschau for KW45](https://www.destatis.de/DE/Presse/Wochenvorschau/_inhalt.html),
updated 30 October and checked 5 November, schedules September production for
**6 November 2026** (expected release no. 389). No September aggregate was available
in the inspected production chart/cube catalogue. This is a concrete pre-publication
refresh/review item, not an invented observation. The old Konjunkturindikatoren pages
say they have not been updated since KW43; they are not used as current observations.

Eurostat JSON-stat identifies `ESTAT` as source, a last update of
`2026-10-19T11:00:00+0200`, and 2026-S1 as its latest half-year. The linked
[information note](https://ec.europa.eu/eurostat/databrowser-backend/api/public/explanatory-notes/get/Info_note_NRG_20260917.pdf)
was read in full: it reorganises the energy navigation tree from 1 October and renames
the table to non-household consumers; it adds no licence restriction. Several legacy
`cache/metadata/...` links returned 404; the actual dataset annotations and the
publisher's [Electricity price statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Electricity_price_statistics)
provide the relevant methodology. The latter explains half-year invoiced prices,
weighted aggregates and relief outside supplier bills (including an Irish example
not included in reported prices). Its Germany section says no update for 2026; do
not infer a complete inventory of German compensation from it.

### Additional contextual-source licences

The Destatis definitions page and release calendar are covered by the same general
Destatis permission as the actual production download; cite title, URL, publisher,
retrieval date and own summary. The manifest's `context_sources` identifies each page
and explicitly excludes AG Energiebilanzen data.

Eurostat's **editorial methodology text** is CC BY **4.0 International** according to
the publisher's copyright page. The [licence's legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)
was read on 2026-11-05: commercial distribution and adaptations are permitted; retain
creator/copyright/licence/source notices, mark changes, do not imply endorsement or
add downstream restrictions. Section 4 covers licensed sui generis database rights;
third-party, trademark, privacy and personality rights are not granted. No third-party
text or illustration is reused here. Attribution:
`Source: Eurostat, Electricity price statistics, [page URL], 05.11.2026; © European Union, 2026; CC BY 4.0`.
Change notice: `Eigene Zusammenfassung der Methodik. Eurostat ist für diese Bearbeitung nicht verantwortlich.`
This is a summary of definitions, not a translation of the whole publication.
The statistical CSVs retain the **separate statistical-data reuse policy**.
EUR-Lex returned HTTP 202 with an empty body when fetching the Decision itself;
permission rests on the directly read Eurostat notice, which explicitly authorises
commercial statistical reuse and identifies that Decision as its implementation basis.

## Frozen evidence contract and calculations

- **Production:** 104 complete months, 2018-01–2026-08; two national aggregate
  series, 2021=100, X13 JDemetra+ seasonally/calendar adjusted, source precision 0.1.
  Industry means manufacturing **and mining**, excluding energy and construction.
  The energy-intensive aggregate is C17/C19/C20/C23/C24, weighted by base-year gross
  value added at factor cost. It is part of the comparison series, not a control group.
- **Prices:** 17 complete half-years, 2018-S1–2026-S1; `freq=S`, `siec=E7000`,
  `unit=KWH`, `currency=EUR`, `tax=X_VAT`, `nrg_cons=MWH2000-19999`,
  `geo=DE,EU27_2020`. Band ID is 2,000 to **below** 20,000 MWh annually.
  This substantial-consumption band provides context for larger business users with
  a complete series. It does not represent the five production sectors or the largest
  sites, and is not chosen on the size of the observed German premium.
  Multiply EUR/kWh by 100 to obtain ct/kWh. Nominal prices include non-recoverable
  taxes and network charges, exclude VAT/recoverable levies. The EU aggregate is
  Eurostat's consumption-weighted series, includes Germany, and is not recomputed.
  Preserve the `p` flag for Germany 2026-S1. No interpolation, extrapolation or zero fill.
- **Supporting exports:** arithmetic means of the displayed adjusted monthly indices
  by calendar year; 2026 explicitly labelled Jan–Aug (8 months). Rounded to three
  decimals in CSVs; no full-year extrapolation or claim that adjusted 2021 means are
  exactly 100. `quality.json` contains the calculations used in prose and a separate
  extraction of the press-release rates/structural shares, requiring the exact release,
  sector, period and adjustment in each source sentence.
- **Percentage calculations:** `(latest / reference - 1) * 100`; February 2022 is
  a clearly labelled single-month pre-shock reference, not an unaffected counterfactual.
  The 2018 comparison uses all 12 monthly values (energy-intensive 101.7, industry
  108.433333…). Latest levels 79.7 and 90.7 imply −19.1684% / −10.0198% vs February
  2022 and −21.6323% / −16.3541% vs 2018 mean. Latest price 17.42 vs 15.59 ct/kWh
  implies +11.7383%; German change vs H1 2025 is −9.8344%, vs H1 2018 +42.7869%.
- **Independent checks:** energy-intensive August/July from rounded chart levels is
  −0.4994% (release −0.5%). June–August mean / March–May mean gives −2.8526%
  (release −2.9%). Do not force every rate to match exact rounding from one-decimal
  levels: the publisher computes rates on unrounded values. The −2.1% year-on-year
  rate is **calendar adjusted only** and is attributed to the release, not derived
  from the seasonally adjusted chart. Structural 77%/17% are attributed rounded
  publisher facts, not independently recomputed raw establishment data.
- **Dates:** observations are monthly/half-year period labels, not timestamps;
  no timezone conversion. Acquisition times are UTC, stored per response. The
  publisher's Eurostat update includes its explicit +0200 offset. Hashes authenticate
  consistency within the package, not the truth of the source.

## Reproduction and update procedure

The manual exporter is isolated under
`pipeline/src/data_pipelines/export_data/2026/energieintensive_industrie/` and uses
only the Python standard library. No new dbt models, persistent database, shared
ingestion configuration, dependency or daily dashboard step is required for three
small already-aggregated source responses. It preserves raw downloads only in ignored
`.data/`; the frontend contains compact derived CSV/JSON evidence and provenance.

From `pipeline/`:

```sh
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/energieintensive_industrie/export.py --fetch
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/energieintensive_industrie/export.py
PYTHONPATH=. python3 -m unittest discover -s tests -p test_energieintensive_industrie.py -v
```

`--fetch` makes exactly three sequential GETs, each capped at 90 seconds and 5 MB.
The dated source contract intentionally rejects a different acquisition date or a new
production cutoff until the article/contract/validator are reviewed together. Offline
reruns verify source bytes and URLs against the acquisition log and write identical
payloads and manifest. Never substitute a current fetch for the old acquisition time.

From `frontend/`, on Node 20, validate staging **before** promotion:

```sh
node -e "require('./src/data_ingestion/utils/energieintensiveIndustrieValidation').validateEnergieintensiveIndustrie('../pipeline/.data/output/energieintensive_industrie')"
```

After this validation, copy only `production.csv`, `electricity_prices.csv`,
`production_annual.csv`, `quality.json`, then `manifest.json` (last) into
`frontend/src/data_ingestion/data/2026/energieintensive_industrie/` and validate again.
The exporter stages file replacements via `os.replace`; neither copying nor multiple
file replacements are directory-atomic. A mixed/interrupted package fails the frontend
validator. Restore the prior complete set on failure rather than repairing hashes.
The validator rejects unknown files, symlinked payloads, hashes/sizes/headers/row-count
drift, dates, wrong tax/band selections and inconsistent supporting aggregates.

```sh
node src/data_ingestion/generate-charts.js energieintensive_industrie.js
npm test -- --runInBand
npm run lint
npm run build
npm run test:seo-output
```

Inspect a local-only build with `draft: false` on desktop/mobile and with JavaScript
disabled, then restore `draft: true` and make a final full build to remove preview HTML.
Keep build-generated `src/css/style.css` changes out of the commit.

## Before publication

- Owner editorial approval; retain `draft: true` until then.
- Review September production after its scheduled 6 November release; update evidence,
  references, text, dates, manifest and checks together if refreshing.
- Decide on a card image. No AI card image has been generated or a placeholder path added.

## QA record (2026-11-05)

- Final checks passed on Node 20.20.2: `npm test -- --runInBand` (28 suites,
  688 tests passed; the 19 output-dependent cases are skipped in this command),
  `npm run lint`, `npm run build`, `npm run test:seo-output` (122 tests passed).
  `git diff --check` passed. The build left `src/css/style.css` unchanged.
- Six offline Python tests: monthly gaps/duplicates, tax/unit/flag changes, reordered
  JSON-stat geography, precise press-release context, deterministic re-export and
  last-good preservation on source corruption.
- Frontend tests include full generated-series/CSV equality, static table values,
  headline calculations, provisional labels and rejection of missing, corrupt,
  extra, symlinked or semantically mixed files.
- Local `draft: false` preview built successfully. Desktop (1440px) and mobile (390px)
  charts visually checked; both lines and legends render. Browser checks verified
  all 104/17 points, one H1, no page-wide horizontal overflow and no page errors.
  Tables scroll horizontally on mobile. A separate JavaScript-disabled Chromium
  context retained both tables and their text; no canvases rendered as expected.
- Screenshots are local review artifacts, not committed source data. The final
  source is restored to `draft: true`; the final production build/SEO check verifies
  removal of preview HTML and exclusion from feeds/search/sitemap/llms.txt.
