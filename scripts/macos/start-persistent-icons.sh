#!/bin/zsh

set -euo pipefail

export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

readonly script_dir="${0:A:h}"
readonly repo_dir="${script_dir:h:h}"

cd "$repo_dir"

exec pnpm --filter @llaab/icons dev
