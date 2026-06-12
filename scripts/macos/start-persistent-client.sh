#!/bin/zsh

set -euo pipefail

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.3.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/justin/LLAAB

export LLAAB_API_URL="${LLAAB_API_URL:-http://127.0.0.1:8888}"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3000}"
export LLAAB_VAULT="${LLAAB_VAULT:-$PWD/vault}"

readonly persistent_root="/Users/justin/LLAAB/apps/client/.persistent"
readonly builds_dir="$persistent_root/builds"
readonly current_link="$persistent_root/current"

mkdir -p "$builds_dir"

build_id="$(date +%Y%m%d-%H%M%S)"
staging_dir="$builds_dir/$build_id"
readonly keep_builds=3

promote_build() {
  ln -sfn "$staging_dir" "$current_link"
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
  export LLAAB_CLIENT_OUT_DIR="$current_link"
  exec /opt/homebrew/bin/pnpm --filter @llaab/client exec vite preview
}

rm -rf "$staging_dir"
mkdir -p "$staging_dir"

if LLAAB_CLIENT_OUT_DIR="$staging_dir" /opt/homebrew/bin/pnpm --filter @llaab/client build; then
  if [[ ! -f "$staging_dir/index.html" ]]; then
    echo "[persistent-client] Build succeeded but index.html is missing: $staging_dir/index.html" >&2
    rm -rf "$staging_dir"
  else
    promote_build
    trim_old_builds
    run_current_build
  fi
fi

rm -rf "$staging_dir"

if [[ -f "$current_link/index.html" ]]; then
  echo "[persistent-client] Falling back to last known-good build." >&2
  run_current_build
fi

echo "[persistent-client] No successful persistent client build is available." >&2
exit 1
