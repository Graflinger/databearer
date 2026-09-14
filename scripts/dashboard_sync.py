#!/usr/bin/env python3
"""Prepare and publish a release-to-main ancestry sync after production publication.

Run both commands from the released checkout, using this checkout's script:
  python3 scripts/dashboard_sync.py prepare --release SHA --worktree ABS_PATH --state ABS_JSON
  python3 scripts/dashboard_sync.py publish --state ABS_JSON

Between commands the workflow validates the separate dashboard-sync worktree
(offline electricity/publisher tests and frontend tests/lint/build). State belongs
outside both checkouts. Public verification and credentials belong to the workflow;
this script reports only Git preparation/publication, never deployment status.
"""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


RELEASE_BRANCH = "releases/cloudflare"
SYNC_BRANCH = "dashboard-sync"
BOT_NAME = "github-actions[bot]"
BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"


class SyncError(RuntimeError):
    """Stop this sync without retrying or changing production."""


def require(condition, message):
    if not condition:
        raise SyncError(message)


def git(repo, *args, env=None, allowed=(0,), config=()):
    overrides = [item for setting in config for item in ("-c", setting)]
    result = subprocess.run(
        ["git", "--no-replace-objects", "-c", "core.filemode=true", *overrides, *args],
        cwd=repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        check=False,
    )
    # Capture even failure chatter: remote diagnostics can contain credential URLs.
    require(result.returncode in allowed,
            f"git {args[0]} failed (exit {result.returncode}); sync stopped")
    return result


def text(repo, *args):
    return git(repo, *args).stdout.decode("utf-8").strip()


def commit(repo, ref):
    return text(repo, "rev-parse", "--verify", f"{ref}^{{commit}}")


def full_sha(value):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", value),
            "Expected a full lowercase commit SHA")
    return value


def absolute_path(value):
    require(isinstance(value, str) and Path(value).is_absolute(),
            "Worktree and state paths must be absolute")
    return Path(value).resolve()


def ancestor(repo, older, newer):
    return git(repo, "merge-base", "--is-ancestor", older, newer,
               allowed=(0, 1)).returncode == 0


def clean(repo):
    require(not git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all",
                    "--ignore-submodules=none").stdout,
            "Worktree must be clean, including untracked files")


def released_checkout(release):
    repo = Path.cwd().resolve()
    require(Path(text(repo, "rev-parse", "--show-toplevel")).resolve() == repo,
            "Run from the released checkout root")
    require(text(repo, "symbolic-ref", "--quiet", "HEAD")
            == f"refs/heads/{RELEASE_BRANCH}", "Expected the release branch checkout")
    require(commit(repo, "HEAD") == release, "Released checkout HEAD differs from release SHA")
    return repo


def fetch(repo):
    options = ["--unshallow"] if text(repo, "rev-parse", "--is-shallow-repository") == "true" else []
    git(repo, "fetch", "--atomic", "--no-tags", *options, "origin",
        "refs/heads/main:refs/remotes/origin/main",
        f"refs/heads/{RELEASE_BRANCH}:refs/remotes/origin/{RELEASE_BRANCH}")
    return (commit(repo, "refs/remotes/origin/main"),
            commit(repo, f"refs/remotes/origin/{RELEASE_BRANCH}"))


def check_candidate(repo, base, release, candidate):
    require(ancestor(repo, base, candidate) and ancestor(repo, release, candidate),
            "Candidate must contain both original main and exact release ancestry")
    if ancestor(repo, release, base):
        require(candidate == base, "Already-integrated release must be a no-op")
    elif ancestor(repo, base, release):
        require(candidate == release, "Fast-forward candidate must equal exact release")
    else:
        parents = text(repo, "show", "--no-patch", "--format=%P", candidate).split()
        require(parents == [base, release],
                "Candidate must be one direct merge of original main and exact release; "
                "extra candidate commits are forbidden")


def check_worktree(repo, worktree, base, release, candidate):
    require(worktree.is_dir(), "Prepared worktree is missing")
    require(Path(text(worktree, "rev-parse", "--show-toplevel")).resolve() == worktree,
            "State path is not a worktree root")
    common = text(repo, "rev-parse", "--path-format=absolute", "--git-common-dir")
    require(text(worktree, "rev-parse", "--path-format=absolute", "--git-common-dir") == common,
            "Worktree belongs to a different repository")
    require(text(worktree, "symbolic-ref", "--quiet", "HEAD") == f"refs/heads/{SYNC_BRANCH}",
            "Expected dashboard-sync worktree branch")
    require(commit(worktree, "HEAD") == candidate, "Worktree HEAD differs from prepared candidate")
    clean(worktree)
    check_candidate(repo, base, release, candidate)


