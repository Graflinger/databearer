---
name: blog-post-workflow
description: Use when turning a topic candidate or data-source finding into a Databearer blog post with data, charts, frontmatter, QA, and build checks.
compatibility: opencode
metadata:
  project: databearer
  area: editorial
---

# Databearer blog post workflow skill

## When to use this skill

Use this skill when the user asks to create, draft, update, or finish a blog
post from a topic idea, data brief, or chart concept.

Common triggers:

- "Let's write this post."
- "Turn this topic into a blog post."
- "Create a post from this data."
- "Draft the article and charts."

Combine this skill with:

- `data-source-scout` for external data discovery
- `blog-topic-scout` for local data-derived ideas
- `data-pipeline` for ingestion/dbt/export work
- `frontend-visualization` for ECharts and CSVs
- `frontend-page` for Eleventy posts and frontmatter
- `image-generation` if a blog card image is needed

## Editorial style

Databearer is a German data-journalism blog. Posts should be factual,
evidence-led, and readable without burying the main point.

Default style:

- German language unless the user asks otherwise.
- Start with a concise key takeaway.
- Make the central claim specific and data-backed.
- Use charts as evidence, not decoration.
- Include source and methodology notes.
- Name caveats clearly instead of hiding uncertainty.
- Avoid overclaiming from one data point.
- Prefer concrete phrasing over generic commentary.

## Frontmatter checklist

Blog posts live in `frontend/src/posts/<year>/`.

Use or preserve this frontmatter shape:

```yaml
---
title: "Post title"
date: YYYY-MM-DD
draft: true
# lastUpdated: YYYY-MM-DD # actual substantive revision, only when applicable
excerpt: "Accurate, concise summary of the key insight and scope."
image: "/images/blog_card_images/<year>/<file>.png"
imageAlt: "" # describe meaningful hero content; empty for decoration
imageText: "Visible image caption"
# socialImage: "/images/blog_card_images/<year>/<social-file>.png"
# socialImageAlt: "Description of the social preview image"
fullWidthCard: false
topic: ["energie"]
---
```

Allowed topics:

- `energie`
- `wirtschaft`
- `politik-und-gesellschaft`

## Post structure

Use boolean `draft: true` while drafting. Inherited computed permalink/collection
rules suppress the page and remove it from collections, sitemap, feeds and search;
do not override those computed fields. A future date is not a draft flag. Check a
full production rebuild to catch stale formerly published HTML. Public utility
pages can use `noindex: true`; `excludeFromSitemap` alone does not prevent indexing.

Titles and excerpts must describe the evidence accurately, without fixed character
quotas or keyword stuffing. Set `lastUpdated` only for a real substantive revision,
never to a build date. Follow the [post QA guide](../../../frontend/docs/post_guidlines.md)
and [SEO contract](../../../docs/seo.md). These practices do not promise rankings.

Image paths must be local `/images/...` files under `frontend/src/images/`.
The responsive helper generates ignored variants and measured raster social
metadata while preserving source images; builds do not fetch remote images.
`imageText` is a visible caption, distinct from `imageAlt`; card images are decorative.

The layout provides the H1 and visible linked author from `site.author`. Body content
should use H2/H3 only and should not duplicate the byline.

Recommended structure:

```markdown
## Concise opening section

Key takeaway and why the data matters now.

## First evidence section

Chart, explanation, source.

## Context section

Comparison, history, or policy relevance.

## Caveat or interpretation section

What the chart does and does not prove.

## Methodik und Datenquellen

Source, grain, transformations, limitations.
```

## Chart requirements

Every chart needs:

- unique `containerId`
- one-sentence takeaway above the chart
- meaningful static HTML evidence (summary or table), including units and period,
  readable without JavaScript; a blank canvas or tooltip is not sufficient
- descriptive, verified source link below the chart
- ECharts loaded once with `defer`, followed by chart scripts with `defer` in dependency
  order; do not use `async` for this dependency chain
- generated JS under `frontend/src/js/charts/<config-name>/`
- matching config under `frontend/src/data_ingestion/charts/`
- CSV input under `frontend/src/data_ingestion/data/`

Use `frontend-visualization` for exact commands and config fields.

## Workflow

1. Confirm the article angle and the exact claim the data supports.
2. Identify required data source(s) and chart(s).
3. Ingest/export data if needed using `data-pipeline`.
4. Create or update chart CSV/config/scripts using `frontend-visualization`.
5. Draft the Markdown post using `frontend-page` conventions.
6. Add descriptively labelled links to relevant topic pages or previous posts.
7. Add a Methodik/Datenquellen section. Verify claims against original sources;
   record unresolved legacy citations rather than inventing URLs, dates or provenance.
8. Run frontend checks from `frontend/`:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

9. Follow the generated SEO output checklist in `docs/seo.md`, running
   `npm run test:seo-output` after the build.
   Inspect errors, chart output, feed impact, and changed files. Preserve published
   JSON Feed item fields, including optional image fields, for the private
   `video-generator` downstream consumer.

## QA checklist

Before considering a post complete:

- Exactly one H1; post body has no H1.
- Excerpt is clear and not clickbait.
- The strongest claim is backed by data shown in the post.
- Every chart has static evidence, units, period and a verified source.
- Caveats are explicit.
- Internal links are relevant and descriptive.
- Hero alt/caption and social metadata match the image; source images are preserved.
- Draft HTML and discovery references are absent after a full production rebuild.
- Frontend tests, lint, build and applicable generated SEO output checks pass.

Completing this workflow does not authorize publication, commits, pushes or deployment.

If data or generated chart files change incidentally, call that out in the
final response.
