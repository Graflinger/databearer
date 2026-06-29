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
lastUpdated: YYYY-MM-DD
excerpt: "140-160 character summary of the key insight."
image: "/images/blog_card_images/<year>/<file>.png"
imageText: "Short descriptive image caption"
fullWidthCard: false
topic: ["energie"]
---
```

Allowed topics:

- `energie`
- `wirtschaft`
- `politik-und-gesellschaft`

## Post structure

The layout provides the H1. Body content should use H2/H3 only.

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
- source link below the chart
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
6. Add internal links to relevant topic pages or previous posts.
7. Add a Methodik/Datenquellen section.
8. Run frontend build from `frontend/`:

```bash
npm run build
```

9. Inspect errors, chart output, feed impact, and changed files.

## QA checklist

Before considering a post complete:

- Exactly one H1; post body has no H1.
- Excerpt is clear and not clickbait.
- The strongest claim is backed by data shown in the post.
- Every chart has a source.
- Caveats are explicit.
- Internal links are relevant.
- `npm run build` passes.

If data or generated chart files change incidentally, call that out in the
final response.
