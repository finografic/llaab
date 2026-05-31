#!/bin/zsh

set -euo pipefail

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.3.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/justin/LLAAB

export PORT="${PORT:-3000}"

exec /Users/justin/.bun/bin/bun apps/server/src/index.ts
