# Weekly release promotion

Every Sunday, `.github/workflows/promote-release.yml` publishes everything that is
on `main` to production (`releases/cloudflare`, built by Cloudflare Pages).
**`main` is the queue for the next publication.** Merging a PR into `main`
schedules it for the next Sunday. Work that must not go live stays hidden with
`draft: true` ([Drafts](seo.md#drafts)) or remains on its branch.

This replaces the manual fast-forward of `releases/cloudflare` for normal blog and
code changes. The daily data refresh in
[dashboard publication](dashboard_publication.md) is unchanged.

## Schedule and SEO

- Cron `17 4 * * 0`: Sunday 04:17 UTC (06:17 CEST / 05:17 CET). The odd minute
  avoids GitHub's busiest full-hour slots. GitHub starts scheduled runs late,
  sometimes by hours (the 06:00 UTC dashboard refresh has started between roughly
  11:00 and 13:00 UTC). An early slot keeps publication on Sunday morning anyway.
- Weekday and hour have no direct ranking effect. What matters is a steady rhythm
  and a truthful publication date: `date` is used for `datePublished`, both feeds
  and sorting.
- **Set a post's `date` to the Sunday it will be published.** The run fails if a
  newly published post has a date after today (Europe/Berlin) and warns if the date
  is more than seven days old.

## What a run does

The run uses the **released** scripts from `releases/cloudflare`, as the dashboard
refresh does. Steps, each of which must succeed before the next starts:

1. **Guard:** publishing runs only from the `main` event ref (the schedule always is).
2. **Candidate:** `scripts/dashboard_sync.py prepare` creates a worktree from
   current `main` and merges the exact release with real ancestry if `main` lacks
   newer release data commits. Conflicts stop the run; nothing is resolved
   automatically. If production already contains `main`, the run ends green.
3. **Token check:** `scripts/release_promotion.py check` rejects candidates that
   change `.github/workflows/` (see *Manual promotion* below).
4. **Offline validation of the candidate:** electricity pipeline and script tests,
   then `npm ci`, `npm test`, `npm run lint`, `npm run build` and
   `npm run test:seo-output`. No live source data is fetched.
5. **Plan:** `release_promotion.py plan` compares the candidate's built
   `/feed.json` with the public feed. Drafts never reach the feed, so every new item
   is a post this run publishes. It checks their dates and writes the job summary.
6. **Push main, then release, never with force:** `dashboard_sync.py publish`
   pushes the candidate to `main` if it is a new merge. `release_promotion.py push`
   then requires that `origin/main` equals the candidate and that release has not
   moved, and fast-forwards `releases/cloudflare`. A moved branch stops the run.
7. **Public verification:** `release_promotion.py verify` polls for up to 600 s
   until every new post is in the public feed and its page returns HTTP 200. With
   no new posts it checks only that the home page is reachable.

Manual dispatch defaults to `promote=false`: steps 1–5 run as a dry run and report
what the next promotion would publish. Use `promote=true` on `main` to publish
immediately, for example after fixing a failed Sunday run.

## Concurrency

The workflow shares the concurrency group `electricity-dashboard-publication` with
the dashboard refresh, so only one run moves production at a time. GitHub keeps at
most one *pending* run per group: if a third run queues while one runs and one
waits, the waiting run is cancelled. On a weekly/daily cadence this is unlikely;
rerun manually if it happens.

## Manual promotion is still needed for

- **Workflow files.** A `GITHUB_TOKEN` push cannot create or update files in
  `.github/workflows/`. While `main` contains such changes, Sunday runs fail at the
  token check. Promote them as before: incorporate the latest release ancestry into
  reviewed `main`, then fast-forward `releases/cloudflare` without force, using your
  own credentials. The next Sunday run continues automatically.
- **This feature's own rollout**, for the same reason, and because the released
  scripts must exist on `releases/cloudflare` before the schedule can use them.

## Failure and recovery

| Failure | State | What to do |
| --- | --- | --- |
| Sync conflict, validation, date or token check | Nothing pushed | Fix on `main` (set `draft: true`, correct `date`, resolve the conflict, or promote workflow changes manually), then dispatch with `promote=true` or wait for Sunday. |
| `main` pushed, release push rejected (branch moved) | `main` contains the merge; production unchanged | Rerun; the next candidate starts from the new tips. |
| Public verification timed out | Production branch points at the candidate | Inspect the Cloudflare Pages build and retry it. Do not force-push or revert. |

A green run means the new posts are publicly reachable. A Git push alone is not
proof of deployment.

## Authoring rule of thumb

- Merge finished posts into `main` with `date` set to the coming Sunday.
- Merge unfinished posts only with `draft: true`, or keep them on their branch.
- Removing `draft: true` publishes the post on the next Sunday; set `date` again.
