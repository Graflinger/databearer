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
draft: true # remove when publishing
# lastUpdated: YYYY-MM-DD # real substantive revision only
excerpt: "Key finding first, 1–2 plain-text sentences, no draft labels."
image: "/images/blog_card_images/<year>/<file>.png"
imageAlt: "" # describe informative heroes; empty if decorative
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

[`docs/seo.md`](../../../docs/seo.md) is the single detailed contract. Key points:

- `draft: true` keeps the post out of all output in every run mode. When publishing,
  remove it together with any drafting-only exclusions
  ([Drafts](../../../docs/seo.md#drafts)).
- The `excerpt` becomes the meta description, card text, search excerpt and feed
  summary. Titles carry no brand suffix. Corrections set `lastUpdated` and add a
  visible `*Korrektur vom …*` note
  ([Content guidance](../../../docs/seo.md#content-guidance)).
- Images must be local `/images/...` files. `imageAlt`/`socialImageAlt` describe the
  image, and `imageText` is the caption ([Images](../../../docs/seo.md#images)).
- The layout renders the H1 and byline, so the body uses H2/H3 only. Internal links
  use `/posts/<year>/<slug>/`.

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

Every chart needs a one-sentence takeaway, the accessible container pattern
(`role="img"`, `aria-labelledby` → heading, `aria-describedby` → a
`chart-description` longer than 40 characters), static values or a captioned table,
and a verified source link. Load ECharts once and give every script `defer`. Each
chart needs a CSV in `frontend/src/data_ingestion/data/`, a config in
`frontend/src/data_ingestion/charts/`, and generated JS under
`frontend/src/js/charts/<config-name>/`. See
[Charts and evidence](../../../docs/seo.md#charts-and-evidence).

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
8. Run the [checks](../../../docs/seo.md#checks) from `frontend/`:
   `npm test -- --runInBand`, `npm run lint`, `npm run build`,
   `npm run test:seo-output`.
9. Inspect errors, chart output, feed impact and changed files. Keep the
   [JSON Feed fields](../../../docs/seo.md#feeds) used by the private
   `video-generator` unchanged.

## QA checklist

Before considering a post complete:

- Exactly one H1; post body has no H1.
- Excerpt is plain text, key finding first, not clickbait, no draft labels.
- The strongest claim is backed by data shown in the post.
- Every chart has static evidence, units, period and a verified source.
- Caveats are explicit.
- Internal links are relevant and descriptive.
- Hero/social alt describes the image; the caption is `imageText`.
- Drafting-only flags are removed when publishing.
- Frontend tests, lint, build and `npm run test:seo-output` pass.

Completing this workflow does not authorize publication, commits, pushes or deployment.

If data or generated chart files change incidentally, call that out in the
final response.
