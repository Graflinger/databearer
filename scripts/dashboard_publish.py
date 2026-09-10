#!/usr/bin/env python3
"""Publish validated daily exports from an already released main checkout.

Run from the repository root. ``check`` prints only the base commit SHA; pass it
to ``publish --base SHA`` after the existing pipeline and frontend validations.
This standard-library guard checks publication scope, not the data contracts.
It never reconciles branches, retries a failed push, or verifies Cloudflare builds.
"""

import argparse
from datetime import date, datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from zoneinfo import ZoneInfo


RECENT = "frontend/src/_data/germanElectricity.json"
TRADE = "frontend/src/_data/germanElectricityTrade.json"
HISTORY = "frontend/src/data-history/german-electricity"
MANIFEST = f"{HISTORY}/manifest.json"
PUBLIC_HISTORY = "/data/history/german-electricity/"
BRANCHES = ("main", "releases/cloudflare")
MESSAGE = "data: refresh German electricity dashboard"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"


class PublicationError(RuntimeError):
    """A failed guard or Git operation; stop without retrying publication."""


def require(condition, message):
    if not condition:
        raise PublicationError(message)


def git(*args, env=None):
    # Check executable bits even on a checkout configured with core.filemode=false.
    result = subprocess.run(
        ["git", "--literal-pathspecs", "-c", "core.filemode=true", *args],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, check=False,
    )
    if result.returncode:
        raise PublicationError(
            f"git {args[0]} failed; publication stopped:\n"
            + result.stderr.decode("utf-8", errors="replace").strip()
        )
    return result.stdout


def paths(output):
    return [os.fsdecode(value) for value in output.split(b"\0") if value]


def sha(ref):
    return git("rev-parse", "--verify", ref).decode("ascii").strip()


def status():
    # Disabling rename detection makes every record exactly XY + space + path.
    # NUL delimiters preserve spaces, tabs, newlines and non-ASCII filenames.
    records = paths(git(
        "status", "--porcelain=v1", "-z", "--untracked-files=all",
        "--no-renames", "--ignore-submodules=none",
    ))
    result = {}
    for record in records:
        require(len(record) > 3 and record[2] == " ", "Malformed Git status")
        code, path = record[:2], record[3:]
        require(code == "??" or code[0] == " ", "Pre-staged changes are forbidden")
        result[path] = code
    require(not git(
        "diff", "--cached", "--ita-visible-in-index", "--name-only", "-z",
        "--no-renames", "--ignore-submodules=none",
    ), "Pre-staged changes are forbidden")
    return result


def guard_refs(base=None, expected_branch="main"):
    require(git("rev-parse", "--show-prefix") == b"\n",
            "Run from the repository root")
    branch = git("symbolic-ref", "--quiet", "--short", "HEAD").decode().strip()
    require(branch == expected_branch, f"Expected checkout branch {expected_branch!r}")
    git("fetch", "--atomic", "--no-tags", "origin", *[
        f"refs/heads/{branch}:refs/remotes/origin/{branch}" for branch in BRANCHES
    ])
    head = sha("HEAD")
    require(base is None or head == base, "HEAD no longer equals the checked base")
    require(all(sha(f"refs/remotes/origin/{branch}") == head for branch in BRANCHES),
            "HEAD, origin/main and origin/releases/cloudflare must equal the base; "
            "unpublished main commits require a separate reviewed release")
    return head


def regular_bytes(path):
    target = Path(path)
    for parent in reversed(target.parents):
        require(stat.S_ISDIR(parent.lstat().st_mode), f"Non-directory or symlink: {parent}")
    mode = target.lstat().st_mode
    require(stat.S_ISREG(mode) and not mode & 0o111,
            f"JSON target must be a non-executable regular file: {path}")
    return target.read_bytes()


def strict_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value, f"Duplicate JSON key: {key}")
            value[key] = item
        return value

    def nonfinite(value):
        raise PublicationError(f"Nonfinite JSON value: {value}")

    value = json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite)
    require(isinstance(value, dict), "JSON export must be an object")
    return value


