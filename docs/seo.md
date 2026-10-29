# SEO, AI discoverability and authoring contract

This is the single detailed reference for how the frontend handles drafts, indexing,
crawlers, metadata, images, search, feeds and post markup, and for the checks that
verify them. Other guides only summarise it and link here. It has two parts:

- **Technical contract** (sections up to [Checks](#checks)): what the build does and
  what the tests enforce. Change it together with code and tests.
- **[Recommendations](#recommendations-non-code)**: editorial, hosting, monitoring and
  off-page work that needs no code, or needs an owner decision first.

Following this guide supports accurate, accessible pages that search engines and AI
answer engines can discover and cite. It does not promise rankings, indexing, rich
results, AI citations or traffic. Passing the checks does not authorize commits, pushes,
publication or deployment. Dashboard architecture and publication are covered by their
own runbooks, not by this guide.

Implementation: [`.eleventy.js`](../frontend/.eleventy.js), [`src/seo.js`](../frontend/src/seo.js),
[`base.njk`](../frontend/src/_includes/base.njk), [`post.njk`](../frontend/src/_includes/post.njk),
[`site.js`](../frontend/src/_data/site.js), [`lib/responsive-images.js`](../frontend/lib/responsive-images.js),
[`search.11ty.js`](../frontend/src/search.11ty.js), [`llms.11ty.js`](../frontend/src/llms.11ty.js),
[`robots.njk`](../frontend/src/robots.njk), [`sitemap.njk`](../frontend/src/sitemap.njk),
[`dashboards.11tydata.js`](../frontend/src/dashboards/dashboards.11tydata.js) and
[`_headers`](../frontend/src/_headers). For a per-article checklist, see the
[post QA guide](../frontend/docs/post_guidlines.md).

## Drafts

- Add boolean `draft: true` to **any** template (post, page or dashboard), either in
  frontmatter or in directory data. The `drafts` preprocessor in `.eleventy.js` skips
  it before rendering, in every run mode, including `npm start`. A draft produces no
  HTML and does not appear in collections, related posts, topic pages, the sitemap,
  either feed, `/search.json` or `/llms.txt`. A future `date` does not make a page a
  draft.
- To preview a draft locally, set `draft: false` temporarily and do not commit the
  change. Do not rely on `noindex`, hidden cards or `permalink: false` to hide a draft.
- Before publishing, remove any extra exclusions that were added while drafting.
  For example, `eleventyExcludeFromCollections: true` or `excludeFromSitemap: true`
  would keep the post out of collections, feeds, the sitemap or `/llms.txt` after
  `draft` is removed.
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

- **Robots meta:** indexable pages get
  `<meta name="robots" content="index, follow, max-image-preview:large">`, so search
  engines may show large image previews (for example in Google Discover). The values
  are `ROBOTS_INDEX`/`ROBOTS_NOINDEX` in `seo.js`.
- **`noindex: true`** in frontmatter is for a public utility page that should stay
  reachable but not indexed. It currently applies to `/suche/` and `/404.html`. The
  page gets `noindex, follow`, has **no** canonical link, no BreadcrumbList and no
  Dataset, and is left out of the sitemap, the search index and `/llms.txt`.
  Indexable pages get a canonical built from `site.url` and the page URL. Paginated
  archives each use their own URL.
- **`excludeFromSitemap: true`** only removes the sitemap and `/llms.txt` entries. It
  does not add `noindex`. Neither flag, nor `robots.txt`, controls access.
- **Sitemap** (`sitemap.njk`, filter `indexablePages`): it lists public HTML routes
  (URLs ending in `/` or `.html`) from `collections.all`. It excludes drafts, `noindex`
  pages, `excludeFromSitemap` pages, pages with `eleventyExcludeFromCollections`, and
  feed/JSON/text routes. `/about/`, the dashboards and paginated archives (e.g. `/1/`)
  are included. `lastmod` is a UTC date only (`YYYY-MM-DD`):
  - posts: `lastUpdated || date`;
  - data pages with a Dataset (currently `/dashboards/strom/`): the creation date of
    the published data snapshot (`dataModified`, the Dataset's `dateModified`);
  - other static pages: no `lastmod`.

  Build time and file timestamps are never used.
- `_headers` (Cloudflare):
  - `X-Robots-Tag: noindex` for `/search.json` and `/llms.txt`, and `noindex, follow`
    for `/suche/` and `/404`. Pretty URLs redirect `/404.html` to `/404`. For 404
    responses on arbitrary paths, the page's robots meta applies.
  - `X-Robots-Tag: noindex` for every `https://:project.pages.dev/*` and
    `https://:version.:project.pages.dev/*` request. Cloudflare marks preview
    deployments `noindex` by itself, but not the production `*.pages.dev` alias,
    which duplicates the custom domain. The custom domain is unaffected.
  - `/assets/images/*` is cached for a year as `immutable` because the filenames
    contain hashes.

## Crawlers and AI discovery

- **`robots.txt`** comes from `robots.njk`. It allows every crawler (`User-agent: *`,
  `Allow: /`) and points to `${site.url}/sitemap.xml`. It also names AI agents in two
  groups with the same `Allow: /` rule, to make the policy explicit:
  - AI search and user-requested fetches: `OAI-SearchBot`, `ChatGPT-User`,
    `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`,
    `DuckAssistBot`, `MistralAI-User`, `meta-externalfetcher`;
  - AI training and model use: `GPTBot`, `ClaudeBot`, `Google-Extended`,
    `Applebot-Extended`, `meta-externalagent`, `Amazonbot`, `CCBot`, `Bytespider`.

  Allowing training crawlers is a deliberate owner decision. To change it, edit the
  groups in `robots.njk`, add a `Disallow`, and update the robots tests. The tokens
  follow the vendors' crawler documentation as of October 2026; review them
  periodically (see [Recommendations](#crawler-access-and-hosting)). `robots.txt` is a
  published preference, not access control. Firewall or bot-management rules can
  still block crawlers.
- **`/llms.txt`** ([llmstxt.org](https://llmstxt.org) convention) is generated by
  `llms.11ty.js`. It is Markdown: the site name as H1, the site description as a
  quote, a short note on author, language and citation, then sections:
  - `## Artikel`: every published, indexable post, newest first, with its excerpt,
    publication and update date and topic labels;
  - `## Dashboards`: indexable dashboards with summary and update cadence;
  - `## Themen`: the topic pages with their descriptions;
  - `## Optional`: the author page, the dashboard overview, both feeds and the sitemap.

  Only items that pass `indexable` (published, not `noindex`, not
  `excludeFromSitemap`) are listed. Links are absolute and percent-encoded. Brackets
  in titles are escaped. It uses no build time. It is an index, not a copy of the
  articles. `llms.txt` is an emerging convention; no search engine or AI service
  guarantees to use it.
- **Server-rendered content:** articles, chart descriptions, tables, topic pages and
  dashboard summaries are static HTML. Crawlers that do not run JavaScript, which
  includes most AI crawlers, see the same text and numbers as readers (see
  [Charts and evidence](#charts-and-evidence)).
- **Heading anchors:** Eleventy's built-in `IdAttributePlugin` gives every heading
  without an `id` a stable slug (`ä` → `ae`, `ß` → `ss`), so sections can be linked
  and cited as `/posts/<year>/<slug>/#<heading>`. Existing ids are kept, and
  duplicate ids fail the build. It changes page HTML only; feed `content_html` is
  unchanged.

### Considered and not implemented

These were reviewed during the October 2026 audit and deliberately left out:

| Item | Reason |
| --- | --- |
| `llms-full.txt` or Markdown copies of every page | Needs a reliable HTML-to-Markdown conversion (a new dependency) and duplicates content. The HTML pages and the JSON Feed (`content_html`) already carry the full text. |
| `Content-Signal` lines in `robots.txt` | A non-standard Cloudflare proposal. The explicit groups already state the allow-all decision. |
| `WebSite` `SearchAction` (sitelinks search box) | Google retired the sitelinks search box in November 2024. |
| `FAQPage`/`HowTo` markup, ratings or reviews | The articles contain no such visible content; adding it would be invented markup. |
| Machine-readable `citation`/`isBasedOn` on articles | Sources are visible links in each article. Copying them by hand into markup would drift. Datasets use `isBasedOn` because their source comes from validated data. |
| IndexNow pings in the build | Would need a key file and a network call on deploy. Cloudflare Crawler Hints can do this at the edge (see Recommendations). |
| Image, news or video sitemaps; `hreflang`; `rel="prev/next"` | Images are discoverable from pages, the site is not a news publisher, it has one language, and Google no longer uses `prev/next`. |
| `keywords` meta tag | Ignored by major search engines. |
| Organization `publishingPrinciples` and Person `sameAs` | Need a corrections/methodology page and personal profile URLs that do not exist yet (owner input; see Recommendations). |

## Metadata and structured data

- **Title:** `metaTitle || title` (fallback `site.title`), plus ` – Seite N` on later
  archive pages. Posts get **no** brand suffix. Topic pages include
  "– Databearer" in their own `title`. Every page title must be unique.
- **Description:** `metaDescription || excerpt || description || site.description`.
  The same values feed Open Graph and Twitter tags. `og:type` is `article` for posts
  and `website` otherwise. Posts also get `article:published_time`, plus
  `article:modified_time` when `lastUpdated` is set.
- **JSON-LD** (from `seoMetadata`, one entity per `<script>`):
  - Posts: `BlogPosting` with headline, image, `author`, publisher Organization,
    `datePublished`/`dateModified` (`lastUpdated || date`) and `articleSection` (the
    labels of the post's known topics, in frontmatter order).
  - **Author identity:** one `Person` (`site.author`, `@id` `<site.url>/about/#person`,
    `url` `/about/`) is the `author` of every post and the `founder` of the
    Organization. The author page (`site.authorUrl`) is an `AboutPage` whose
    `mainEntity` is that Person, which it also publishes as its own entity.
  - Other pages: `CollectionPage` for topics, archives and `/dashboards/`, and
    `WebPage` for everything else.
  - Homepage only: a `WebSite` entity (`name: 'Databearer'` from `site.name`,
    `alternateName: [site.title]`) and an `Organization` entity (measured logo
    `logo_transparent.png` 1070×388, `sameAs: site.social`, founder, description).
  - **Datasets:** a page whose data includes a `dataset` descriptor gets a `Dataset`
    entity (`@id` `<url>#dataset`), and its page entity names it as `mainEntity`.
    `seo.js` requires `name` and `description` and omits every optional field that
    is missing. Descriptors are code, not frontmatter: `dashboards.11tydata.js` maps
    a permalink to a builder (currently only `/dashboards/strom/`). The electricity
    dataset is built from the validated snapshot and history manifest: the page
    description, SMARD as `isBasedOn`, the CC BY 4.0 licence and `creditText`,
    Germany as coverage, `temporalCoverage` from the history manifest, the measured
    series, the snapshot creation time as `dateModified`, and the two JSON downloads
    linked on the page as `DataDownload`s. A new dashboard with downloadable data
    needs its own builder with only facts the page visibly states, plus tests.
  - Every indexable page except `/`: `BreadcrumbList` Home → first topic (posts) →
    page. Topic labels come from `topicNames` in `seo.js`.
- **Ads:** AdSense is disabled for the whole site by `adsense.enabled: false` in
  `src/_data/site.js`. There is no per-page switch. When disabled, no AdSense script
  or `adsbygoogle` reference appears in any page. Turning ads back on needs an owner
  decision, a consent tool on every page, and updated Impressum, Datenschutzerklärung
  and Supportme notes. Those pages currently say ads are disabled.

## Content guidance

- **`excerpt`** is used as the meta description, card text, search excerpt, feed
  summary and `/llms.txt` note. Write it as plain text in 1–2 sentences, with the key
  finding first. Do not use Markdown or HTML. Leave out draft labels such as
  "Rechercheentwurf". Do not pad the copy or aim for a fixed length or keyword list.
- **`title`**: an accurate claim, with scope or timeframe where needed. Lead with the
  most interesting true finding rather than the topic; no clickbait (see the
  `blog-post-workflow` skill, *Make it worth reading*). `metaTitle`
  and `metaDescription` are optional and must match the visible content.
- **Dates:** use an explicit publication `date`. Set `lastUpdated` only for a real
  substantive editorial, data or chart revision.
- **Corrections:** set `lastUpdated` and add a visible italic note, e.g.
  `*Korrektur vom 23. September 2026: …*`, that says what changed and whether the data
  changed.
- **Structure:** the post layout renders the single H1, the excerpt and the linked
  byline (`site.author` → `/about/`). The body uses H2/H3, starts with the key
  takeaway, and ends with a short "Daten und Quellen" section (source, date, what
  was left out; technical detail belongs in `docs/`). Headings become anchors
  automatically, so renaming a heading after publication breaks links to it; give a
  heading an explicit `id` if other pages link to it.
- **Internal links:** use root-relative `/posts/<year>/<slug>/` with a trailing
  slash. `<slug>` is the Markdown filename without `.md`, with case preserved.
  Topic links use the form `/themen/<topic>/`. Link text must describe the target;
  do not use "hier".
- **New slugs:** name new post files in lowercase ASCII with hyphens (`ä` → `ae`, no
  colons, spaces or capitals). Never rename a published post file; its URL would
  change (see [URLs and slugs](#urls-and-slugs)).
- **Citations:** verify sources against the originals, covering dataset, period and
  method. Record anything unresolved instead of making up URLs, dates or provenance.
  Do not silently refresh frozen article data.

## Charts and evidence

Every chart needs static HTML evidence that works without JavaScript. That means a
verified description with key values, and a table for detailed comparisons, together
with units, period, scope and a descriptive source link. This is also what search
engines and AI crawlers can read and quote. This pattern passes
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
drafts. Feed content is the rendered Markdown before page transforms, so heading
anchors do not appear in it.

## Topics

The current topics are `energie`, `wirtschaft` and `politik-und-gesellschaft`. A new
topic needs:

- a label in `topicNames` in `src/seo.js` (breadcrumbs, `articleSection` and
  `/llms.txt`);
- a filtered collection in `.eleventy.js`;
- a page in `src/themen/` with `isTopicPage: true`, a `description`, and pagination
  using `addAllPagesToCollections: true`, so every archive page is included in the
  sitemap;
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
  sitemap, feeds, `/llms.txt` and images, the robots policy, the structured-data
  builders (Person, `articleSection`, Dataset), the registered heading-id plugin,
  and the article chart, table and link tests. It does not depend on `_site/`.
- `npm run test:seo-output` sets `SEO_OUTPUT_CHECK=1` and runs
  `tests/seo-output.test.js` against the real `_site/` from the preceding
  `npm run build`. It reads only, fetches nothing, and fails if the output is
  missing. Rebuild after any source change (`npm run test:v2` also rebuilds). It
  checks:
  - on every HTML page: robots meta, canonical only on indexable pages, one `<title>`
    and one H1, a description, matching OG/Twitter tags, and parseable JSON-LD
    (`BlogPosting` dates and publisher);
  - on every HTML page: the `html.js` head script and its position, no AdSense while
    disabled, the social alt rules, an `id` on every heading and no duplicate ids;
  - local image files and measured `width`/`height`, raster `og:image` type and
    dimensions, and the 1200×630 brand preview;
  - unique canonicals and titles, the homepage `WebSite`/`Organization` entities,
    one author `Person` across articles, Organization and `/about/`, and
    `articleSection`;
  - every Dataset: `mainEntity` link, description of at least 50 characters equal
    to the page description, licence and source links visible on the page,
    coverage, and downloads that exist and parse as JSON;
  - search completeness and indexability, with no draft HTML or references anywhere;
  - the sitemap rules (including Dataset `lastmod`), the robots policy and sitemap
    URL, `/llms.txt` links (indexable pages and machine routes only, every article
    and dashboard), and `_headers` published unchanged;
  - the JSON Feed contract and the Atom latest-20 and `<updated>` rules.
- Manual review:
  - Check changed pages on desktop and mobile: charts, tables, keyboard navigation,
    console errors and static evidence with JavaScript disabled.
  - Check the generated metadata of new images.
  - Check `git status` for incidental changes to `src/css/style.css`, chart or data
    files.

A passing build is not a deployment check. After a separately authorised
deployment, verify the public HTML, headers, redirects, feeds, sitemap, robots,
`/llms.txt` and image URLs on the live host.

## Recommendations (non-code)

These are recommendations, not authorisations. Each item needs no code change, or
needs an owner decision before any code change. Findings were checked against the
repository and the live site on 2026-10-29; re-check them before acting. None of them
guarantees rankings or AI citations.

### Crawler access and hosting

1. **`www` host:** `https://www.databearer.de/` answers `200` with the full site.
   Only the canonical tag points to `blog.databearer.de`. Add a permanent (301/308)
   redirect from every `www` path to the same path on `blog.databearer.de`, keeping
   the query string (Cloudflare Bulk Redirects; Pages `_redirects` does not support
   domain-level redirects). Do not use `noindex` for this, because it conflicts with
   the canonical.
2. **Apex redirect:** `databearer.de` still answers `307` (temporary) to
   `blog.databearer.de`, keeping path and query. If this is meant to be permanent,
   switch it to 301/308.
3. **`*.pages.dev`:** after the next deployment, check
   `curl -sI https://<project>.pages.dev/ | grep -i x-robots-tag` shows `noindex`.
   Cloudflare preview deployments already have it by default.
4. **AI bot settings in Cloudflare:** `robots.txt` allows all AI crawlers. Check that
   Cloudflare's AI Crawl Control, "Block AI bots", Bot Fight Mode and the
   Search/Training/Agent controls (introduced September 2026) do not block or
   challenge them, otherwise they override the published policy. Keep Cloudflare's
   *managed robots.txt* off, or make sure what it adds matches this policy.
5. **Verify with real traffic:** use Cloudflare's per-bot analytics or logs. Verify
   bots by the IP lists their operators publish (OpenAI, Perplexity, Anthropic,
   Google, Bing), not by user agent alone, and look for `403`/challenge responses.
6. **Crawler list review:** every six months, compare the named agents in
   `robots.njk` with the vendors' crawler pages (OpenAI, Anthropic, Perplexity,
   Google, Apple, Meta) and the Cloudflare bot reference, and update the list.
7. **Core Web Vitals:** review field data in Search Console or CrUX. Chart posts load
   the deferred ECharts bundle (about 1.1 MB). Lab scores are not field validation.

### Search engines and monitoring

- **Google Search Console and Bing Webmaster Tools:** verify the domain (DNS
  verification covers all hosts), submit `/sitemap.xml`, and review indexing
  reports, the robots.txt report and Core Web Vitals. Bing matters for AI search too:
  Microsoft Copilot uses the Bing index, and ChatGPT search has used it as a source.
- **IndexNow:** enable Cloudflare *Crawler Hints* to notify Bing, Yandex and other
  IndexNow engines when pages change, without code.
- **After deployment:** test one post, the dashboard and `/about/` with Google's Rich
  Results Test and the Schema.org validator. The dashboard Dataset may appear in
  Google Dataset Search after crawling; it can take weeks and is not guaranteed.
- **AI visibility:** every few months, ask ChatGPT, Perplexity, Claude, Copilot and
  Google AI Mode about topics the blog covers (for example wind auction results or
  battery storage expansion) and record whether and how Databearer is cited. Check
  referrers such as `chatgpt.com`, `perplexity.ai`, `claude.ai` and `copilot` in
  server-side or Cloudflare statistics. Adding a client-side analytics script would
  need a privacy-policy update and is not part of this guide.

### Writing for search and AI citation

The [Content guidance](#content-guidance) rules apply. In addition:

- Start each section with a self-contained statement that still makes sense when it
  is quoted alone: what, where, when, how much, with unit and source. AI answers
  quote passages, not whole pages.
- Use descriptive H2/H3 headings that name the finding or question ("Große Speicher
  wachsen am schnellsten"), not generic ones ("Analyse"). They are now link anchors.
- State the data date in the text ("Stand: September 2026", "Daten bis 28. Oktober
  2026"), not only in charts or captions.
- Name entities consistently and in full on first use (Bundesnetzagentur, SMARD,
  Marktstammdatenregister, EEG) and explain abbreviations.
- Put key numbers in sentences and tables. Charts alone are invisible to most
  crawlers.
- Keep the "Daten und Quellen" section, with direct links to the primary sources.
- For corrections, set `lastUpdated` and add a visible correction note, so that
  search engines and AI tools see a real change date.

### Titles and descriptions

- **Long excerpts:** these excerpts are longer than roughly 160 characters, so search
  results will truncate them. Put the finding in the first sentence, or add a
  shorter accurate `metaDescription` without changing the excerpt:
  `strompreis-gaspreis-erneuerbare` (267), `Staatsverschuldung-besser-als-gedacht`
  (246), `Das-fadenscheinige-Argument-der-Rekordsteuereinnahmen` (229),
  `batteriespeicher-wandel` (217), `Industriepolitik` (190),
  `Sensationelle-Ausschreibungserfolge-für-die-Windkraft` (172),
  `Erfreuliche-Entwicklung-für-die-Windkraft` (171) and
  `Die-Dunkelflaute-der-Kernkraft:-Hitzewellen` (165).
- **Long titles:** the strompreis article title (80 characters) and the homepage
  title (65) may be shortened in results. Keep the most important words first.
- **Missing own descriptions:** the homepage, `/about/` and `/impressum/` fall back
  to the site description, so three pages share one meta description. Add a
  specific `description` to each, especially `/about/`, which is the author page of
  every article.
- **Question-style titles** ("Deutschland der kranke Mann Europas?") are fine for
  readers, but answer the question in the excerpt.

### Internal linking

- Posts without a contextual link to another article:
  `Das-fadenscheinige-Argument-der-Rekordsteuereinnahmen`,
  `Die-Dunkelflaute-der-Kernkraft:-Hitzewellen`,
  `Erneuerbare-Stromerzeugung-auf-dem-Vormarsch`, `Industriepolitik` and
  `strom-dashboard-einfuehrung`. The automatic "Verwandte Beiträge" cards help, but
  contextual links in the text carry more meaning.
- Link the wind-auction articles (2024, 2025, 2026) to each other as a series, and
  link electricity articles to the matching dashboard view and back.
- Use topic pages as hubs: a short intro paragraph that links to the most important
  articles and the dashboard.

### Entity and trust signals

- **Author page:** expand `/about/` with expertise, the approach to data and
  sources, a contact route and a corrections policy. Answer engines use such pages to
  judge who is behind a claim.
- **Methodology and corrections page:** a short public page on how data is selected,
  processed, frozen and corrected. Once it exists, the Organization can reference it
  as `publishingPrinciples` (small code change).
- **Personal profiles:** if the author wants to be linked as a person (for example
  LinkedIn or a personal GitHub profile), list them on `/about/`. They can then be
  added as Person `sameAs`. The Bluesky and X accounts are the brand's profiles and
  stay on the Organization.
- **`/quellen/`** is indexable but excluded from the sitemap, and it is thin (one
  general paragraph). Either turn it into a real source and methodology page and
  include it, or mark it `noindex`.
- Use the name "Databearer" consistently in bios, social profiles and the GitHub
  repository description, and link back to `https://blog.databearer.de/`.

### Off-page and distribution

- Share each new article and major dashboard update with the key figure (see the
  `social-copy-prep` skill). Being cited by others is the strongest discovery
  signal for search and AI alike.
- Offer the open data and the dashboard to communities that use these sources
  (energy and data-journalism communities, SMARD or Energy-Charts users). Reuse with
  attribution creates links.
- Keep the GitHub repository description and README linking to the blog and
  dashboard.

### URLs and slugs

- Ten of thirteen post URLs contain capital letters, umlauts (`für`, percent-encoded
  as `f%C3%BCr`) or a colon (`Die-Dunkelflaute-der-Kernkraft:-Hitzewellen`). They
  work and are already indexed, so **keep them**. Changing a URL loses accumulated
  signals and breaks shared links unless every old URL redirects permanently (301)
  to the new one. That needs an explicit decision, a redirect list and tests.
- New posts follow the slug rule in [Content guidance](#content-guidance).

### Images

- Most heroes have an empty `imageAlt`, so they are treated as decorative. That is
  correct for illustrations that add no information. If a hero shows something
  specific (a chart, a place, a technology), describe it in `imageAlt`. The social
  preview alt follows from it.

### Legacy evidence

- Not every Datawrapper chart has a verified numerical HTML equivalent. Seven legacy
  posts rely only on Datawrapper embeds. Before adding a table, verify the annual
  values and partial-year scope, starting with
  `Erneuerbare-Stromerzeugung-auf-dem-Vormarsch.md`.
- The tables in `Industriepolitik.md` reproduce the checked-in chart values. The
  original PV/battery units are unconfirmed.
- The 2022/2023/2025 reactor-throttling claims in
  `Die-Dunkelflaute-der-Kernkraft:-Hitzewellen.md` still need primary-source
  citations.
