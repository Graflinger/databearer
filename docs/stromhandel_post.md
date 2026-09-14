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

Generated assets retain `/js/charts/stromhandel_jahre/importe_exporte.js` and
`nettoexport.js`. The line uses straight segments and an explicitly named single
series so the standard builder applies its color. The article also includes the
full seven-row static table. Ingestion evidence is excluded from public output.
To update evidence deliberately, review source pin, windows, manifest/validator,
article, dates and tests together; routine builds must never refresh it.
