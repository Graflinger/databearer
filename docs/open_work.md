# Open work tracker

This file lists every unfinished topic (story, dashboard change, infrastructure or
chore) and links it to its branch and PR. It is an index, not a spec. Details belong
in the PR description or the topic's own `docs/` file.

Maintain it with the `work-tracking` skill (`.opencode/skills/work-tracking/`).
GitHub is the source of truth for PR state. When this file and GitHub disagree,
reconcile this file.

**Last reconciled:** 2026-09-25 (against `gh pr list` and `origin/*`)

## Status values

| Status | Meaning |
| --- | --- |
| `idea` | Worth doing, no branch yet. |
| `in progress` | Branch exists, no PR yet or PR still a draft. |
| `in review` | PR open and ready for review. |
| `blocked` | Waiting on something external. Say what in *Next step*. |
| `awaiting release` | Merged to `main`, not yet promoted to `releases/cloudflare`, so not live. Used only by the `release-promotion` row, which collects all such PRs. |
| `parked` | Deliberately paused. Keep the branch, and say why. |

Remove a topic row when its PR is merged. If the change is public-facing, add the
PR number to `release-promotion`. That row loses the PR once it's live on
`releases/cloudflare`. Also remove a row when the topic is dropped (PR closed
without replacement). The PR and Git history are the permanent record.

## Open topics

Rows are sorted by ID so that parallel branches edit different lines.

| ID | Type | Status | Branch | PR | Docs | Next step |
| --- | --- | --- | --- | --- | --- | --- |
| `battery-storage` | story | in review | `feature/battery-storage-analysis` | [#25](https://github.com/Graflinger/databearer/pull/25) | [battery_storage.md](battery_storage.md) | The draft post is already on `main` but hidden (`eleventyExcludeFromCollections`). Editorial work left: residual outliers, operator-type sensitivity, whether to use a fresh MaStR snapshot, headline/copy, card image. Then remove the draft markers. PR is 35 commits behind `main`. |
| `erneuerbare-wachstum` | story | in review | `feature/dashboard-erneuerbare-wachstum` | [#34](https://github.com/Graflinger/databearer/pull/34) | `docs/erneuerbare_wachstum.md` (on branch) | Review the article `/posts/2026/solar-boomt-wind-waechst/`. Merge `main` in (28 behind), then merge. |
| `netzeingriffe` | story | in review | `feature/dashboard-netzeingriffe-stabilitaet` | [#33](https://github.com/Graflinger/databearer/pull/33) | `docs/netzeingriffe.md` (on branch) | Review the article `/posts/2026/netzeingriffe-netzstabilitaet/`. Merge `main` in (28 behind). Follow-up idea: the documented BNetzA SAIDI route. |
| `open-work-tracker` | chore | in review | `docs/open-work-tracker` | [#43](https://github.com/Graflinger/databearer/pull/43) | this file | Review the tracker format and the `work-tracking` skill, then merge. Not public-facing, so remove this row in the merge commit. |
| `release-promotion` | infra | awaiting release | `main` → `releases/cloudflare` | [#22](https://github.com/Graflinger/databearer/pull/22), [#23](https://github.com/Graflinger/databearer/pull/23), [#26](https://github.com/Graflinger/databearer/pull/26), [#28](https://github.com/Graflinger/databearer/pull/28), [#30](https://github.com/Graflinger/databearer/pull/30), [#35](https://github.com/Graflinger/databearer/pull/35), [#37](https://github.com/Graflinger/databearer/pull/37), [#39](https://github.com/Graflinger/databearer/pull/39), [#41](https://github.com/Graflinger/databearer/pull/41), [#42](https://github.com/Graflinger/databearer/pull/42) | [dashboard publication](dashboard_publication.md), [partial refresh](dashboard_partial_refresh.md) | No manual promotion since 2026-09-11. Every merged PR listed here is on `main` only, and the release only gets bot data commits. Includes release-first (#26) and partial refresh (#39), which still need deliberate promotion plus live acceptance. Promote by the runbook (no force), check the live data/HTML and the next 06:00 UTC run, then empty this row. |
| `strom-ytd` | story | in review | `feature/dashboard-strom-ytd` | [#31](https://github.com/Graflinger/databearer/pull/31) | `docs/strom_ytd.md` (on branch) | Review the article `/posts/2026/strom-2026-ytd-zahlen/`. The January–September 9 window is time-sensitive, so decide soon whether to publish as-is or refresh. Merge `main` in (28 behind). |
| `stromhandel` | story | in review | `feature/dashboard-stromhandel-jahre` | [#32](https://github.com/Graflinger/databearer/pull/32) | `docs/stromhandel_post.md` (on branch) | Review the article `/posts/2026/stromimporte-exporte-deutschland/`. Merge `main` in (28 behind), then merge. |

## Ideas without a branch

Add `idea` rows to the table above, or list rough ideas here until they get an ID.

- *(none yet)*

## Branch cleanup candidates

These are local-only branches (no `origin/` counterpart). Most probably
belong to posts that were already published through squash merges. Check each one,
then delete it, or add a topic row if work remains.

| Branch | Last commit | Note |
| --- | --- | --- |
| `bugfix/fixing_wrong_windengergy_awarded_calculation` | 2026-01-16 | Wind tender average fix. Check whether `main` already has it. |
| `chore/migrate-claude-to-agents` | 2026-06-09 | Likely superseded by the current `.opencode/` setup. |
| `feature/Industirepolitik` | 2025-12-11 | `Industriepolitik.md` is published. |
| `feature/dunkelflaute_der_atomkraft` | 2025-07-05 | No commits beyond `main`. |
| `feature/eeg_anteil` | 2025-07-09 | Check whether the EEG share models are needed. |
| `feature/eeg_anteil_article` | 2025-07-09 | Check whether the EEG article is published. |
| `feature/generationsgerechtigkeit` | 2025-05-27 | No commits beyond `main`. |
| `feature/germany-batteries-mastr` | 2026-06-29 | Early battery work, likely superseded by `battery-storage`. |
| `feature/opencode-tooling` | 2026-06-09 | Likely superseded. |
| `feature/windkrafauschreibungen2025` | 2025-12-12 | Post published. |
| `feature/windkraft_gebotswerte` | 2026-01-15 | Check whether `Windenergiezukunft.md` covers it. |
| `feature/windkraftauschreibungen2` | 2025-06-25 | No commits beyond `main`. |
| `release/dashboard-production` | 2026-09-10 | Old release branch name. Production is now `releases/cloudflare`. |

Remote branches whose PRs are already merged (for example
`feature/first_dashboard`, `feature/cleanup`, `feature/dashboard-partial-refresh`,
`feature/seo-hardening`, `feature/dashboard-quiet-text`) can be deleted on GitHub.
Their unreleased changes are tracked in `release-promotion`, not in the branches.
