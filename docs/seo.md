# SEO and authoring contract

This guide describes the SEO-hardening authoring and review contract. It supports
accurate, accessible content and discoverability; it makes no promise of rankings,
indexing, rich results or traffic. Passing local checks does not authorize commits,
pushes, publication or deployment. Hosting changes below require separate approval.

Use the [post QA guide](../frontend/docs/post_guidlines.md) for individual articles.
Implementation references are [post directory data](../frontend/src/posts/posts.11tydata.js),
[SEO helpers](../frontend/src/seo.js), [responsive images](../frontend/lib/responsive-images.js),
[base layout](../frontend/src/_includes/base.njk) and
[post layout](../frontend/src/_includes/post.njk). This document does not change the
dashboard architecture or publication runbooks.

## Publication and indexability

- Put **boolean `draft: true`** in a post's frontmatter while drafting. The inherited
  computed permalink returns `false`, suppressing its output, and computed collection
  exclusion removes it from discovery. Do not override these computed fields in
  frontmatter or directory data. A future `date` does not make a post a draft.
- Drafts must be absent from post/topic collections, related posts, sitemap, Atom
  and JSON feeds, search data and generated HTML. Hiding a card or adding `noindex`
  is not a substitute for this contract.
- Full production filesystem builds inventory existing HTML without deleting it,
  then remove stale inventoried HTML after Eleventy successfully writes templates.
  Written-result paths preserve current pages; this also removes legacy draft and
  pagination HTML already in `_site/`. Cleanup is restricted to the canonical
  project `frontend/_site` sibling of `src`. Custom test workspaces must use a
  canonical `src`/`_site` sibling pair and explicitly mark `_site` with the regular
  file `.databearer-seo-output`, containing `databearer-owned-html-output-v1` plus a
  newline. That marker dedicates the directory's HTML to generated output; do not
  place hand-maintained HTML there. Arbitrary output directories, source aliases
  through ancestor symlinks, and symlinks within the output tree are rejected.
  Non-HTML assets and validated data are retained. CLI/programmatic dry runs and
  runs without actual written results do no cleanup. Rendering failures retain
  stale HTML; this is not an atomic build or rollback of files Eleventy already
  wrote, nor a guarantee about later validation hooks. Incremental production
  builds are rejected; watch output is not evidence of draft cleanup.
- **`noindex: true`** serves a different purpose: a public, reachable utility page
  that should not appear in search. Search and 404 pages receive `noindex, follow`.
  `excludeFromSitemap: true` only removes a sitemap entry; it does not itself emit
  `noindex`. Neither flag nor `robots.txt` provides access control.
- Sitemap entries are intended public HTML routes, excluding drafts, noindex pages,
  explicit sitemap exclusions and non-HTML data/feed routes. Canonical URLs derive
  from `site.url` and each page URL, including paginated archives' own URLs.

## Titles, dates, authors and evidence

- Write an accurate `title` and concise `excerpt` reflecting the strongest supported
  finding and its scope. Optional `metaTitle`/`metaDescription` overrides must remain
  consistent with the visible article. There is no fixed character-count requirement
  or required keyword list; do not pad copy or stuff keywords.
- Use an explicit publication `date`. Set `lastUpdated` only to the real date of a
  substantive editorial, data or chart revision. Omit it when not applicable. Never
  use build time, filesystem timestamps or an incidental regeneration as freshness.
  Post modification metadata falls back to the publication date; static pages should
  not acquire invented sitemap modification dates.
- The post layout renders the H1 and visible linked author from `site.author`.
  Use H2/H3 in the body, semantic sections, paragraphs, lists and tables. Metadata
  and structured data must reflect visible content and actual page type.
- Every chart needs useful static HTML evidence: a verified summary with key values
  or a table, plus units, observation period, geography/scope and source links.
  Give tables captions and appropriate headers. Canvas labels and tooltips alone
  do not make an article readable without JavaScript.
- Chart-only annual articles also need verified annual findings or tables. Derive
  them from the same frozen evidence as their charts. Any generated summary helper
  must be inspected and checked against its inputs before documenting or using it;
  this guidance does not assume an annual-summary API exists.
