#!/usr/bin/env bash
set -euo pipefail

ensure_owned_mount() {
  local path="$1"

  if [ -d "$path" ] && [ "$(stat -c '%u' "$path")" != "$(id -u)" ]; then
    sudo chown "$(id -u):$(id -g)" "$path"
  fi
}

ensure_owned_mount "$HOME/.config/opencode"
ensure_owned_mount "$HOME/.local/share/opencode"
ensure_owned_mount "$HOME/.local/state/opencode"

pip install --upgrade pip
pip3 install -r ./pipeline/requirements.txt
pip3 install -r ./image-generation/requirements.txt

if [ ! -x "$HOME/.duckdb/cli/latest/duckdb" ]; then
  curl https://install.duckdb.org | sh
fi

# uv/uvx: required to launch the dbt MCP server (uvx dbt-mcp)
if ! command -v uvx >/dev/null 2>&1; then
  if command -v pipx >/dev/null 2>&1; then
    pipx install uv
  else
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
fi

opencode --version

cd frontend
npm install
