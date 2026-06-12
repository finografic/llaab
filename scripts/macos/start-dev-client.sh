#!/bin/zsh

set -euo pipefail

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.3.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/justin/LLAAB

export LLAAB_API_URL="${LLAAB_API_URL:-http://127.0.0.1:8888}"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3000}"
export LLAAB_VAULT="${LLAAB_VAULT:-$PWD/vault}"

exec /opt/homebrew/bin/pnpm --filter @llaab/client run dev
