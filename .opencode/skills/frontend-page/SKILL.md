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
   # noindex: true            # reachable utility page: noindex, follow + no canonical
   # excludeFromSitemap: true  # sitemap only; does not add noindex
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
   title: "Post Title" # accurate claim; no brand suffix
   date: YYYY-MM-DD
   draft: true # boolean; remove when publishing
   excerpt: "Key finding first, 1–2 plain-text sentences."
   image: "/images/blog_card_images/<year>/<file>.png"
   imageAlt: "" # describe informative heroes; empty if decorative
   imageText: "Visible editorial image caption"
   topic: ["energie"] # energie, wirtschaft, politik-und-gesellschaft
   fullWidthCard: false
   # lastUpdated: YYYY-MM-DD # real substantive revision only
   # metaTitle: "Optional accurate title override"
   # metaDescription: "Optional accurate description override"
   # socialImage: "/images/blog_card_images/<year>/<social-file>.png"
   # socialImageAlt: "Description of the social preview image"
   ---
   ```

4. Write the body with H2/H3 only. The layout renders the H1, excerpt and byline.
   Start with the key takeaway, add static chart evidence, and end with a
   Methodik/Datenquellen section. Follow the
   [post QA guide](../../../frontend/docs/post_guidlines.md).
5. For posts with charts, also use the `frontend-visualization` skill.
6. Run the [checks](../../../docs/seo.md#checks): `npm test -- --runInBand`,
   `npm run lint`, `npm run build`, then `npm run test:seo-output`.

### Drafts, indexing, images and feeds (summary)

[`docs/seo.md`](../../../docs/seo.md) is the single detailed source. In short:

- `draft: true` works on any template and in every run mode, including `npm start`.
  A draft produces no HTML and does not appear in collections, the sitemap, feeds or
  search. To preview it, set `draft: false` temporarily. Stale HTML is removed only
  after a successful full `npm run build` ([Drafts](../../../docs/seo.md#drafts)).
- `noindex: true` gives `noindex, follow`, no canonical, and no sitemap or search
  entry. `excludeFromSitemap` only affects the sitemap
  ([Indexing](../../../docs/seo.md#indexing-and-sitemap)).
- Images must be local `/images/...` files, and only referenced sources are
  processed. Cards are decorative. `socialImageAlt`/`imageAlt` describe the image;
  without them `og:image:alt` is omitted ([Images](../../../docs/seo.md#images)).
- `/feed.json` fields are consumed by the private `video-generator`. Never rename or
  remove them; `_image_alt` is `imageText` ([Feeds](../../../docs/seo.md#feeds)).
- AdSense is disabled site-wide in `src/_data/site.js`, and there is no per-page
  switch ([Metadata](../../../docs/seo.md#metadata-and-structured-data)).

## Topic pages and collections

Current topics:

- `energie`
- `wirtschaft`
- `politik-und-gesellschaft`

Topic-specific collections are defined in `.eleventy.js` as `energiePosts`, `wirtschaftPosts`, and
`politikPosts`. A new topic needs:

- a `topicNames` entry in `src/seo.js`;
- a collection in `.eleventy.js`;
- a `src/themen/` page with `isTopicPage: true` and `addAllPagesToCollections: true`;
- updated labels in `post.njk` and the navigation in `base.njk`.

See [Topics](../../../docs/seo.md#topics).

## Build notes

- `npm run build` runs Sass and a full Eleventy build, which includes stale-HTML cleanup. It may
  rewrite `src/css/style.css`; do not commit that incidental change unless intended.
- `_site/` and `node_modules/` are generated/ignored.
- Cloudflare Pages builds from the `frontend` root directory on the deployment branch.
- Authoring/build checks do not authorize committing, pushing, publishing, or deploying.
