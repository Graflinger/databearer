#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.blog_posts import DEFAULT_SITE_URL, BlogPost, latest_post, parse_frontmatter


HASHTAGS = {
    "energie": ["#Energiewende", "#Erneuerbare"],
    "wirtschaft": ["#Wirtschaft", "#Daten"],
    "politik-und-gesellschaft": ["#Politik", "#Gesellschaft"],
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate social copy for a Databearer post.")
    parser.add_argument("--latest", action="store_true", help="Use the latest post.")
    parser.add_argument("--post", help="Path to a specific post Markdown file.")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help="Base site URL.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    if args.post:
        post = post_from_path(Path(args.post))
    else:
        post = latest_post()

    payload = generate_copy(post, site_url=args.site_url)
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(format_markdown(payload))
    return 0


def post_from_path(path: Path) -> BlogPost:
    path = path if path.is_absolute() else REPO_ROOT / path
    data, _ = parse_frontmatter(path)
    posts_root = REPO_ROOT / "frontend" / "src" / "posts"
    relative = path.relative_to(posts_root)
    url_path = f"/posts/{relative.parts[0]}/{relative.stem}/"
    return BlogPost(
        path=path,
        title=str(data.get("title", "")),
        date=str(data.get("date", "")),
        excerpt=str(data.get("excerpt", "")),
        image=str(data.get("image", "")),
        image_text=str(data.get("imageText", "")),
        topics=[str(item) for item in data.get("topic", [])],
        url_path=url_path,
    )


def generate_copy(post: BlogPost, site_url: str = DEFAULT_SITE_URL) -> dict:
    url = post.absolute_url(site_url)
    tags = topic_hashtags(post.topics)
    linkedin = (
        f"Neu auf Databearer: {post.title}\n\n"
        f"{post.excerpt}\n\n"
        f"Ich ordne die Daten ein, zeige die wichtigsten Entwicklungen in Grafiken und benenne die Grenzen der Interpretation.\n\n"
        f"Zum Beitrag: {url}\n\n"
        f"{' '.join(tags[:3])}"
    ).strip()
    x = fit_to_limit(f"Neu im Blog: {post.title}\n\n{post.excerpt}\n\n{url}", 280)
    bluesky = fit_to_limit(f"Neu auf Databearer: {post.title}\n\n{post.excerpt}\n\n{url}", 300)
    return {
        "post": {
            "title": post.title,
            "date": post.date,
            "url": url,
            "path": str(post.path.relative_to(REPO_ROOT)),
            "topics": post.topics,
            "image": post.image,
            "image_text": post.image_text,
        },
        "platforms": {
            "linkedin": linkedin,
            "x": x,
            "bluesky": bluesky,
        },
        "alt_text": post.image_text or post.title,
    }


def topic_hashtags(topics: list[str]) -> list[str]:
    tags: list[str] = []
    for topic in topics:
        for tag in HASHTAGS.get(topic, []):
            if tag not in tags:
                tags.append(tag)
    return tags


def fit_to_limit(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    marker = "\n\n"
    prefix, _, url = text.rpartition(marker)
    available = limit - len(marker) - len(url) - 1
    shortened = prefix[:available].rstrip()
    if " " in shortened:
        shortened = shortened.rsplit(" ", 1)[0]
    shortened = shortened.rstrip(".,;:!?")
    return f"{shortened}...{marker}{url}"


def format_markdown(payload: dict) -> str:
    return "\n\n".join(
        [
            "## LinkedIn\n\n" + payload["platforms"]["linkedin"],
            "## X\n\n" + payload["platforms"]["x"],
            "## Bluesky\n\n" + payload["platforms"]["bluesky"],
            "## Alt Text\n\n" + payload["alt_text"],
        ]
    )


if __name__ == "__main__":
    raise SystemExit(main())
