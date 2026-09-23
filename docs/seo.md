# SEO and authoring contract

This is the single detailed reference for how the frontend handles drafts, indexing,
metadata, images, search, feeds and post markup, and for the checks that verify
them. Other guides only summarise it and link here. Following it supports accurate,
accessible and discoverable pages. It does not promise rankings, indexing, rich
results or traffic. Passing the checks does not authorize commits, pushes,
publication or deployment. Dashboard architecture and publication are covered by
their own runbooks, not by this guide.

Implementation: [`.eleventy.js`](../frontend/.eleventy.js), [`src/seo.js`](../frontend/src/seo.js),
[`base.njk`](../frontend/src/_includes/base.njk), [`post.njk`](../frontend/src/_includes/post.njk),
[`site.js`](../frontend/src/_data/site.js), [`lib/responsive-images.js`](../frontend/lib/responsive-images.js),
[`search.11ty.js`](../frontend/src/search.11ty.js), [`sitemap.njk`](../frontend/src/sitemap.njk) and
[`_headers`](../frontend/src/_headers). For a per-article checklist, see the
[post QA guide](../frontend/docs/post_guidlines.md).

## Drafts

- Add boolean `draft: true` to **any** template (post, page or dashboard), either in
  frontmatter or in directory data. The `drafts` preprocessor in `.eleventy.js` skips
  it before rendering, in every run mode, including `npm start`. A draft produces no
  HTML and does not appear in collections, related posts, topic pages, the sitemap,
  either feed or `/search.json`. A future `date` does not make a page a draft.
- To preview a draft locally, set `draft: false` temporarily and do not commit the
  change. Do not rely on `noindex`, hidden cards or `permalink: false` to hide a draft.
- Before publishing, remove any extra exclusions that were added while drafting.
  For example, `eleventyExcludeFromCollections: true` or `excludeFromSitemap: true`
  would keep the post out of collections, feeds or the sitemap after `draft` is removed.
- **Stale HTML cleanup:** production builds (`npm run build`, run mode `build`,
  filesystem output) record the existing `.html` files before rendering. Only after
  Eleventy finishes writing do they delete recorded files that the build did not
  write. This is how a post that is changed back to draft loses its old HTML.
  Consequences:
  - Cleanup runs only in the approved output directory: the project's
    `frontend/_site`, which sits next to `src`. A test workspace needs a canonical
    `src`/`_site` pair plus a regular file `_site/.databearer-seo-output` containing
    `databearer-owned-html-output-v1` and a newline. Symlinks and other directories
    are rejected.
  - Dry runs, runs that write nothing, render failures, `serve`/watch runs and
    in-memory output do not clean up. `--incremental` production builds are rejected.
  - Non-HTML assets and data are kept. The build is not atomic.

## Indexing and sitemap

- **`noindex: true`** in frontmatter is for a public utility page that should stay
  reachable but not indexed. It currently applies to `/suche/` and `/404.html`. The
  page gets `<meta name="robots" content="noindex, follow">`, has **no** canonical
  link and no BreadcrumbList, and is left out of the sitemap and search index.
  Indexable pages get `index, follow` and a canonical built from `site.url` and the
  page URL. Paginated archives each use their own URL.
- **`excludeFromSitemap: true`** only removes the sitemap entry. It does not add
  `noindex`. Neither flag, nor `robots.txt`, controls access.
- **Sitemap** (`sitemap.njk`, filter `indexablePages`): it lists public HTML routes
  (URLs ending in `/` or `.html`) from `collections.all`. It excludes drafts, `noindex`
  pages, `excludeFromSitemap` pages, pages with `eleventyExcludeFromCollections`, and
  feed/JSON/robots routes. `/about/`, the dashboards and paginated archives
  (e.g. `/1/`) are included. For templates with an explicit `date`, meaning posts,
  `lastmod` is the date only (UTC `YYYY-MM-DD`) of `lastUpdated || date`. Static and
  dashboard pages have no `lastmod`. Build time and file timestamps are never used.
- `robots.txt` comes from `robots.njk`. It allows everything and points to
  `${site.url}/sitemap.xml`.
- `_headers` (Cloudflare): `X-Robots-Tag: noindex` for `/search.json`, and
  `noindex, follow` for `/suche/` and `/404`. Pretty URLs redirect `/404.html` to
  `/404`. For 404 responses on arbitrary paths, the page's robots meta applies.
  `/assets/images/*` is cached for a year as `immutable` because the filenames contain
  hashes.

## Metadata and structured data

- **Title:** `metaTitle || title` (fallback `site.title`), plus ` – Seite N` on later
  archive pages. Posts get **no** brand suffix. Topic pages include
  "– Databearer" in their own `title`. Every page title must be unique.
