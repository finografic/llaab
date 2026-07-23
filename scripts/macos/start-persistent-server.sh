#!/bin/zsh

set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

readonly script_dir="${0:A:h}"
readonly repo_dir="${script_dir:h:h}"

mkdir -p "$HOME/Library/Logs/llaab"

cd "$repo_dir"

export PORT="${PORT:-8888}"
export LLAAB_VAULT="${LLAAB_VAULT:-$PWD/vault}"

exec "$HOME/.bun/bin/bun" apps/server/src/index.ts
