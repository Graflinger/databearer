---
name: social-copy-prep
description: Use when preparing manual LinkedIn, X, or Bluesky copy for a finished Databearer blog post. This skill does not post automatically.
compatibility: opencode
metadata:
  project: databearer
  area: social
---

# Databearer social copy preparation skill

## When to use this skill

Use this skill when the user asks to promote a finished post or generate social
copy for LinkedIn, X, or Bluesky.

Common triggers:

- "Promote this post."
- "Generate social copy."
- "Prepare a Bluesky post."
- "Create LinkedIn/X versions."

## Boundary

This skill prepares copy only. It must not attempt to post, automate browser
actions, call social APIs, or handle platform secrets. The user manually copies
the final text into each platform.

## Helper script

Generate social copy:

```bash
python scripts/social/generate_social_copy.py --latest
python scripts/social/generate_social_copy.py --post frontend/src/posts/2026/example.md --json
```

There are intentionally no posting scripts and no platform secret files for
social media automation.

## Platform tone

LinkedIn:

- slightly longer and explanatory
- mention the data source or concrete finding
- suitable for professional network context
- include the post URL

X:

- short, direct, under 280 characters
- one key finding only
- include the post URL

Bluesky:

- conversational and concise, under 300 characters
- one finding plus URL
- avoid too many hashtags

## Workflow

1. Identify the post, usually the latest post from `frontend/src/posts/`.
2. Read title, excerpt, topics, image text, and URL.
3. Generate platform-specific drafts.
4. Show the drafts to the user.
5. Ask whether the user wants edits, a shorter variant, or a thread version.
6. Make clear that the final copy is for manual posting.

## Output format

When previewing, use:

```markdown
## LinkedIn

...

## X

...

## Bluesky

...

## Alt Text

...
```

Keep claims aligned with the post. Do not invent additional facts, numbers, or
sources that are not in the article.
