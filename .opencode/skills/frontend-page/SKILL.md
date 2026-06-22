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
   excludeFromSitemap: true # only if the page should be hidden from sitemap
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
   excerpt: "140-160 character summary of the key insight."
   image: "/images/blog_card_images/<year>/<file>.png"
   imageText: "Short descriptive image caption"
   topic: ["energie"] # energie, wirtschaft, politik-und-gesellschaft
   fullWidthCard: false
   lastUpdated: YYYY-MM-DD # set when data or charts change
   metaTitle: "Optional shorter SEO title"
   metaDescription: "Optional SEO description"
   ---
   ```

4. Follow `docs/post_guidlines.md`:
   - The template handles the H1; use H2/H3 in the body.
   - Start with a concise key takeaway.
   - Include chart summaries, sources, and a Methodik/Datenquellen section when relevant.
   - Add a few internal links and authoritative external source links.
5. For posts with charts, also use the `frontend-visualization` skill.
6. Run `npm run build` and check the post, topic pages, search data, sitemap, and feeds if relevant.

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
as a breaking change.

## Build notes

- `npm run build` runs Sass and Eleventy. It may rewrite `src/css/style.css`; do not commit that
  incidental change unless intended.
- `_site/` and `node_modules/` are generated/ignored.
- Cloudflare Pages builds from the `frontend` root directory on the deployment branch.
