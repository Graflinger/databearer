# Frozen annual electricity-trade article

Article: `frontend/src/posts/2026/stromimporte-exporte-deutschland.md`.
Evidence: `frontend/src/data_ingestion/data/2026/stromhandel/`.

This package preserves the reviewed 2019–2025 CSV byte-for-byte. The supporting
`stromhandel_source.json` is the unmodified compact monthly aggregate from
`frontend/src/_data/germanElectricityTrade.json` at commit
`dd0c7f8deef858a844be777a5fd1e78949386413`, not an upstream raw download. It includes
92 months through August 2026; only the 84 months in complete 2019–2025 calendar
years contribute to the seven chart rows. The eight 2026 months are excluded.

The manifest records the SHA-256 of the complete source bytes (distinct from its
embedded canonical content hash), payload hashes/sizes/columns/row counts, units,
timezone, windows, transformations, attribution, license, and quality summary.
The original acquisition time was not recorded and is explicitly null. September
14 is the packaging/editorial review date, not a new source retrieval date.

## Reproduce offline

From `frontend/` on Node 20:

```sh
node scripts/freeze-stromhandel.js
npm test -- --runInBand
npm run lint
npm run build
node scripts/check-stromhandel-build.js
```

The topic-specific packager reads only the pinned local Git blob. It verifies its
raw and canonical hashes and the existing CSV before writing. It validates a full
staged candidate, promotes the supporting source, promotes the manifest last,
and verifies again. Promotion is not a directory-level atomic transaction; after
interruption rerun this command to restore the exact package. The original CSV is
never overwritten. No live source refresh is performed.

`utils/stromhandelValidation.js` runs synchronously when `charts/stromhandel_jahre.js`
is loaded. It requires the exact three-file package, regular nonsymlink files,
manifest contracts, hashes, sizes, source JSON schema/dates/flags and all seven
annual CSV rows reconciled against the frozen monthly source. No rotating dashboard
data is read by the article config. Hashes establish consistency with the pinned
evidence, not independent authenticity of upstream data.

Source methodology and known 2020 startup handling / 2021–2022 net discrepancies:
[electricity_trade.md](electricity_trade.md). No missing monthly observation is
silently treated as zero. The source's narrowly documented pre-trading zeros and
startup daily fallback are preserved. Net is derived from gross exports minus
imports before rounding, not substituted from the official net series.

Economic context uses the primary SMARD explanation
[Grenzüberschreitender Stromhandel](https://www.smard.de/page/home/wiki-article/518/548/grenzueberschreitender-stromhandel),
reviewed 2026-09-14: market coupling selects cheaper offers across bidding zones
subject to transmission capacity; planned commercial exchanges differ from physical
flows. This is context, not evidence that these annual balances demonstrate improved
flexibility, lower prices or physical security. The post makes no such causal claim.

Additional primary sources reviewed 2026-09-14:

- [BNetzA, electricity market 2024, 2025-01-03](https://www.bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2025/20250103_smard.html),
  section “Grenzüberschreitender Stromhandel”: “Deutschland verfügt über ausreichend
  Stromerzeugungskapazitäten. Strom wird in aller Regel dann importiert, wenn die
  inländische Produktion teurer wäre.” Together with SMARD's market-coupling
  explanation this supports economic imports despite domestic capacity, including
  domestic capacity not being fully dispatched. It does not quantify idle capacity
  at each import hour or establish perpetual national self-sufficiency. The post
  explicitly attributes the sufficiency assessment to the 2024 retrospective.
- [SMARD, installed generation capacity](https://www.smard.de/page/home/wiki-article/446/2362/installierte-erzeugungsleistung):
  defines maximum/net capacity and explains maintenance, weather and demand-driven
  underutilisation. Installed capacity is not simultaneously available or firm
  capacity. Do not reuse the page's blanket security sentence as proof of autarky;
  a nameplate sum does not establish adequacy at each critical hour.
- [BNetzA, security monitoring, 2025-09-03](https://www.bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2025/20250903_Versorgungsmonitoring.html):
  conditional adequacy through 2035, with up to 22.4/35.5 GW gross additions of
  dispatchable capacity by scenario (before closures), plus flexibility, renewable
  expansion and network development. This is not a finding of unconditional autarky.

These contextual reports are not the chart inputs. Their differently scoped or
revised trade totals are not substituted into the frozen DE–LU evidence.

## Disclosure styling handoff

The charts remain primary and their sources stay visible. The seven-row fallback
table is inside a native, initially closed `details.post-data-details`; methodology
uses initially closed `details.post-methodology`. The table reuses the existing
`electricity-table-wrap` horizontal scroller with a keyboard-focusable named region.
DOM checks cover both rendered page and feed content.

Both disclosures additionally use `stromhandel-disclosure`. The dedicated
`frontend/src/scss/pages/_trade-post.scss` supplies scoped disclosure spacing,
summary/scroller focus treatment, padded numeric cells and a `30rem` table minimum
width. The existing wrapper supplies local horizontal overflow on narrow screens.
The rules inherit text color and use `currentColor` for borders and focus outlines;
they do not duplicate the global font-color correction or modify `_post.scss`.

Only the shared **font-color** fix from PR30 (intro commit `e4e9f35`) remains an
integration dependency. Do not transfer YTD disclosure styles or chart builders.
Main browser QA should verify mobile scrolling and light/dark contrast with PR30's
font-color CSS applied; that commit is not included in the trade branch.

Generated assets retain `/js/charts/stromhandel_jahre/importe_exporte.js` and
`nettoexport.js`. The line uses straight segments and an explicitly named single
series so the standard builder applies its color. The article also includes the
full seven-row static table. Ingestion evidence is excluded from public output.
To update evidence deliberately, review source pin, windows, manifest/validator,
article, dates and tests together; routine builds must never refresh it.
