#!/usr/bin/env python3
"""Weekly promotion of reviewed main to production (`releases/cloudflare`).

Run every command from the released checkout root (branch releases/cloudflare at
the exact release SHA), after `dashboard_sync.py prepare` built the candidate:

  python3 scripts/release_promotion.py check --release SHA --candidate SHA
  python3 scripts/release_promotion.py plan --candidate SHA --feed BUILT_FEED --out ABS_JSON
  python3 scripts/release_promotion.py push --release SHA --candidate SHA
  python3 scripts/release_promotion.py verify --plan ABS_JSON

`check` rejects candidates that change workflow files (a GITHUB_TOKEN push cannot
update them; promote those manually). `plan` compares the candidate's built JSON
Feed with the public feed: drafts never reach the feed, so every new item is a
post this promotion publishes. Its date must not be in the future (Europe/Berlin)
and should be the publication day. `push` fast-forwards release to the candidate
that sync already pushed to main, without force. `verify` polls the public site.
See docs/release_promotion.md.
"""

import argparse
from datetime import date, datetime, timedelta
from http.client import HTTPException
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from zoneinfo import ZoneInfo


RELEASE_BRANCH = "releases/cloudflare"
DEFAULT_BASE_URL = "https://blog.databearer.de"
BERLIN = ZoneInfo("Europe/Berlin")
STALE_DAYS = 7
MAX_BYTES = 10_000_000
HTTP_TIMEOUT = 15
WORKFLOWS = ".github/workflows"


class PromotionError(RuntimeError):
    """Stop the promotion without touching production."""


def require(condition, message):
    if not condition:
        raise PromotionError(message)


# --- Git -------------------------------------------------------------------

def git(repo, *args, allowed=(0,), config=()):
    overrides = [item for setting in config for item in ("-c", setting)]
    result = subprocess.run(["git", "--no-replace-objects", *overrides, *args], cwd=repo,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    # Never echo stderr: remote diagnostics can contain credential URLs.
    require(result.returncode in allowed, f"git {args[0]} failed (exit {result.returncode})")
    return result


def text(repo, *args):
    return git(repo, *args).stdout.decode("utf-8").strip()


def commit(repo, ref):
    return text(repo, "rev-parse", "--verify", f"{ref}^{{commit}}")


def full_sha(value):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", value),
            "Expected a full lowercase commit SHA")
    return value


def ancestor(repo, older, newer):
    return git(repo, "merge-base", "--is-ancestor", older, newer, allowed=(0, 1)).returncode == 0


def released_checkout(release, repo=None):
    repo = Path(repo or Path.cwd()).resolve()
    require(Path(text(repo, "rev-parse", "--show-toplevel")).resolve() == repo,
            "Run from the released checkout root")
    require(text(repo, "symbolic-ref", "--quiet", "HEAD") == f"refs/heads/{RELEASE_BRANCH}",
            "Expected the release branch checkout")
    require(commit(repo, "HEAD") == release, "Released checkout HEAD differs from release SHA")
    return repo


def fetch_refs(repo):
    git(repo, "fetch", "--atomic", "--no-tags", "origin",
        "refs/heads/main:refs/remotes/origin/main",
        f"refs/heads/{RELEASE_BRANCH}:refs/remotes/origin/{RELEASE_BRANCH}")
    return commit(repo, "refs/remotes/origin/main"), commit(repo, f"refs/remotes/origin/{RELEASE_BRANCH}")


def workflow_changes(repo, release, candidate):
    raw = git(repo, "diff", "--name-only", "-z", release, candidate, "--", WORKFLOWS).stdout
    return [name.decode("utf-8") for name in raw.split(b"\0") if name]


def check_candidate(repo, release, candidate):
    require(ancestor(repo, release, candidate),
            "Candidate does not contain the current release; nothing is pushed")
    changed = workflow_changes(repo, release, candidate)
    require(not changed,
            "main changes workflow files that a GITHUB_TOKEN push cannot publish: "
            + ", ".join(changed) + ". Promote this change manually (docs/release_promotion.md)")


def check(release, candidate, repo=None):
    release, candidate = full_sha(release), full_sha(candidate)
    repo = released_checkout(release, repo)
    check_candidate(repo, release, candidate)
    count = text(repo, "rev-list", "--count", f"{release}..{candidate}")
    print(f"commits={count}")


