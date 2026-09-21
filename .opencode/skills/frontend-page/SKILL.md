---
name: frontend-page
description: Guides adding or updating pages and posts in the databearer Eleventy frontend, including layouts, frontmatter, topic collections, feeds, navigation considerations, and build checks.
compatibility: opencode
metadata:
  project: databearer
  area: frontend
---

# Databearer frontend page skill

## When to use this skill

Use this skill for tasks in `databearer/frontend/` that add or change:

- Static pages such as `about.md`, `supportme.md`, `quellen.md`, legal pages, or search pages.
- Blog posts under `src/posts/<year>/`.
- Topic landing pages under `src/themen/`.
- Layout usage, frontmatter, Eleventy collections, feeds, or page metadata.

## Frontend basics

The frontend is an Eleventy v3 site. Run commands from `databearer/frontend/`.

```bash
npm install
npm start          # local dev server + Sass watch
npm run build      # production build into _site
```

Important folders:

- `src/`: Eleventy input.
- `src/_includes/`: layouts (`base.njk`, `post.njk`, `supporting_sites.njk`, `all_posts.njk`).
- `src/_data/site.js`: global site metadata.
- `src/posts/<year>/`: Markdown blog posts.
- `src/themen/`: topic landing pages.
- `src/feed.json.njk` and `src/feed.njk`: JSON Feed and Atom feed.
- `src/images/blog_card_images/`: tracked, curated card/header images.

## Adding a static page

1. Create a Markdown or Nunjucks file directly under `src/` when it should become a top-level page.
2. Add frontmatter. Most simple supporting pages use:

   ```yaml
   ---
   layout: supporting_sites
   title: Seitentitel
   # noindex: true # public utility page that should not be indexed
   # excludeFromSitemap: true # sitemap exclusion alone does not prevent indexing
   ---
   ```

3. Write content with exactly one visible H1 if the layout does not provide it. Use H2/H3 below it.
4. If the page should appear in navigation, update the relevant navigation markup in
   `src/_includes/base.njk`.
5. Run `npm run build` and check the generated route in `_site/` or the dev server.

## Adding a blog post

1. Create `src/posts/<year>/<descriptive-slug>.md`.
2. Use `layout: post` only if not inherited by directory data; otherwise follow existing posts.
3. Required/recommended frontmatter:

   ```yaml
   ---
   title: "Post Title"
   date: YYYY-MM-DD
   draft: true # boolean; remove or set false only when ready for publication
   excerpt: "Accurate, concise summary of the key insight and scope."
   image: "/images/blog_card_images/<year>/<file>.png"
   imageAlt: "" # decorative hero; describe meaningful image content when needed
   imageText: "Visible editorial image caption"
   topic: ["energie"] # energie, wirtschaft, politik-und-gesellschaft
   fullWidthCard: false
   # lastUpdated: YYYY-MM-DD # actual substantive revision date, not build time
   # metaTitle: "Optional accurate title override"
   # metaDescription: "Optional accurate description override"
   # socialImage: "/images/blog_card_images/<year>/<social-file>.png"
   # socialImageAlt: "Description of the social preview image"
   ---
   ```

4. Follow the [post QA guide](../../../frontend/docs/post_guidlines.md) and
   [SEO authoring contract](../../../docs/seo.md):
   - The template handles the H1; use H2/H3 in the body.
   - The layout automatically displays the author from `site.author` with an author link.
   - Start with a concise key takeaway.
   - Include static chart evidence (summaries or tables), units, periods, source links,
     and a Methodik/Datenquellen section. Verify legacy citations; never invent them.
   - Use relevant internal links and authoritative source links with descriptive text.
     No fixed title/description character quota or keyword list is required.
5. For posts with charts, also use the `frontend-visualization` skill.
6. Run `npm test -- --runInBand`, `npm run lint`, and `npm run build`. Follow the
   generated-output checklist in the SEO guide, run `npm run test:seo-output`
   after building, and inspect post/topic/search/sitemap/feed output.

### Drafts, dates, and images

- Set `draft: true` as a YAML boolean in post frontmatter. The inherited
  `src/posts/posts.11tydata.js` computed permalink suppresses HTML output and computed
  collection exclusion removes discovery references. Do not override these computed
  fields. Future dates do not make a post a draft.
- Drafts must be absent from post/topic collections, related posts, sitemap, feeds,
  and search. A full production build inventories owned HTML and removes stale
  pages only after Eleventy writes templates successfully. Cleanup is scoped to
  canonical project `_site`; custom fixture `_site` directories require the explicit
  ownership marker described in `docs/seo.md`. Dry runs/no-write runs do no cleanup;
  render failures do not delete stale pages. This is not an atomic-build guarantee.
  Watch/incremental output is not the production acceptance check.
- `noindex: true` is for a page that remains publicly reachable; it is not a draft
  or access-control mechanism. `excludeFromSitemap` only controls sitemap inclusion.
- Use explicit publication dates and actual substantive `lastUpdated` dates. Omit
  `lastUpdated` until a real revision; never manufacture freshness from a build date.
- Local `image` and optional `socialImage` paths resolve under `src/images/` as
  `/images/...`. The responsive helper in `frontend/lib/responsive-images.js`,
  requiring `require('./lib/responsive-images').register(eleventyConfig)` registration,
  builds variants locally, preserves source images, and supplies real dimensions.
  Generated `/assets/images/` files belong to ignored build output, not source control.
- `imageAlt` defaults to empty for the hero; use it for meaningful image content.
  `imageText` is a visible caption, not an automatic hero alt. Cards are decorative.
  Optional `socialImageAlt` describes the social preview. Metadata uses a raster
  variant with measured dimensions. Builds do not fetch remote image sources.

## Topic pages and collections

Current topics:

- `energie`
- `wirtschaft`
- `politik-und-gesellschaft`

Topic-specific collections are defined in `.eleventy.js` as `energiePosts`, `wirtschaftPosts`, and
`politikPosts`. If adding a new topic:

1. Add or update topic page in `src/themen/`.
2. Add a collection in `.eleventy.js`.
3. Update navigation and any topic filters/cards.
4. Check feed/search behavior.

## Feed contract caution

The private `video-generator` consumes the published JSON Feed at `/feed.json`. Do not rename or
remove existing item fields in `src/feed.json.njk` (`id`, `url`, `title`, `summary`,
`date_published`, `date_modified`, `image`, `tags`, `content_html`) unless explicitly treating it
as a breaking change. Preserve the optional `_image_alt` extension and original image
URL contract as well; responsive/social variants must not silently replace feed fields.
Verify absolute links and image URLs in `content_html` and exclusion of drafts.

## Build notes

- `npm run build` runs Sass and a full Eleventy build with HTML cleanup. It may rewrite `src/css/style.css`; do not commit that
  incidental change unless intended.
- `_site/` and `node_modules/` are generated/ignored.
- Cloudflare Pages builds from the `frontend` root directory on the deployment branch.
- Authoring/build checks do not authorize committing, pushing, publishing, or deploying.
  SEO hygiene improves clarity and discoverability; it does not promise rankings.
