#!/bin/zsh

set -euo pipefail

export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

readonly script_dir="${0:A:h}"
readonly repo_dir="${script_dir:h:h}"

cd "$repo_dir"

export LLAAB_API_URL="${LLAAB_API_URL:-http://127.0.0.1:8888}"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-5050}"
export LLAAB_VAULT="${LLAAB_VAULT:-$PWD/vault}"

readonly persistent_root="$repo_dir/apps/client/.persistent"
readonly builds_dir="$persistent_root/builds"
readonly current_link="$persistent_root/current"
readonly runtime_mode="${LLAAB_CLIENT_RUNTIME:-dev}"

mkdir -p "$builds_dir"

readonly keep_builds=3

run_dev_server() {
  exec /opt/homebrew/bin/pnpm --filter @llaab/client exec vite
}

if [[ "$runtime_mode" == "dev" ]]; then
  run_dev_server
fi

if [[ "$runtime_mode" != "preview" ]]; then
  echo "[persistent-client] Unknown LLAAB_CLIENT_RUNTIME=$runtime_mode; expected dev or preview." >&2
  exit 1
fi

build_id="$(date +%Y%m%d-%H%M%S)"
staging_dir="$builds_dir/$build_id"

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
