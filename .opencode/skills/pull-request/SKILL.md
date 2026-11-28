---
name: pull-request
description: Use before writing or editing any pull request title, description, comment or review in the public databearer repository, and when committing. PR text must never contain source data, figures or findings derived from it.
compatibility: opencode
metadata:
  project: databearer
  area: workflow
---

# Databearer pull request skill

The repository and every pull request are **public**. PR titles, descriptions,
comments, reviews and commit messages are not a place where source data can be
cited correctly: they carry no licence notice, no attribution line, no retrieval
date and no "own calculation" marker next to the numbers, and old versions stay
visible in GitHub's edit history. Some sources also allow no redistribution at all.

Data therefore appears only where it is cited properly: in the article, in the
frozen data entity with its manifest, and in the topic's `docs/` file. The PR only
points there.

Use this skill together with `work-tracking` (tracker line, open-work row).

## Rule: no data in PR text

Never write any of the following into a PR title, description, comment, review
(including inline review comments) or commit message, even for openly licensed
sources:

- Values, shares, rates, changes, rankings, minima/maxima or other figures taken
  from a source or calculated from it ("36,18 ct/kWh", "+21 %", "Platz 2 von 27").
- Key findings or story claims phrased with numbers. Describe the article's
  **topic**, not its results.
- Record or interval counts, observation periods tied to findings, or comparisons
  with figures from other publishers.
- Tables, excerpts, quotes or paraphrased passages of source data, press releases,
  terms of use or third-party texts.
- Charts, screenshots or images showing data.
- Licence matrices with verdicts per source. They belong in the topic's `docs/`
  file and the manifest, where the full context is.

Allowed:

- What changed technically: files and folders, number of charts, exporter,
  validator, tests, tracker changes.
- Publisher names of the sources used, and that the licence check was done, with a
  link to the topic doc in the repository.
- Check results that are not about source data: test, lint, build and SEO output
  counts, browser checks.
- Open items, draft status and what the reviewer must decide.
- The Cloudflare preview URL; reviewers read the numbers in the rendered article.

If a reviewer needs a number to decide something, ask them to look at the preview
or the `docs/` file instead of quoting it. If a source cannot be redistributed at
all, mention it in PR text only as "nicht verwendet" without any figures.

## Description template

Write in German, keep it short:

```markdown
## Zusammenfassung

Tracker: `<topic-id>`

Artikelentwurf `frontend/src/posts/<year>/<slug>.md` (`draft: true`) zum Thema
<topic in one sentence, no figures>. <n> Charts mit statischen Tabellen,
eingefrorener Datensatz unter `frontend/src/data_ingestion/data/<year>/<topic>/`
mit Manifest, Exporter und Build-Validierung.

## Quellen und Lizenz

Verwendete Quellen: <publisher names>. Lizenzprüfung, Namensnennung, Datenstand,
Methodik und Grenzen: `docs/<topic>.md` und `manifest.json`. Diese Beschreibung
enthält bewusst keine Daten oder Kennzahlen.

## Prüfungen

- [x] `npm test -- --runInBand`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:seo-output`

## Offen vor Veröffentlichung

- [ ] Redaktionelle Freigabe; bis dahin `draft: true`.
```

## Before creating or editing a PR

1. Draft the title and body, then scan them: no digits other than test counts,
   PR/issue numbers, dates of the work itself and file paths. Remove any findings.
2. Look for a PR template (`.github/pull_request_template.md` or
   `.github/PULL_REQUEST_TEMPLATE/`) and keep its sections, applying this rule.
3. Pass the body via a file (`gh pr create --body-file`, `gh pr edit --body-file`),
   not inline shell strings.
4. Report the full findings to the user in the chat, not in the PR.

## Cleaning up a PR that already contains data

1. Replace the body with a clean version (`gh pr edit <n> --body-file`).
2. Also edit or delete comments and reviews that contain data.
3. GitHub keeps every previous version in the edit history, and there is no API to
   delete it. Tell the user to remove old revisions in the web UI: on the PR body
   or comment, open **edited** → select each revision → **Delete revision from
   history**. Notification emails that were already sent cannot be recalled.
4. Commit messages already pushed can only be changed by rewriting history; never
   force-push without the user's explicit agreement.

## Guardrails

- Writing or editing a PR does not authorize merging, promotion or deployment.
- This rule applies to every PR, including chore and dashboard PRs and PRs written
  by subagents. Include it in prompts when delegating PR work.