- **Description:** `metaDescription || excerpt || description || site.description`.
  The same values feed Open Graph and Twitter tags. `og:type` is `article` for posts
  and `website` otherwise. Posts also get `article:published_time`, plus
  `article:modified_time` when `lastUpdated` is set.
- **JSON-LD** (from `seoMetadata`, one entity per `<script>`):
  - Posts: `BlogPosting` with headline, image, `Person` author (`site.author`,
    `/about/`), publisher Organization, and `datePublished`/`dateModified`
    (`lastUpdated || date`).
  - Other pages: `CollectionPage` for topics, archives and `/dashboards/`,
    `AboutPage` for `/about/`, and `WebPage` for everything else.
  - Homepage only: a `WebSite` entity (`name: 'Databearer'` from `site.name`,
    `alternateName: [site.title]`) and an `Organization` entity (measured logo
    `logo_transparent.png` 1070×388, `sameAs: site.social`, founder, description).
  - Every indexable page except `/`: `BreadcrumbList` Home → first topic (posts) →
    page. Topic labels come from `topicNames` in `seo.js`.
- **Ads:** AdSense is disabled for the whole site by `adsense.enabled: false` in
  `src/_data/site.js`. There is no per-page switch. When disabled, no AdSense script
  or `adsbygoogle` reference appears in any page. Turning ads back on needs an owner
  decision, a consent tool on every page, and updated Impressum, Datenschutzerklärung
  and Supportme notes. Those pages currently say ads are disabled.

## Content guidance

- **`excerpt`** is used as the meta description, card text, search excerpt and feed
  summary. Write it as plain text in 1–2 sentences, with the key finding first. Do not
  use Markdown or HTML. Leave out draft labels such as "Rechercheentwurf". Do not pad
  the copy or aim for a fixed length or keyword list.
- **`title`**: an accurate claim, with scope or timeframe where needed. `metaTitle`
  and `metaDescription` are optional and must match the visible content.
- **Dates:** use an explicit publication `date`. Set `lastUpdated` only for a real
  substantive editorial, data or chart revision.
- **Corrections:** set `lastUpdated` and add a visible italic note, e.g.
  `*Korrektur vom 23. September 2026: …*`, that says what changed and whether the data
  changed.
- **Structure:** the post layout renders the single H1, the excerpt and the linked
  byline (`site.author` → `/about/`). The body uses H2/H3, starts with the key
  takeaway, and ends with a Methodik/Datenquellen section.
- **Internal links:** use root-relative `/posts/<year>/<slug>/` with a trailing
  slash. `<slug>` is the Markdown filename without `.md`, with case preserved.
  Topic links use the form `/themen/<topic>/`. Link text must describe the target;
  do not use "hier".
- **Citations:** verify sources against the originals, covering dataset, period and
  method. Record anything unresolved instead of making up URLs, dates or provenance.
  Do not silently refresh frozen article data.

## Charts and evidence

Every chart needs static HTML evidence that works without JavaScript. That means a
verified description with key values, and a table for detailed comparisons, together
with units, period, scope and a descriptive source link. This pattern passes
[`tests/article-chart-evidence.test.js`](../frontend/tests/article-chart-evidence.test.js):

```html
<script defer src="/js/lib/echarts.min.js"></script>

<div class="chart-section">
  <h3 id="my-chart-heading">Measure, geography and observation period</h3>
  <p class="chart-description" id="my-chart-description">Verified key finding with values, units and period.</p>
  <div id="my-chart" role="img" aria-labelledby="my-chart-heading" aria-describedby="my-chart-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/my-config/my-chart.js"></script>
  <div class="table-scroll" tabindex="0" role="region" aria-labelledby="my-chart-heading">
    <table id="my-chart-table">
      <caption>Ausgewählte Werte, Einheit, Datenstand</caption>
      <thead><tr><th scope="col">Jahr</th><th scope="col">Wert (Einheit)</th></tr></thead>
      <tbody><tr><th scope="row">2024</th><td>1.234</td></tr></tbody>
    </table>
  </div>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://example.com/dataset">Publisher – dataset title</a></div>
</div>
```

The test checks every post that loads a `/js/charts/` script:

- `/js/lib/echarts.min.js` is included exactly once, before any chart script. All
  of these scripts use `defer`, never `async`.
- The container's `id` matches the `containerId` in the generated script. The
  container has `role="img"`.
- `aria-labelledby` points to a non-empty H2–H4. Without it, the container needs
  `aria-label`.
- `aria-describedby` points to an element with class `chart-description` whose text
  is longer than 40 characters.
- No `id` appears twice in the post.

