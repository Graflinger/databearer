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
- `work-tracking` when creating the post's branch or PR, so that the topic appears
  in `docs/open_work.md`

## Editorial style

Databearer is a German data-journalism blog. Posts should be factual,
evidence-led, and readable without burying the main point.

Default style:

- German language unless the user asks otherwise.
- Start with a concise key takeaway.
- Make the central claim specific and data-backed.
- Use charts as evidence, not decoration.
- Include sources and a short data note (see below).
- Name caveats clearly instead of hiding uncertainty.
- Avoid overclaiming from one data point.
- Prefer concrete phrasing over generic commentary.

### Voice: one author

Databearer is written by one person. Never suggest a team:

- No author "wir"/"uns"/"unser" for the author's own work: not "unsere
  Auswertung", "wir haben gefiltert", "wir rechnen nicht hoch", "wie wir bereits
  beschrieben haben".
- Prefer impersonal phrasing ("Die Auswertung zeigt…", "Nicht berücksichtigt
  sind…", "Hochgerechnet wird nicht"). Use "ich"/"mein" sparingly where a personal
  choice or opinion is meant ("Ich rechne das Jahr bewusst nicht hoch").
- Inclusive reader "wir" ("Schauen wir auf…") and collective "unsere Industrie"
  (Germany/society) are acceptable but use them sparingly.

### Keep the methodology short

Readers come for the finding, not the pipeline. Unless the user explicitly asks
for a detailed methodology:

- End with a short **"Daten und Quellen"** section: one or two short paragraphs
  on source, date/period, what was included or left out (e.g. implausible outliers
  removed) and what that means for interpretation, then the source/licence list.
- Put caveats needed to read a chart correctly next to that chart, once, in plain
  words. Do not repeat them in several sections.
- No filter thresholds, row counts, exclusion percentages, file names, hashes,
  model names, request budgets or tooling in the article. That detail belongs in
  the topic's `docs/` file.

### Third-party methods

Do not name, link or cite another project's methodology (thresholds, size classes,
corrections, dashboards) unless its **data** is used or the user asks for it.
Describe your own, simplified approach in your own words. Credit only the sources
whose data appears in the post.

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
imageText: "Visible image caption (KI-generiert)"
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
  Every article image is AI-generated, so the visible caption `imageText` ends with
  ` (KI-generiert)`: "Große Speicher prägen den Batterieausbau (KI-generiert)". No
  "KI-generiertes Symbolbild:" prefix and no period before the parenthesis.
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

## Daten und Quellen

1–2 short paragraphs: source, date, what was left out and why it matters.
Then a source list with licences. Details stay in docs/.
```

## Chart requirements

Every chart needs a unique `containerId`, a one-sentence takeaway, the accessible
container pattern (`role="img"`, `aria-labelledby` → heading, `aria-describedby` → a
`chart-description` longer than 40 characters), static values or a captioned table,
and a verified source link. Load ECharts once and give every script `defer`. Each
chart needs a CSV under `frontend/src/data_ingestion/data/<article-year>/<topic>/`
(with supporting aggregates and the validated provenance manifest in the same
folder), a config in `frontend/src/data_ingestion/charts/`, and generated JS under
`frontend/src/js/charts/<config-name>/`. See
[Charts and evidence](../../../docs/seo.md#charts-and-evidence).

Tables outside a `.chart-section` put their source and footnotes (rounding,
definitions, exclusions) directly below the table as
`<p class="table-note"><strong>Quelle:</strong> <a href="…">…</a>; …</p>`. It renders
smaller and muted so it visibly belongs to the table. Use HTML inside it, not
Markdown. Never format a table source as a normal body paragraph.

Use `frontend-visualization` for exact commands, config fields and the **Organize a
frozen data entity** workflow. Use the article year even when data spans many years;
keep frozen article evidence separate from live dashboard snapshots. A refresh must
update chart inputs, provenance, article numbers/dates and tests together.

## Workflow

1. Confirm the article angle and the exact claim the data supports.
2. Identify required data source(s) and chart(s).
3. Ingest/export data if needed using `data-pipeline`.
4. Create or update chart CSV/config/scripts using `frontend-visualization`.
5. Draft the Markdown post using `frontend-page` conventions.
6. Add descriptively labelled links to relevant topic pages or previous posts.
7. Add a short "Daten und Quellen" section (see *Keep the methodology short*).
   Verify claims against original sources; record unresolved legacy citations
   rather than inventing URLs, dates or provenance.
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
- Caveats are explicit, stated once and in plain words.
- No author "wir"/"unser" for the author's own work; one-author voice.
- The data/methodology section is short; technical detail lives in `docs/`.
- No other project's methodology is named or linked unless its data is used.
- Internal links are relevant and descriptive.
- Hero/social alt describes the image; the caption is `imageText` and ends with
  ` (KI-generiert)`.
- Drafting-only flags are removed when publishing.
- Frontend tests, lint, build and `npm run test:seo-output` pass.

Completing this workflow does not authorize publication, commits, pushes or deployment.

If data or generated chart files change incidentally, call that out in the
final response.
