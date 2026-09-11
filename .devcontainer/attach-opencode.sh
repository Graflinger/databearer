#!/usr/bin/env bash
set -euo pipefail

server_url="${OPENCODE_SERVER_URL:-http://localhost:4098}"
canonical_dir="${OPENCODE_REMOTE_DIR:-/workspaces/databearer}"

if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode is not installed on the host or is not on PATH" >&2
  exit 1
fi

versions="$(
  python3 - "$server_url" <<'PY'
import json
import re
import subprocess
import sys
import urllib.request

server_url = sys.argv[1].rstrip("/")
with urllib.request.urlopen(f"{server_url}/global/health", timeout=30) as response:
    payload = json.load(response)

server_version = payload.get("version", "")
host_output = subprocess.check_output(["opencode", "--version"], text=True)
host_match = re.search(r"\d+\.\d+\.\d+", host_output)
host_version = host_match.group(0) if host_match else ""

print(host_version)
print(server_version)
PY
)"

host_version="${versions%%$'\n'*}"
server_version="${versions#*$'\n'}"

if [ "$server_version" = "$versions" ]; then
  server_version=""
fi

if [ -z "$server_version" ]; then
  echo "Could not read OpenCode server version from $server_url/global/health" >&2
  exit 1
fi

if [ "$host_version" != "$server_version" ]; then
  echo "OpenCode version mismatch: host=$host_version server=$server_version" >&2
  echo "Install matching host OpenCode version before attaching." >&2
  exit 1
fi

exec opencode attach "$server_url" --dir "$canonical_dir" "$@"