def push(release, candidate, repo=None):
    release, candidate = full_sha(release), full_sha(candidate)
    repo = released_checkout(release, repo)
    remote_main, remote_release = fetch_refs(repo)
    require(remote_release == release, "releases/cloudflare moved since validation; nothing pushed")
    require(remote_main == candidate,
            "origin/main differs from the validated candidate; nothing pushed")
    check_candidate(repo, release, candidate)
    # Fast-forward only: Git rejects a non-fast-forward push; never force or retry.
    git(repo, "push", "--no-follow-tags", "origin", f"{candidate}:refs/heads/{RELEASE_BRANCH}",
        config=("remote.origin.mirror=false",))
    _, remote_release = fetch_refs(repo)
    require(remote_release == candidate,
            "releases/cloudflare moved during promotion; review both tips (nothing is reverted)")
    print(f"release_sha={candidate}")


# --- Feeds -----------------------------------------------------------------

def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "Duplicate JSON key")
            result[key] = value
        return result

    try:
        value = json.loads(raw, object_pairs_hook=pairs)
    except (ValueError, UnicodeError, RecursionError) as error:
        raise PromotionError("Invalid JSON") from error
    require(isinstance(value, dict), "JSON must be an object")
    return value


def feed_items(raw, label):
    feed = strict_json(raw)
    items = feed.get("items")
    require(isinstance(items, list), f"{label} has no items list")
    result = []
    for item in items:
        require(isinstance(item, dict) and all(isinstance(item.get(key), str) and item[key]
                                               for key in ("url", "title", "date_published")),
                f"{label} item lacks url, title or date_published")
        path = urlsplit(item["url"]).path
        require(path.startswith("/"), f"{label} item URL has no path")
        result.append({"path": path, "title": item["title"], "date_published": item["date_published"]})
    return result


def berlin_day(value):
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise PromotionError(f"Invalid date_published {value!r}") from error
    require(moment.tzinfo is not None, f"date_published {value!r} lacks a time zone")
    return moment.astimezone(BERLIN).date()


def today_berlin():
    return datetime.now(BERLIN).date()


def assess(candidate_items, public_items, today):
    """Return (new posts, removed paths, warnings, errors) for one promotion."""
    public = {item["path"] for item in public_items}
    current = {item["path"] for item in candidate_items}
    new, warnings, errors = [], [], []
    for item in candidate_items:
        if item["path"] in public:
            continue
        day = berlin_day(item["date_published"])
        new.append({"path": item["path"], "title": item["title"], "date": day.isoformat()})
        if day > today:
            errors.append(f"{item['path']} has a future date {day}; set date to the publication "
                          "day or keep the post as draft: true")
        elif today - day > timedelta(days=STALE_DAYS):
            warnings.append(f"{item['path']} is first published today but dated {day}; "
                            "date should be the publication day")
    removed = sorted(public - current)
    for path in removed:
        warnings.append(f"{path} is public but missing from the candidate feed (draft again or removed)")
    return new, removed, warnings, errors


def plan(candidate, feed, out, *, summary=None, base=DEFAULT_BASE_URL, today=None, fetch=None):
    candidate = full_sha(candidate)
    out = Path(out)
    require(out.is_absolute() and not out.exists(), "--out must be a new absolute path")
    base = base_url(base)
    fetch = fetch or fetch_bytes
    candidate_items = feed_items(Path(feed).read_bytes(), "Candidate feed")
    query = urlencode({"promotion": candidate[:12]})
    public_items = feed_items(fetch(f"{base}/feed.json?{query}", HTTP_TIMEOUT), "Public feed")
    new, removed, warnings, errors = assess(candidate_items, public_items, today or today_berlin())
    for message in warnings:
        print(f"::warning::{message}")
    require(not errors, "; ".join(errors))
    result = {"schema_version": 1, "candidate": candidate, "base_url": base,
              "new_posts": new, "removed": removed}
    with out.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, sort_keys=True, ensure_ascii=False)
        stream.write("\n")
    lines = [f"### Release promotion of `{candidate[:12]}`", ""]
    lines += [f"- New: [{post['title']}]({base}{post['path']}) ({post['date']})" for post in new]
    lines += [f"- Warning: {message}" for message in warnings]
    if not new:
        lines.append("- No new posts; code/content updates only.")
    print("\n".join(lines))
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("\n".join(lines) + "\n")
    print(f"new_posts={len(new)}")
    return result


# --- Public verification ---------------------------------------------------

def base_url(value):
    parsed = urlsplit(value)
    require(parsed.scheme == "https" and parsed.hostname and parsed.username is None
            and parsed.password is None and parsed.port in (None, 443)
            and parsed.path in ("", "/") and not parsed.query and not parsed.fragment
            and not any(c.isspace() or ord(c) < 32 for c in value),
            "Base URL must be a credential-free HTTPS origin")
    return f"https://{parsed.netloc}"


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PromotionError("HTTP redirect refused; expected the public HTTPS path")