def tree_entry(ref, path):
    records = git("ls-tree", "-z", ref, "--", path).split(b"\0")
    if not records[0]:
        return None
    metadata, name = records[0].split(b"\t", 1)
    require(os.fsdecode(name) == path, f"Unexpected tree path: {path}")
    mode, kind, object_id = metadata.split()
    require(mode == b"100644" and kind == b"blob", f"Unsafe tracked file mode: {path}")
    return object_id.decode("ascii")


def manifest_years(manifest, year):
    require(set(manifest) == {
        "schema_version", "kind", "timezone", "source", "first_date",
        "last_date", "years", "revision_policy",
    }, "Unexpected history manifest fields")
    require(manifest["timezone"] == "Europe/Berlin", "History timezone must be Europe/Berlin")
    require(isinstance(manifest["years"], list) and manifest["years"], "Missing history years")
    entries = {}
    for entry in manifest["years"]:
        require(isinstance(entry, dict) and set(entry) == {
            "year", "url", "sha256", "first_date", "last_date", "days", "frozen",
        }, "Unexpected history year fields")
        source_year = entry["year"]
        require(type(source_year) is int and 2015 <= source_year <= year,
                "History year is not a past or current Berlin calendar year")
        require(source_year not in entries, "Duplicate history year")
        digest = entry["sha256"]
        require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest),
                "Invalid history SHA-256")
        require(entry["url"] == f"{PUBLIC_HISTORY}{source_year}.{digest}.json",
                "History URL does not match year and hash")
        require(type(entry["frozen"]) is bool, "Invalid frozen flag")
        first, last = date.fromisoformat(entry["first_date"]), date.fromisoformat(entry["last_date"])
        require(first == date(source_year, 1, 1) and last.year == source_year and first <= last,
                "Invalid history coverage")
        require(type(entry["days"]) is int and entry["days"] == (last - first).days + 1,
                "Invalid history day count")
        entries[source_year] = entry
    require(list(entries) == list(range(min(entries), max(entries) + 1)),
            "History years must be ordered and contiguous")
    require(manifest["first_date"] == entries[min(entries)]["first_date"]
            and manifest["last_date"] == entries[max(entries)]["last_date"],
            "Manifest coverage differs from year entries")
    return entries


def partition_path(entry):
    return HISTORY + "/" + entry["url"].removeprefix(PUBLIC_HISTORY)


def validate_changes(base, year):
    changes = status()
    changed_paths = set(paths(git(
        "diff", "--name-only", "-z", "--no-renames", "--ignore-submodules=none",
    ))) | set(paths(git("ls-files", "--others", "--exclude-standard", "-z")))
    require(changed_paths == set(changes), "Git status and changed paths disagree")
    version = re.compile(re.escape(HISTORY) + rf"/{year}\.[0-9a-f]{{64}}\.json")
    for path in sorted(changed_paths):
        require(path in {RECENT, TRADE, MANIFEST} or version.fullmatch(path),
                f"Path is outside daily publication allowlist: {path!r}")

    require(tree_entry(base, MANIFEST), "Base must contain a history manifest")
    old = strict_json(git("show", f"{base}:{MANIFEST}"))
    new = strict_json(regular_bytes(MANIFEST))
    before, after = manifest_years(old, year), manifest_years(new, year)
    require({key: value for key, value in old.items() if key not in {"years", "last_date"}}
            == {key: value for key, value in new.items() if key not in {"years", "last_date"}},
            "History manifest metadata changed")
    require(set(before) <= set(after) and set(after) - set(before) <= {year},
            "Only the current Berlin year may be added; no years may be removed")
    require(new["last_date"] >= old["last_date"], "History coverage regressed")
    for source_year, entry in after.items():
        if source_year < year:
            require(entry["frozen"] is True, "Closed history years must be frozen")
            require(entry["last_date"] == f"{source_year}-12-31",
                    "Closed year lacks December 31; reconcile explicitly before refreshing")
            previous = before[source_year]
            expected = dict(previous)
            if previous["frozen"] is False:
                require(source_year == year - 1, "Only the immediately previous year may freeze at rollover")
                expected["frozen"] = True
            require(entry == expected, f"Frozen history entry changed: {source_year}")
        else:
            require(entry["frozen"] is False, "Current history year must not be frozen")
        path = partition_path(entry)
        raw = regular_bytes(path)
        require(hashlib.sha256(raw).hexdigest() == entry["sha256"], f"History hash mismatch: {path}")
        if source_year < year:
            require(tree_entry(base, path), f"Closed history file is not in the base: {path}")
        else:
            require(tree_entry(base, path) or path in changed_paths,
                    f"Referenced current-year file would not be committed: {path}")

    for path in (RECENT, TRADE):
        require(tree_entry(base, path), f"Base must contain {path}")
        strict_json(regular_bytes(path))

    protected = {partition_path(entry) for entry in (*before.values(), *after.values())}
    current_path = partition_path(after[year]) if year in after else None
    payloads = {}
    for path in sorted(changed_paths):
        existing = tree_entry(base, path)
        if changes[path] == " D":
            require(version.fullmatch(path) and existing and path not in protected,
                    f"Only superseded current-year retention files may be deleted: {path}")
            payloads[path] = None
            continue
        raw = regular_bytes(path)
        value = strict_json(raw)
        if version.fullmatch(path):
            require(existing is None, f"History version files are immutable: {path}")
            require(path == current_path, f"New history file is not referenced by the manifest: {path}")
            require(set(value) == {"schema_version", "year", "timezone", "source", "rows"}
                    and type(value["year"]) is int and value["year"] == year
                    and value["timezone"] == "Europe/Berlin"
                    and value["source"] == new["source"],
                    "New partition must describe only the current Berlin year")
        payloads[path] = raw
    return payloads


