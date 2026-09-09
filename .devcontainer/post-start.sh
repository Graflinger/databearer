#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace_dir="$(dirname "$script_dir")"
canonical_dir="/workspaces/databearer"
backend_url="http://127.0.0.1:4099"
proxy_url="http://127.0.0.1:4098"
log_file="/tmp/opencode-web.log"
backend_pid_file="/tmp/opencode-backend.pid"
proxy_pid_file="/tmp/opencode-proxy.pid"

cd "$workspace_dir"

health_ok() {
  curl -fsS "$1" >/dev/null 2>&1
}

wait_for_health() {
  local url="$1"
  local name="$2"

  for _ in $(seq 1 60); do
    if health_ok "$url"; then
      return 0
    fi
    sleep 0.5
  done

  echo "Timed out waiting for $name at $url" >&2
  return 1
}

pid_is_running() {
  local pid_file="$1"

  [ -s "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1
}

if health_ok "$proxy_url/_databearer/opencode-proxy/health" && health_ok "$proxy_url/global/health"; then
  echo "OpenCode proxy and backend are already healthy at $proxy_url"
  exit 0
fi

mkdir -p "$HOME/.config/opencode" "$HOME/.local/share/opencode" "$HOME/.local/state/opencode"
: > "$log_file"

if ! health_ok "$backend_url/global/health"; then
  if pid_is_running "$backend_pid_file"; then
    kill "$(cat "$backend_pid_file")" >/dev/null 2>&1 || true
  fi

  echo "Starting OpenCode backend on 127.0.0.1:4099 from $workspace_dir" >>"$log_file"
  opencode serve --hostname 127.0.0.1 --port 4099 >>"$log_file" 2>&1 &
  echo "$!" >"$backend_pid_file"
fi

wait_for_health "$backend_url/global/health" "OpenCode backend"
curl -fsS -H "x-opencode-directory: $canonical_dir" "$backend_url/path" >>"$log_file" 2>&1 || true
python3 "$script_dir/migrate-opencode-sessions.py" >>"$log_file" 2>&1 || true

if ! health_ok "$proxy_url/_databearer/opencode-proxy/health"; then
  if pid_is_running "$proxy_pid_file"; then
    kill "$(cat "$proxy_pid_file")" >/dev/null 2>&1 || true
  fi

  echo "Starting OpenCode path proxy on 0.0.0.0:4098" >>"$log_file"
  OPENCODE_BACKEND_HOST=127.0.0.1 \
    OPENCODE_BACKEND_PORT=4099 \
    OPENCODE_PROXY_HOST=0.0.0.0 \
    OPENCODE_PROXY_PORT=4098 \
    OPENCODE_CANONICAL_DIR="$canonical_dir" \
    node "$script_dir/opencode-path-proxy.mjs" >>"$log_file" 2>&1 &
  echo "$!" >"$proxy_pid_file"
fi

wait_for_health "$proxy_url/_databearer/opencode-proxy/health" "OpenCode path proxy"
wait_for_health "$proxy_url/global/health" "OpenCode through proxy"

echo "OpenCode remote server is healthy at $proxy_url for $canonical_dir"
