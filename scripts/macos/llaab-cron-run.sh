#!/usr/bin/env bash
# One-shot cron trigger for a LLAAB recipe. Loads repo .env so X-API-Key auth works
# when LLAAB_API_KEY / LLAAB_PASSWORD are set (plain curl from crontab cannot).
set -euo pipefail

recipe_id="${1:-}"
if [[ -z "$recipe_id" ]]; then
  echo "usage: llaab-cron-run.sh <recipe-id>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
env_file="$repo_root/.env"
log_file="/tmp/llaab-cron-${recipe_id}.log"
url="http://127.0.0.1:8888/api/crons/${recipe_id}/run"
header_file=""

cleanup() {
  if [[ -n "$header_file" && -f "$header_file" ]]; then
    rm -f "$header_file"
  fi
}
trap cleanup EXIT

if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

curl_args=(-fsS -X POST "$url")
if [[ -n "${LLAAB_API_KEY:-}" ]]; then
  # Keep the key out of `ps` argv — write a temp header file instead.
  header_file="$(mktemp "${TMPDIR:-/tmp}/llaab-cron-hdr.XXXXXX")"
  printf 'X-API-Key: %s\n' "$LLAAB_API_KEY" >"$header_file"
  curl_args+=(-H @"$header_file")
fi

exec /usr/bin/curl "${curl_args[@]}" >"$log_file" 2>&1