- Load ECharts once before dependent chart scripts, all with ordered `defer`.
  `async` does not preserve this dependency order. Use unique container IDs and
  descriptive source/internal links. See the
  [chart example](../frontend/AGENTS.md#using-charts-in-posts).
- Verify legacy citations against original sources, including dataset identity,
  period and methodology. Record unresolved references for editorial review;
  never fabricate source URLs, retrieval dates, attribution or evidence. Do not
  silently refresh frozen article data during an SEO or presentation change.

## Images

The image service requires registration in `frontend/.eleventy.js` with
`require('./lib/responsive-images').register(eleventyConfig)`. It prepares local
image metadata and supplies the `responsiveImage` shortcode and `socialImage` filter.
Check this wiring and the layout's metadata integration during acceptance; the
presence of the helper alone does not establish a working full build.

| Field | Authoring contract |
| --- | --- |
| `image` | Local `/images/...` source under `frontend/src/images/`; used for hero/cards. |
| `imageAlt` | Hero alternative text; defaults to empty for decoration. Describe informative content. |
| `imageText` | Visible caption; distinct from hero alternative text. |
| `socialImage` | Optional separate local `/images/...` social preview source. |
| `socialImageAlt` | Optional description of the social preview image. |

- Curated blog-card sources normally use 1408x800. Preserve these source files and
  original URLs; generated variants are not replacements for tracked originals.
- The build generates WebP and JPEG/PNG fallbacks at target widths 360, 720, 1200 and
  1408, capped at the source width without enlargement. Transparent/SVG sources use
  PNG fallbacks. Picture markup includes measured dimensions, `srcset` and `sizes`.
- Hero images load eagerly with high priority. Card images are decorative with
  empty alt; the first listing card loads eagerly, later and related cards lazily.
  The surrounding title supplies the link's meaning.
- Social metadata selects a raster variant with real MIME type, width and height,
   using the optional social source, the article/dashboard image or a locally generated brand
  fallback. Do not claim every preview is 1200x630: article images retain their
  aspect ratio. The separate default brand preview uses a 1200x630 canvas.
- Generated assets live in ignored `frontend/_site/assets/images/`, served as
  `/assets/images/...`. Never commit them or hand-author their hashed URLs.
- Sources must be local PNG, JPEG, WebP or self-contained SVG files. The helper
  rejects unsafe paths and bounds source size, pixels, count and concurrency.
  There is no source-image network fetch during builds. External image generation
  is a separate authoring action, not part of the frontend build.

## Feed compatibility

The private `video-generator` consumes `/feed.json`. Preserve existing item fields
and their semantics: `id`, `url`, `title`, `summary`, `date_published`,
`date_modified`, optional `image`, `tags` and `content_html`, plus optional
`_image_alt`. Preserve the original image URL contract while adding responsive or
social variants. The legacy `_image_alt` mapping must not be silently repurposed as
the hero's alternative text. Renaming/removing fields is a downstream breaking change.

Both feeds must exclude drafts and retain meaningful article HTML. Verify absolute
content links and image URLs, including relative query strings and fragments.
Feed update timestamps reflect explicit content dates, not build time.

## Local acceptance checks

From `frontend/`, using the project's Node runtime:

```bash
npm test -- --runInBand
npm run lint
npm run build
npm run test:seo-output
```

`npm run test:seo-output` enables `SEO_OUTPUT_CHECK=1` and runs
`frontend/tests/seo-output.test.js` through the existing Jest/jsdom setup. It reads
the real `_site/` from the preceding full production build, without building,
writing fixtures or changing output. Missing output fails; rebuild after source
changes rather than treating an older build as acceptance evidence. The normal
`npm test` suite skips this opt-in gate and remains build-independent.

The gate checks every HTML page's canonical URL, unique title, single H1 (including
404), description, social metadata and parsed JSON-LD; local image/srcset files
and measured intrinsic/social dimensions; draft exclusion; search/dashboard
discovery and utility noindex; parsed sitemap/feed contracts and explicit source
dates, including Atom's maximum modification date. Original JSON Feed image and
caption fields are checked against post frontmatter. It uses installed Eleventy
frontmatter parsing and Sharp without fetching remote resources. The focused
`tests/seo.test.js` fixtures still cover synthetic edge cases such as query/fragment
preservation and published-to-draft cleanup. The manual review below remains useful
for editorial accuracy, accessibility and interaction checks.