For the named frozen-data posts, the test also expects one table per chart with
`id="<containerId>-table"`. Each table needs a caption containing "Auswahl" or
"Ausgewählte", `th scope="col"` headers, and 2–6 body rows with
`th scope="row"`. Values must match the checked-in chart data, in German number
format, with `—` for gaps. Use the same convention for new tables.

- In Markdown, write HTML blocks without indenting them by 4 or more spaces after a
  blank line, or they turn into code blocks.
- Annual articles that consist only of charts still need verified annual findings or
  tables.
- The generated builders keep the authored name and description. They only add
  ECharts ARIA labels when the container has none.
- **Datawrapper embeds** (legacy) need `loading="lazy"`, a descriptive `title`,
  their original URL, and a visible source credit link in the host article text.
  Do not add tables without verified numerical evidence.

## Styling and navigation

- Links are underlined only in running article text (`p`, `li`, table cells,
  captions and similar inside `.post-content`), in the byline, in `.chart-sources`
  and in the search fallback. Cards, topic pills, navigation and dashboard cards are
  not underlined. Do not add inline link styling.
- Tables inside `.post-content` are styled automatically: numeric cells align right,
  and row headers and captions align left. Wrap a table that may be wider than the
  column in
  `<div class="table-scroll" tabindex="0" role="region" aria-labelledby="…">`
  (or `aria-label`). The table inside needs a `<caption>`. Never use inline `overflow`
  styles.
- Mobile navigation: an inline script in `<head>` adds `html.js` before the first
  paint. `menu.js` adds `nav-enhanced`, and if it fails, `js` is removed on load so
  the no-JS menu comes back. Keep that script right after the viewport meta and
  before the stylesheet. Tests check this position.

## Images

- `image` (hero and cards), `socialImage` (optional preview override) and
  `dashboardImage` must be local `/images/...` PNG, JPEG, WebP or self-contained SVG
  files under `frontend/src/images/`. Remote URLs, `..`, query strings and fragments
  are rejected. The build never fetches images over the network. Curated blog-card
  sources are normally 1408×800. Keep the originals.
- Processing is lazy. Only sources that templates actually reference are read, so
  unused or broken files under `images/` cannot break a build. The build fails with a
  clear `Image not found … (check path, letter case and Unicode normalization)` error
  for missing files, including wrong letter case on macOS. It also fails if more than
  256 distinct sources are referenced (`MAX_IMAGES`), or on oversized, animated or
  unsafe sources.
- `lib/responsive-images.js` is registered in `.eleventy.js`. It provides:
  - the `responsiveImage` shortcode: `<picture>` with WebP plus a JPEG/PNG fallback
    at 360/720/1200/1408 w (capped at the source width), measured `width`/`height`
    and `sizes`;
  - the async filter `socialImageMeta`, used by `base.njk`;
  - the async filter `imageThumbnail`, used for search cards.
  Output goes to the ignored `_site/assets/images/`. Never commit generated assets or
  hand-write their hashed URLs.
- **Loading:** the post hero and the first listing card load `eager` with
  `fetchpriority="high"`. Other listing cards, related-post cards and search cards are
  lazy.
- **Card images are decorative** (`alt=""`). The card title carries the meaning.
- **Hero alt:** `imageAlt` describes informative hero content. Leave it empty for
  decorative images. `imageText` is the visible caption, not alt text.
- **Social preview:** a measured raster variant, at most 1200 px wide, keeping the
  source aspect ratio. Its source is `socialImage || image || dashboardImage`. Pages
  without an image use the generated brand preview (1200×630 JPEG).
  - `og:image:alt`/`twitter:image:alt` should describe the preview image. With a
    dedicated `socialImage`, only `socialImageAlt` is used; the hero's `imageAlt` is
    never reused for a different image. Otherwise `imageAlt || dashboardImageAlt`
    applies. If no applicable alt is set, the alt tags are omitted.
  - The brand preview always uses the alt `Databearer-Logo`.
- **Social filename hashes** cover only the source path, the source bytes and
  `SOCIAL_RECIPE`. Sharp/libvips upgrades do not rename them, but changing
  `SOCIAL_RECIPE` does (a one-time change of shared `og:image` URLs; platforms
  show the new preview after re-scraping).
  Responsive-variant hashes include encoder versions.

## Search

`src/search.11ty.js` builds `/search.json` from published `post` and `dashboard`
collection items, leaving out drafts and `noindex` pages. Each entry contains:

- `title`, `url`, an ISO `date` and `topic`;
- `excerpt`: the excerpt, or for dashboards the `dashboardSummary`;
- `content`: rendered text, or for dashboards the summary;
- a card `thumbnail` for local images (`src`, `srcset`, `webpSrcset`, `sizes`,
  `width`, `height`).