def check(expected_branch="main"):
    base = guard_refs(expected_branch=expected_branch)
    require(not status(), "Check requires a clean tracked/untracked working tree (ignored files are allowed)")
    return base


def publish(base, expected_branch="main"):
    require(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", base), "Base must be a full commit SHA")
    guard_refs(base, expected_branch)
    payloads = validate_changes(base, datetime.now(ZoneInfo("Europe/Berlin")).year)
    if not payloads:
        return f"unchanged {base}"

    # Recheck immediately before taking ownership of the previously empty index.
    require(sha("HEAD") == base, "HEAD changed during validation")
    require(set(status()) == set(payloads), "Working paths changed during validation")
    git("add", "--all", "--", *payloads)
    staged = set(paths(git("diff", "--cached", "--name-only", "-z", "--no-renames")))
    require(staged == set(payloads), "Staged paths differ from validated paths")
    for path, raw in payloads.items():
        entry = git("ls-files", "--stage", "-z", "--", path)
        if raw is None:
            require(not entry, f"Deletion was not staged: {path}")
        else:
            require(entry.startswith(b"100644 "), f"Unsafe staged mode: {path}")
            require(git("show", f":{path}") == raw, f"Staged bytes differ from validated bytes: {path}")
    tree = git("write-tree").decode("ascii").strip()
    env = os.environ.copy()
    env.update(GIT_AUTHOR_NAME=BOT_NAME, GIT_AUTHOR_EMAIL=BOT_EMAIL,
               GIT_COMMITTER_NAME=BOT_NAME, GIT_COMMITTER_EMAIL=BOT_EMAIL)
    git("commit", "-m", MESSAGE, env=env)
    commit = sha("HEAD")
    require(git("rev-list", "--parents", "-n", "1", "HEAD").decode().split() == [commit, base],
            "Publication commit must have exactly the checked base as its parent")
    git("merge-base", "--is-ancestor", base, "HEAD")
    require(sha("HEAD^{tree}") == tree, "Commit tree differs from validated index")
    require(not status(), "Working tree or index changed during commit")
    require(git("symbolic-ref", "--quiet", "--short", "HEAD").decode().strip() == expected_branch,
            "Checkout branch changed during commit")
    git("push", "--atomic", "origin", *[f"HEAD:refs/heads/{branch}" for branch in BRANCHES])
    return f"published {commit}"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check_parser = commands.add_parser("check", help="Check the released base before refresh; print its SHA")
    publish_parser = commands.add_parser("publish", help="Commit and atomically push fully validated daily exports")
    for command in (check_parser, publish_parser):
        command.add_argument("--expected-branch", default="main")
    publish_parser.add_argument("--base", required=True)
    args = parser.parse_args(argv)
    try:
        result = check(args.expected_branch) if args.command == "check" else publish(args.base, args.expected_branch)
        print(result)
        return 0
    except (PublicationError, OSError, ValueError, KeyError, TypeError) as error:
        print(f"dashboard publication refused: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
