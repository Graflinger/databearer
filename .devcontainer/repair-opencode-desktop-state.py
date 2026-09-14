#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


CANONICAL_DIR = "/workspaces/databearer"
DEFAULT_SERVER_URL = "http://localhost:4098"
STATE_PATH = Path.home() / "Library/Application Support/ai.opencode.desktop/opencode.global.dat"
WORKSPACE_NAME = PurePosixPath(CANONICAL_DIR).name


def is_host_workspace_path(value: object) -> bool:
    if not isinstance(value, str):
        return False

    path = PurePosixPath(value)
    return value.startswith("/Users/") and path.name == WORKSPACE_NAME


def request_json(url: str, headers: dict[str, str] | None = None) -> Any:
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def verify_server(server_url: str) -> int:
    health = request_json(f"{server_url.rstrip('/')}/global/health")
    if not health.get("healthy"):
        raise RuntimeError(f"OpenCode server is not healthy: {health}")

    path = request_json(
        f"{server_url.rstrip('/')}/path",
        headers={"x-opencode-directory": CANONICAL_DIR},
    )
    resolved = path.get("directory") or path.get("worktree")
    if resolved != CANONICAL_DIR:
        raise RuntimeError(f"Server resolved {resolved!r}, expected {CANONICAL_DIR!r}")

    sessions = request_json(
        f"{server_url.rstrip('/')}/session?roots=true&limit=100",
        headers={"x-opencode-directory": CANONICAL_DIR},
    )
    if isinstance(sessions, list):
        return sum(1 for session in sessions if session.get("directory") == CANONICAL_DIR)
    if isinstance(sessions, dict) and isinstance(sessions.get("data"), list):
        return sum(1 for session in sessions["data"] if session.get("directory") == CANONICAL_DIR)
    return 0


def replace_host_paths(value: Any) -> tuple[Any, int]:
    if isinstance(value, str):
        if is_host_workspace_path(value):
            return CANONICAL_DIR, 1
        return value, 0

    if isinstance(value, list):
        changed = 0
        next_values = []
        for item in value:
            next_item, item_changed = replace_host_paths(item)
            changed += item_changed
            next_values.append(next_item)
        return next_values, changed

    if isinstance(value, dict):
        changed = 0
        next_value = {}
        for key, item in value.items():
            next_item, item_changed = replace_host_paths(item)
            changed += item_changed
            next_value[key] = next_item
        return next_value, changed

    return value, 0


def repair_server_scoped_values(value: Any, server_url: str) -> tuple[Any, int]:
    if isinstance(value, list):
        changed = 0
        next_items = []
        for item in value:
            next_item, item_changed = repair_server_scoped_values(item, server_url)
            changed += item_changed
            next_items.append(next_item)
        return next_items, changed

    if not isinstance(value, dict):
        return value, 0

    changed = 0
    next_value = dict(value)

    if next_value.get("server") == server_url or next_value.get("url") == server_url:
        next_value, changed = replace_host_paths(next_value)
        return next_value, changed

    for key, item in list(next_value.items()):
        if key == server_url:
            next_item, item_changed = replace_host_paths(item)
        else:
            next_item, item_changed = repair_server_scoped_values(item, server_url)
        next_value[key] = next_item
        changed += item_changed

    return next_value, changed


def repair_state(state: dict[str, Any], server_url: str) -> tuple[dict[str, Any], list[str]]:
    messages: list[str] = []

    projects = state.setdefault("projects", {})
    if not isinstance(projects, dict):
        raise RuntimeError("Desktop state field 'projects' is not an object")

    project_list = projects.setdefault(server_url, [])
    if not isinstance(project_list, list):
        raise RuntimeError(f"Desktop state projects[{server_url!r}] is not a list")

    repaired_project_list, replaced_projects = replace_host_paths(project_list)
    if replaced_projects:
        messages.append(f"replaced {replaced_projects} host workspace project path value(s) for {server_url}")
    project_list = repaired_project_list

    canonical_project = None
    retained_projects = []
    for project in project_list:
        if isinstance(project, dict) and project.get("worktree") == CANONICAL_DIR:
            if canonical_project is None:
                canonical_project = project
                retained_projects.append(project)
            continue
        retained_projects.append(project)

    if canonical_project is None:
        canonical_project = {"worktree": CANONICAL_DIR, "expanded": True}
        retained_projects.append(canonical_project)
        messages.append(f"added {CANONICAL_DIR} under {server_url}")
    else:
        canonical_project["expanded"] = True

    projects[server_url] = retained_projects

    last_project = state.setdefault("lastProject", {})
    if isinstance(last_project, dict):
        if is_host_workspace_path(last_project.get(server_url)):
            messages.append(f"replaced host lastProject path for {server_url}")
        if last_project.get(server_url) != CANONICAL_DIR:
            last_project[server_url] = CANONICAL_DIR
            messages.append(f"set lastProject[{server_url}] to {CANONICAL_DIR}")

    scoped_state, replaced_scoped = repair_server_scoped_values(state, server_url)
    if replaced_scoped:
        messages.append(f"replaced {replaced_scoped} additional server-scoped host path value(s)")
        state = scoped_state

    return state, messages


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temp_name = handle.name
    os.replace(temp_name, path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair OpenCode Desktop remote project state for databearer.")
    parser.add_argument("--dry-run", action="store_true", help="Print intended changes without writing state")
    parser.add_argument("--server-url", default=DEFAULT_SERVER_URL, help="Desktop server URL key to repair")
    parser.add_argument("--state-path", default=str(STATE_PATH), help="Path to opencode.global.dat")
    args = parser.parse_args()

    server_url = args.server_url.rstrip("/")
    state_path = Path(args.state_path).expanduser()

    try:
        visible_sessions = verify_server(server_url)
        print(f"Server is healthy; {visible_sessions} remote root session(s) currently resolve to {CANONICAL_DIR}")
    except (OSError, urllib.error.URLError, RuntimeError) as error:
        raise SystemExit(f"Cannot verify OpenCode server at {server_url}: {error}")

    if not state_path.exists():
        raise SystemExit(f"Desktop state file does not exist: {state_path}")

    with state_path.open("r", encoding="utf-8") as handle:
        state = json.load(handle)

    if not isinstance(state, dict):
        raise SystemExit("Desktop state root is not a JSON object")

    repaired_state, messages = repair_state(state, server_url)

    if not messages:
        print("Desktop state already uses the canonical remote directory")
        return 0

    print("Planned Desktop state changes:")
    for message in messages:
        print(f"- {message}")

    if args.dry_run:
        print("Dry run only; no files were changed")
        return 0

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = state_path.with_name(f"{state_path.name}.{timestamp}.bak")
    shutil.copy2(state_path, backup_path)
    write_json_atomic(state_path, repaired_state)
    print(f"Wrote repaired Desktop state: {state_path}")
    print(f"Backup: {backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
