#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.blog_posts import DEFAULT_SITE_URL, latest_post


def main() -> int:
    parser = argparse.ArgumentParser(description="Print metadata for the latest Databearer blog post.")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help="Base site URL.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    post = latest_post()
    payload = {
        "title": post.title,
        "date": post.date,
        "excerpt": post.excerpt,
        "image": post.image,
        "image_text": post.image_text,
        "topics": post.topics,
        "path": str(post.path.relative_to(REPO_ROOT)),
        "url": post.absolute_url(args.site_url),
    }
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(
            "\n".join(
                [
                    f"Title: {payload['title']}",
                    f"Date: {payload['date']}",
                    f"URL: {payload['url']}",
                    f"Topics: {', '.join(payload['topics'])}",
                    f"Excerpt: {payload['excerpt']}",
                    f"Path: {payload['path']}",
                ]
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
