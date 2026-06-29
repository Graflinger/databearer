from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
POSTS_ROOT = REPO_ROOT / "frontend" / "src" / "posts"
DEFAULT_SITE_URL = "https://blog.databearer.de"


@dataclass(frozen=True)
class BlogPost:
    path: Path
    title: str
    date: str
    excerpt: str
    image: str
    image_text: str
    topics: list[str]
    url_path: str

    def absolute_url(self, site_url: str = DEFAULT_SITE_URL) -> str:
        return f"{site_url.rstrip('/')}{self.url_path}"


def parse_frontmatter(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text

    end_index = None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_index = index
            break

    if end_index is None:
        return {}, text

    data: dict[str, Any] = {}
    for line in lines[1:end_index]:
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        data[key.strip()] = _parse_value(raw_value.strip())

    return data, "\n".join(lines[end_index + 1 :])


def discover_posts(posts_root: Path = POSTS_ROOT) -> list[BlogPost]:
    if not posts_root.exists():
        return []

    posts = []
    for path in posts_root.glob("**/*.md"):
        data, _ = parse_frontmatter(path)
        if not data.get("title"):
            continue
        posts.append(
            BlogPost(
                path=path,
                title=str(data.get("title", "")),
                date=str(data.get("date", "")),
                excerpt=str(data.get("excerpt", "")),
                image=str(data.get("image", "")),
                image_text=str(data.get("imageText", "")),
                topics=_as_string_list(data.get("topic", [])),
                url_path=_post_url_path(path, posts_root),
            )
        )

    return sorted(posts, key=lambda post: (post.date, post.path.name), reverse=True)


def latest_post(posts_root: Path = POSTS_ROOT) -> BlogPost:
    posts = discover_posts(posts_root)
    if not posts:
        raise FileNotFoundError(f"No posts found under {posts_root}")
    return posts[0]


def _parse_value(raw_value: str) -> Any:
    if raw_value.startswith("[") and raw_value.endswith("]"):
        inner = raw_value[1:-1].strip()
        if not inner:
            return []
        return [_strip_quotes(item.strip()) for item in inner.split(",")]

    if raw_value.lower() == "true":
        return True
    if raw_value.lower() == "false":
        return False
    return _strip_quotes(raw_value)


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def _as_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if value:
        return [str(value)]
    return []


def _post_url_path(path: Path, posts_root: Path) -> str:
    relative = path.relative_to(posts_root)
    year = relative.parts[0]
    slug = relative.stem
    return f"/posts/{year}/{slug}/"