def check_paths(repo, worktree, state_path):
    require(not worktree.is_relative_to(repo) and not repo.is_relative_to(worktree),
            "Sync worktree must be separate from released checkout")
    require(not state_path.is_relative_to(repo) and not state_path.is_relative_to(worktree),
            "State must be outside both checkouts")


def outputs(base, candidate):
    print(f"changed={str(candidate != base).lower()}")
    print(f"candidate={candidate}")


def prepare(release, worktree, state_path):
    release = full_sha(release)
    repo = released_checkout(release)
    worktree, state_path = absolute_path(worktree), absolute_path(state_path)
    check_paths(repo, worktree, state_path)
    require(not state_path.exists(), "State already exists; use a fresh state path")
    require(state_path.parent.is_dir() and worktree.parent.is_dir(),
            "State and worktree parent directories must exist")
    base, remote_release = fetch(repo)
    require(remote_release == release, "origin/releases/cloudflare differs from expected release")
    git(repo, "worktree", "add", "-b", SYNC_BRANCH, str(worktree), base)
    if not ancestor(repo, release, base):
        env = dict(os.environ, GIT_AUTHOR_NAME=BOT_NAME, GIT_AUTHOR_EMAIL=BOT_EMAIL,
                   GIT_COMMITTER_NAME=BOT_NAME, GIT_COMMITTER_EMAIL=BOT_EMAIL,
                   GIT_MERGE_AUTOEDIT="no")
        # Explicit --ff permits a real merge or fast-forward despite merge.ff config.
        # Conflicts remain local for inspection; no resolution or retry is attempted.
        merged = git(worktree, "merge", "--no-edit", "--ff", release, env=env, allowed=(0, 1))
        if merged.returncode:
            conflicts = git(worktree, "diff", "--name-only", "--diff-filter=U", "-z").stdout
            names = [os.fsdecode(path) for path in conflicts.split(b"\0") if path]
            raise SyncError("git merge failed; conflicting paths: " + repr(names))
    candidate = commit(worktree, "HEAD")
    check_worktree(repo, worktree, base, release, candidate)
    state = {"schema_version": 1, "repository": str(repo), "main_base": base,
             "release": release, "candidate": candidate, "worktree": str(worktree)}
    with state_path.open("x", encoding="utf-8") as stream:
        json.dump(state, stream, sort_keys=True)
        stream.write("\n")
    outputs(base, candidate)


def read_state(state_path):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate state field")
            result[key] = value
        return result

    state = json.loads(state_path.read_text(encoding="utf-8"), object_pairs_hook=unique_pairs)
    require(isinstance(state, dict) and set(state) == {
        "schema_version", "repository", "main_base", "release", "candidate", "worktree",
    }, "Unexpected sync state fields")
    require(type(state["schema_version"]) is int and state["schema_version"] == 1,
            "Unsupported sync state version")
    for key in ("main_base", "release", "candidate"):
        full_sha(state[key])
    return state


def publish(state_path):
    state_path = absolute_path(state_path)
    state = read_state(state_path)
    base, release, candidate = (state[key] for key in ("main_base", "release", "candidate"))
    repo = released_checkout(release)
    require(absolute_path(state["repository"]) == repo, "State belongs to another checkout")
    worktree = absolute_path(state["worktree"])
    check_paths(repo, worktree, state_path)
    check_worktree(repo, worktree, base, release, candidate)
    remote_main, remote_release = fetch(repo)
    require(remote_main == base, "origin/main moved since prepare; start a new sync")
    require(remote_release == release, "origin/releases/cloudflare moved since prepare")
    check_worktree(repo, worktree, base, release, candidate)
    if candidate != base:
        # The only destination is main. Ordinary non-FF rejection protects a main
        # advance after fetch; never retry. Suppress implicit tag/mirror pushes too.
        git(repo, "push", "--no-follow-tags", "origin", f"{candidate}:refs/heads/main",
             config=("remote.origin.mirror=false",))
    # A main-only push cannot lock the other ref. Detect observed movement during
    # the push without rolling back either branch or claiming a two-ref transaction.
    remote_main, remote_release = fetch(repo)
    require(remote_main == candidate and remote_release == release,
            "Remote refs moved during sync; main may already contain the candidate. "
            "Review current tips and start a fresh sync; neither branch is reverted")
    outputs(base, candidate)


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise SyncError(message)


def main(argv=None):
    parser = Parser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    preparing = commands.add_parser("prepare")
    preparing.add_argument("--release", required=True)
    preparing.add_argument("--worktree", required=True)
    preparing.add_argument("--state", required=True)
    publishing = commands.add_parser("publish")
    publishing.add_argument("--state", required=True)
    try:
        args = parser.parse_args(argv)
        if args.command == "prepare":
            prepare(args.release, args.worktree, args.state)
        else:
            publish(args.state)
    except (SyncError, OSError, ValueError) as error:
        print(f"Dashboard sync failed: {error}; production is unaffected", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
