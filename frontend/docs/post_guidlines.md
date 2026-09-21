# Post QA Guide (Pre-Publish)

Use this checklist when preparing or reviewing a post, together with the
[SEO contract and output checks](../../docs/seo.md). Completing it does not authorize
publication, commits, pushes or deployment. SEO hygiene does not promise rankings.

## Frontmatter
- `title`: Clear, accurate claim with timeframe or scope where needed.
- `date`: Explicit publication date in ISO format (`YYYY-MM-DD`).
- `draft: true`: Boolean for work in progress. The inherited computed permalink
  suppresses output; do not override it or the computed collection exclusion.
  A future date does not hide a post. Remove/set false only when ready to publish.
- `excerpt`: Concise, accurate summary of the evidence; no fixed character quota.
- `image`: Local `/images/...` path under `frontend/src/images/`. Curated blog-card
  sources normally use 1408x800; preserve the source. The build creates responsive
  variants in ignored `_site/assets/images/` and does not fetch remote sources.
- `imageAlt`: Meaningful description for informative hero content; default empty
  for decoration. Card images are decorative with empty alt.
- `imageText`: Visible caption, distinct from alternative text.
- `socialImage` / `socialImageAlt`: Optional local image override and description
  for social previews. Metadata uses a raster variant and its actual dimensions.
- `topic`: At least one of: `energie`, `wirtschaft`, `politik-und-gesellschaft`.
- `lastUpdated`: Actual date of a substantive editorial/data/chart revision. Omit
  until needed; never derive it from build time or refresh it for incidental builds.
- `metaTitle` / `metaDescription`: Optional accurate overrides, consistent with the
  visible title, excerpt and evidence. No required keyword list or length quota.

## Page Structure
- Exactly one H1 (the template handles it).
- Visible linked author is supplied automatically by the post layout from `site.author`.
- Body uses H2/H3 (no additional H1 in Markdown).
- First section includes a 1-2 sentence key takeaway.
- Use semantic sections, paragraphs, lists and tables, not visual styling alone.
- Include a short Methodik/Datenquellen section near the end.

## Charts & Data
- Every chart has visible static HTML evidence: a verified summary with key values
  or a table with caption and headers. It must be useful without JavaScript.
- State units, observation period, geography/scope and incomplete coverage. Keep
  prose/table figures consistent with the same frozen evidence used by the chart.
- Chart-only annual summaries need verified annual findings/tables as well; do not
  invent figures or assume an annual-summary helper exists.
- Each chart lists its source with a descriptive link. Verify legacy citations
  against original sources; record unresolved references instead of fabricating them.
- Chart container IDs are unique.
- Load ECharts once, then its dependent chart scripts, all with ordered `defer`.
  Do not use `async` for this dependency chain.

## Links
- Include relevant internal links to related posts/topic pages and authoritative
  external data links where they support the argument; do not add links to meet a quota.
- Use descriptive link text, rather than repeated “hier” or “mehr”. Verify destinations.

## Output checks

From `frontend/`:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Run `npm run test:seo-output` after building, then follow the generated-output
checklist in the [SEO guide](../../docs/seo.md).

- Inspect the generated post, topic pages and related links on desktop/mobile,
  including charts, captions, keyboard access and static evidence without JavaScript.
- Confirm draft HTML is absent after a full production rebuild, including a post
  previously built as public. Confirm absence from collections, sitemap, both feeds
  and search. A watch build alone does not establish stale-output removal.
- `noindex: true` is for public utility pages; it keeps the page reachable.
  `excludeFromSitemap` alone is not an indexing prohibition or access control.
- Inspect canonical URL, accurate title/description, JSON-LD, real dates, and social
  image URL/type/alt/dimensions in generated HTML.
- Preserve `/feed.json` item fields for the private `video-generator`, including
  original `image`, optional `_image_alt`, dates, tags and `content_html` semantics.
- Review changed files for incidental generated assets/data before reporting results.
