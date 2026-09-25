---
name: work-tracking
description: Use when creating a new branch, opening/updating/merging/closing a PR, starting a new story or topic, promoting main to releases/cloudflare, or when the user asks what is open or unfinished. Keeps docs/open_work.md in sync, linking topic IDs to branches and PRs, and removes finished topics.
compatibility: opencode
metadata:
  project: databearer
  area: workflow
---

# Databearer work-tracking skill

`docs/open_work.md` is the single overview of unfinished work. Each row links one
**topic ID** to its branch, PR, docs and next step. GitHub is the source of truth
for PR state. The tracker adds what GitHub doesn't show: the topic, whether it is
live yet, and what happens next.

## Relationship model

- **Topic** (stable kebab-case ID, e.g. `strom-ytd`): the unit of work. It is
  unfinished until it is done (see below).
- **Branch**: normally one per topic. Prefer `feature/<id>`, `fix/<id>`,
  `docs/<id>` or `chore/<id>` for new branches. Existing branches keep their names,
  and the row records the mapping.
- **PR**: normally one per branch. A topic may have several PRs over time
  (e.g. article PR, then data-refresh PR). List them all in the PR cell.
- Put the line `Tracker: \`<id>\`` in every PR description so PR → topic can be
  found by searching.

Not tracked: automated dashboard refresh commits, `dashboard-sync` merges and
bot pushes. Those are handled by the publication workflow.

## Always reconcile first

Before any tracker edit, compare the file with reality:

```bash
git fetch --prune
gh pr list --state open --json number,title,headRefName,isDraft,updatedAt
gh pr list --state merged --limit 15 --json number,headRefName,mergedAt
gh pr list --state closed --limit 15 --json number,headRefName,state
git log --no-merges --oneline origin/releases/cloudflare..origin/main | grep -v 'data: refresh'
```

Then fix drift:

- An open PR has no row → add a row.
- A row's PR is merged:
  - it changes the public site (anything under `frontend/`, or public data, or the
    released workflow/scripts) and the commit isn't on `releases/cloudflare` yet →
    remove the topic row and add the PR number to the `release-promotion` row;
  - otherwise → remove the row.
- A merged PR is missing from `release-promotion` although
  `git merge-base --is-ancestor <merge-sha> origin/releases/cloudflare` fails →
  add it.
- A row's PR was closed without merging → remove the row, or set `parked` with the
  reason if the topic continues.
- Update the "behind main" and review notes in *Next step* only if they matter.
- Update **Last reconciled** to today's date.

## When creating a branch

1. Reconcile (above).
2. Check whether the work belongs to an existing topic. If it does, add the branch to that
   row instead of making a new one.
3. Otherwise, add a row in ID-sorted position: type (`story`, `dashboard`, `infra`,
   `pipeline`, `chore`, `docs`), status `in progress`, branch name, PR `—`, docs,
   and a concrete next step.
4. Commit the tracker change **on the new branch**, together with the first work
   commit. Don't touch `main` directly.

## When opening or updating a PR

1. Set PR to the linked number, and status to `in review` (or keep
   `in progress` for draft PRs).
2. Put `Tracker: \`<id>\`` in the PR body.
3. Keep *Next step* short and actionable: what the reviewer or author must do next.
   Put details in the PR body or the topic's `docs/` file, not in the tracker.

## When merging, promoting or closing

- Merge: remove the topic row as part of the PR's final commit. If the change is
  public-facing, add the PR number to the single `release-promotion` row
  (status `awaiting release`) instead of keeping a separate row.
- Promotion to `releases/cloudflare` (manual promotion, see
  `docs/dashboard_publication.md`): after checking the live site, remove every
  PR from `release-promotion` that is now an ancestor of `origin/releases/cloudflare`.
  Keep the row with PR `—` and next step "Nothing pending" when it's empty.
- Closed/abandoned: remove, or `parked` with the reason.
- If follow-up work was identified (e.g. "SAIDI data for grid article"),
  add it as a new `idea` row or an entry under *Ideas without a branch*.
  Don't leave it buried in a merged PR.

## Merge conflicts in the tracker

Parallel branches will edit `docs/open_work.md`. Keep rows sorted by ID and one
row per line so that conflicts stay trivial. When resolving: keep the union of
rows, then reconcile against GitHub again. Never drop another topic's row during
conflict resolution.

## Answering "what's open?"

Reconcile, then summarise the table grouped by status. Mention anything that
is `awaiting release` (merged but not live) and anything stale (no update for
more than 2 weeks, or far behind `main`).

## Guardrails

- Tracker edits never authorize commits, pushes, merges or promotion. Follow the
  normal rule: commit and push only when the user asks.
- Never mark something done because it is merged if it isn't live yet.
- Keep the file compact. If a row needs more than 2–3 sentences, the detail
  belongs in a `docs/` file or the PR.