def fetch_bytes(url, timeout):
    """Bounded GET without proxies, cookies, credentials or redirects."""
    request = Request(url, headers={
        "Cache-Control": "no-cache", "Pragma": "no-cache", "Accept-Encoding": "identity",
        "User-Agent": "Databearer-release-promotion/1",
    })
    opener = build_opener(ProxyHandler({}), NoRedirects())
    try:
        with opener.open(request, timeout=min(HTTP_TIMEOUT, timeout)) as response:
            require(response.status == 200, "Expected HTTP 200")
            raw = response.read(MAX_BYTES + 1)
            require(len(raw) <= MAX_BYTES, "Response exceeds 10 MB")
            return raw
    except HTTPError as error:
        error.close()
        raise PromotionError(f"HTTP {error.code} for {urlsplit(url).path}") from error
    except (URLError, OSError, HTTPException) as error:
        raise PromotionError(f"HTTPS request failed for {urlsplit(url).path}") from error


def read_plan(path):
    state = strict_json(Path(path).read_bytes())
    require(state.get("schema_version") == 1 and isinstance(state.get("new_posts"), list),
            "Unexpected promotion plan")
    full_sha(state.get("candidate"))
    base_url(state.get("base_url", ""))
    return state


def verify_once(state, get):
    paths = [post["path"] for post in state["new_posts"]]
    if not paths:
        get("/")
        return
    public = {item["path"] for item in feed_items(get("/feed.json"), "Public feed")}
    missing = [path for path in paths if path not in public]
    require(not missing, "Not in public feed yet: " + ", ".join(missing))
    for path in paths:
        get(path)


def verify(plan_path, *, timeout=480, interval=15, fetch=None,
           clock=time.monotonic, sleep=time.sleep, report=print):
    state = read_plan(plan_path)
    require(math.isfinite(timeout) and timeout > 0 and math.isfinite(interval) and interval > 0,
            "Timeout and interval must be positive finite seconds")
    fetch = fetch or fetch_bytes
    base = state["base_url"]
    deadline = clock() + timeout
    attempt, last_error = 0, "No completed attempt"
    while clock() < deadline:
        attempt += 1

        def get(path):
            remaining = deadline - clock()
            require(remaining > 0, "Verification deadline exceeded")
            query = urlencode({"verify": state["candidate"][:12], "attempt": attempt})
            return fetch(f"{base}{path}?{query}", min(HTTP_TIMEOUT, remaining))

        try:
            verify_once(state, get)
        except (PromotionError, OSError, ValueError) as error:
            last_error = str(error)
            report(f"Attempt {attempt}: not live yet: {last_error}")
        else:
            if state["new_posts"]:
                report("Live: " + ", ".join(base + post["path"] for post in state["new_posts"]))
            else:
                report(f"No new posts; {base}/ is reachable. Code-only changes are not content-verified.")
            return True
        remaining = deadline - clock()
        if remaining > 0:
            sleep(min(interval, remaining))
    report(f"Public verification timed out after {timeout:g}s ({attempt} attempts). Last failure: "
           f"{last_error}. releases/cloudflare already points at {state['candidate']}; inspect the "
           "Cloudflare Pages build and retry it. Do not force-push or revert.")
    return False


# --- CLI -------------------------------------------------------------------

class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise PromotionError(message)


def main(argv=None):
    parser = Parser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("check", "push"):
        sub = commands.add_parser(name)
        sub.add_argument("--release", required=True)
        sub.add_argument("--candidate", required=True)
    planning = commands.add_parser("plan")
    planning.add_argument("--candidate", required=True)
    planning.add_argument("--feed", required=True)
    planning.add_argument("--out", required=True)
    planning.add_argument("--summary")
    planning.add_argument("--base-url", default=DEFAULT_BASE_URL)
    verifying = commands.add_parser("verify")
    verifying.add_argument("--plan", required=True)
    verifying.add_argument("--timeout", type=float, default=480)
    verifying.add_argument("--interval", type=float, default=15)
    try:
        args = parser.parse_args(argv)
        if args.command == "check":
            check(args.release, args.candidate)
        elif args.command == "push":
            push(args.release, args.candidate)
        elif args.command == "plan":
            plan(args.candidate, args.feed, args.out, summary=args.summary, base=args.base_url)
        else:
            return 0 if verify(args.plan, timeout=args.timeout, interval=args.interval) else 1
    except (PromotionError, OSError, ValueError) as error:
        print(f"Release promotion failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
