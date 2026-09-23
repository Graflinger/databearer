# Post QA Guide (Pre-Publish)

This is a short checklist for preparing or reviewing a post. The rules and their
reasons live in the [SEO and authoring contract](../../docs/seo.md). Completing the
checklist does not authorize publication, commits, pushes or deployment, and it does
not promise rankings.

## Frontmatter

- [ ] `title` is an accurate claim with scope or timeframe and has no brand suffix.
  `metaTitle`/`metaDescription` are optional and must be accurate.
- [ ] `excerpt` is plain text in 1–2 sentences, with the key finding first and no
  draft labels. It becomes the meta description, card text, search excerpt and feed
  summary ([Content guidance](../../docs/seo.md#content-guidance)).
- [ ] `date` is explicit (`YYYY-MM-DD`). `lastUpdated` is set only for a real
  substantive revision.
- [ ] `draft: true` is present while drafting and removed for publication, together
  with any extra `eleventyExcludeFromCollections`, `excludeFromSitemap` or
  `permalink` overrides added while drafting ([Drafts](../../docs/seo.md#drafts)).
- [ ] `image` and optional `socialImage` are local `/images/...` files with the exact
  letter case. `imageAlt`/`socialImageAlt` describe the image and are left empty only
  for decorative images. `imageText` is the visible caption
  ([Images](../../docs/seo.md#images)).
- [ ] `topic` includes at least one of `energie`, `wirtschaft`,
  `politik-und-gesellschaft`.

## Body

- [ ] There is no H1 in the Markdown; use H2/H3. The key takeaway comes first, and a
  Methodik/Datenquellen section comes last.
- [ ] Each chart follows the [chart pattern](../../docs/seo.md#charts-and-evidence):
  - one deferred ECharts script;
  - a container with `role="img"`, `aria-labelledby` and `aria-describedby`;
  - a `chart-description` longer than 40 characters;
  - static values or a captioned table, units, period and a verified source link.
- [ ] Wide tables are wrapped in `.table-scroll`
  ([Styling](../../docs/seo.md#styling-and-navigation)). Datawrapper embeds use
  `loading="lazy"`, have a `title` and a visible source credit.
- [ ] Internal links use `/posts/<year>/<slug>/` with a trailing slash. Link text is
  descriptive (never "hier"). Citations are verified, and unresolved ones are
  recorded, not invented.
- [ ] Corrections update `lastUpdated` and add a visible `*Korrektur vom …*` note.

## Checks

From `frontend/`, run `npm test -- --runInBand`, `npm run lint`, `npm run build`, then
`npm run test:seo-output` ([Checks](../../docs/seo.md#checks)). Then:

- [ ] Review the post, topic pages and related cards on desktop and mobile, with and
  without JavaScript.
- [ ] Review `git status` for incidental CSS, chart or data changes.