All text is run through `lib/search-text.js`. It strips tags, comments, scripts
(including Datawrapper loaders), styles, iframes and similar, decodes entities in a
single pass and normalises whitespace. `/suche/` loads the index on the client,
needs at least 2 characters, and keeps `?q=` in sync using `history.replaceState`.

## Feeds

The private `video-generator` consumes `/feed.json` (JSON Feed 1.1). Each item keeps
these fields:

| Field | Value |
| --- | --- |
| `id`, `url` | absolute post URL |
| `title` | post `title` |
| `summary` | `excerpt` (or `description`) |
| `date_published`, `date_modified` | ISO `date` and `lastUpdated || date` |
| `image` | absolute URL of the original `image` (optional) |
| `_image_alt` | **`imageText`** (legacy name; optional) |
| `tags` | `topic` array |
| `content_html` | full content with absolute links, including query strings and fragments |

Renaming or removing a field, or changing what it means, breaks downstream users. The
Atom feed (`/feed.xml`) holds the latest 20 posts, and its `<updated>` is the latest
explicit `lastUpdated || date`. Neither feed uses build time, and both leave out
drafts.

## Topics

The current topics are `energie`, `wirtschaft` and `politik-und-gesellschaft`. A new
topic needs:

- a label in `topicNames` in `src/seo.js` (for breadcrumbs);
- a filtered collection in `.eleventy.js`;
- a page in `src/themen/` with `isTopicPage: true` and pagination using
  `addAllPagesToCollections: true`, so every archive page is included in the sitemap;
- the hard-coded labels in `post.njk` and the navigation in `base.njk`.

## Checks

Run from `frontend/` on the project's Node runtime. CI
([`frontend-ci.yml`](../.github/workflows/frontend-ci.yml), Node 20) runs the same
steps, plus `npm run test:v2`:

```bash
npm test -- --runInBand
npm run lint
npm run build
npm run test:seo-output
```

- `npm test` runs every Jest suite, including fixture builds for drafts, cleanup,
  sitemap, feeds and images, and the article chart, table and link tests. It does not
  depend on `_site/`.
- `npm run test:seo-output` sets `SEO_OUTPUT_CHECK=1` and runs
  `tests/seo-output.test.js` against the real `_site/` from the preceding
  `npm run build`. It reads only, fetches nothing, and fails if the output is
  missing. Rebuild after any source change. It checks:
  - on every HTML page: robots meta, canonical only on indexable pages, one `<title>`
    and one H1, a description, matching OG/Twitter tags, and parseable JSON-LD
    (`BlogPosting` dates and publisher);
  - on every HTML page: the `html.js` head script and its position, no AdSense while
    disabled, and the social alt rules;
  - local image files and measured `width`/`height`, raster `og:image` type and
    dimensions, and the 1200×630 brand preview;
  - unique canonicals and titles, and the homepage `WebSite`/`Organization` entities;
  - search completeness and indexability, with no draft HTML or references anywhere;
  - the sitemap rules, the robots sitemap URL, and `_headers` published unchanged;
  - the JSON Feed contract and the Atom latest-20 and `<updated>` rules.
- Manual review:
  - Check changed pages on desktop and mobile: charts, tables, keyboard navigation,
    console errors and static evidence with JavaScript disabled.
  - Check the generated metadata of new images.
  - Check `git status` for incidental changes to `src/css/style.css`, chart or data
    files.

A passing build is not a deployment check. After a separately authorised
deployment, verify the public HTML, headers, redirects, feeds, sitemap, robots and
image URLs on the live host.

## Hosting and editorial follow-ups

These are manual follow-ups. This guide does not authorise them.

1. **Apex redirect:** check the live `databearer.de` redirect. If the current 307 is
   meant to be permanent, consider a 301/308 that keeps paths and queries.
2. **Preview domains:** Cloudflare preview hosts need preview `noindex` headers or
   access control. Canonical tags do not protect private content.
3. **Crawler access:** make sure bot/WAF rules do not block or challenge legitimate
   search crawlers. Check real request evidence rather than user-agents.
4. **Core Web Vitals:** review field data (Search Console/CrUX). Lab scores are not
   field validation.
5. **Legacy evidence:**
   - Not every Datawrapper chart has a verified numerical HTML equivalent. Before
     adding a table, verify the annual values and partial-year scope in
     `Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md`.
   - The tables in `Industriepolitik.md` reproduce the checked-in chart values. The
     original PV/battery units are unconfirmed.
   - The historical incident claims in `Die-Dunkelflaute-der-Kernkraft:-Hitzewellen.md`
     still need primary-source citations.