Generated-output review checklist:

- [ ] Draft routes have no HTML and no references in archive/topic/related pages,
  sitemap, JSON Feed, Atom or search data. The published-to-draft fixture confirms
  stale HTML cleanup; verify the full build also completes.
- [ ] Pages have correct canonical URLs, distinct pagination titles/URLs, accurate
  descriptions and consistent Open Graph/Twitter metadata.
- [ ] JSON-LD parses safely, identifies the actual page type and contains factual
  author, breadcrumb, publication and modification information.
- [ ] Sitemap and Atom parse as XML; JSON Feed/search parse as JSON. Sitemap includes
  intended HTML only, and neither sitemap nor feeds invent modification dates.
  Robots' sitemap URL follows the canonical site origin.
- [ ] Utility pages remain reachable with `noindex, follow`; draft suppression is
  tested separately. Sitemap exclusion is not mistaken for an indexing prohibition.
- [ ] Responsive assets exist; intrinsic/social dimensions match actual files.
  Social previews are raster, local sources remain intact, hero alt/captions are
  appropriate, and card images remain decorative.
- [ ] JSON Feed retains downstream fields and original image URLs; content links
  and images resolve absolutely without losing query strings or fragments.
- [ ] Desktop/mobile pages have working charts, readable tables, descriptive links,
  visible author, keyboard-accessible navigation and no relevant console errors.
  Static evidence is understandable with JavaScript disabled.
- [ ] Review Git status/diff for incidental generated CSS, charts, assets or data.
  Record failed/skipped checks accurately; a build is not a deployment verification.

## Hosting and editorial follow-ups

These are manual follow-ups, not changes authorized by implementing this guide:

1. **Apex redirect:** verify the live `databearer.de` redirect and destination. If
   its current 307 is intended to be permanent, consider a permanent 301/308 while
   preserving paths and query strings. Do not replace a deliberately temporary
   redirect solely for SEO.
2. **Preview domains:** review indexing and access policy for Cloudflare preview
   and alternate hostnames. Use appropriate preview noindex headers for public
   previews; use access control when content must be private. Canonical tags and
   robots exclusions do not protect confidential previews. Verify production
   remains reachable and indexable after any host-specific policy change.
3. **Crawler access:** inspect Cloudflare bot/WAF rules and actual request outcomes
   to ensure legitimate search crawlers are not blocked or challenged. Verify real
   crawler identity/request evidence rather than trusting a spoofable user-agent.
   Apply targeted corrections; do not indiscriminately disable security controls.
4. **Real field Core Web Vitals:** manually review Search Console/CrUX or available
   real-user data for mobile/desktop LCP, INP and CLS over the relevant collection
   window. Local build success or a Lighthouse lab score is not field validation;
   record when traffic is insufficient for a field assessment.
5. **Editorial citations:** review remaining legacy claims, references and chart-only
   annual pages. Add verified sources and static evidence without inventing history
   or provenance. Report unresolved items explicitly.

### Known legacy evidence limitations

- Old Datawrapper embeds retain their original URLs. Their host-page source credits
  are now visible and frames lazy-loaded, but not every historical chart has a
  verified numerical HTML equivalent. In particular, verify the annual values and
  partial-year scope in `Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md` against the
  original published evidence before adding a table. A redirect to a newer chart
  version is not proof of what the historical version showed.
- `Industriepolitik.md` tables reproduce checked-in chart values and displayed
  legend units. The original PV/battery CSVs are unavailable here, and their internal
  series keys conflict with the displayed units. Confirm the units from the original
  evidence before making any scientific correction; the SEO changes do not resolve
  that discrepancy or authorize replacing frozen data.
- The historical incident claims in `Die-Dunkelflaute-der-Kernkraft:-Hitzewellen.md`
  still need individual primary-source citations beyond the chart attribution.

After any separately authorized deployment, verify public HTML, headers, redirects,
feeds, sitemap, robots and image URLs on the intended host. Local implementation and
Git push success alone do not establish that the live site serves the reviewed output.
