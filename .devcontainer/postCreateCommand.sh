#!/bin/sh
set -e

pip install --upgrade pip
pip3 install -r ./pipeline/requirements.txt
pip3 install -r ./image-generation/requirements.txt

if [ ! -x "$HOME/.duckdb/cli/latest/duckdb" ]; then
  curl https://install.duckdb.org | sh
fi

if ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path
fi

# uv/uvx: required to launch the dbt MCP server (uvx dbt-mcp)
if ! command -v uvx >/dev/null 2>&1; then
  if command -v pipx >/dev/null 2>&1; then
    pipx install uv
  else
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
fi

if [ -x "$HOME/.opencode/bin/opencode" ] && ! command -v opencode >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    sudo ln -sf "$HOME/.opencode/bin/opencode" /usr/local/bin/opencode
  else
    mkdir -p "$HOME/.local/bin"
    ln -sf "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode"
  fi
fi

cd frontend
npm install
