#!/bin/zsh

set -euo pipefail

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.3.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/justin/LLAAB

export SERVER_URL="${SERVER_URL:-http://127.0.0.1:3000}"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-4321}"
export LLAAB_VAULT="${LLAAB_VAULT:-$PWD/vault}"

readonly persistent_root="/Users/justin/LLAAB/apps/client/.persistent"
readonly builds_dir="$persistent_root/builds"
readonly current_link="$persistent_root/current"

mkdir -p "$builds_dir"

build_id="$(date +%Y%m%d-%H%M%S)"
staging_dir="$builds_dir/$build_id"
readonly keep_builds=3

promote_build() {
  local next_link="$persistent_root/current.next"
  ln -sfn "$staging_dir" "$next_link"
  mv -f "$next_link" "$current_link"
}

trim_old_builds() {
  local builds=("${(@f)$(ls -1dt "$builds_dir"/* 2>/dev/null)}")
  if (( ${#builds[@]} <= keep_builds )); then
    return
  fi

  local stale_build
  for stale_build in "${builds[@]:$keep_builds}"; do
    rm -rf "$stale_build"
  done
}

run_current_build() {
  exec /Users/justin/.nvm/versions/node/v24.3.0/bin/node "$current_link/server/entry.mjs"
}

rm -rf "$staging_dir"
mkdir -p "$staging_dir"

if LLAAB_CLIENT_OUT_DIR="$staging_dir" /opt/homebrew/bin/pnpm --filter @llaab/client build; then
  if [[ ! -f "$staging_dir/server/entry.mjs" ]]; then
    echo "[persistent-client] Build succeeded but server entry is missing: $staging_dir/server/entry.mjs" >&2
    rm -rf "$staging_dir"
  else
    promote_build
    trim_old_builds
    run_current_build
  fi
fi

rm -rf "$staging_dir"

if [[ -f "$current_link/server/entry.mjs" ]]; then
  echo "[persistent-client] Falling back to last known-good build." >&2
  run_current_build
fi

echo "[persistent-client] No successful persistent client build is available." >&2
exit 1
