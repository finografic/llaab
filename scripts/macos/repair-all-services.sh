#!/bin/zsh

set -euo pipefail

readonly repo_dir="/Users/justin/LLAAB"
readonly service_script="$repo_dir/scripts/macos/llaab-service.sh"
readonly logs_dir="$HOME/Library/Logs/llaab"
readonly log_file="$logs_dir/repair-all.log"
readonly sentinel_file="/tmp/llaab-dev-refreshing"
readonly client_cache_dir="$repo_dir/apps/client/node_modules/.vite"
readonly client_persistent_dir="$repo_dir/apps/client/.persistent"

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$logs_dir"
exec > >(tee -a "$log_file") 2>&1

echo ""
echo "=========================================="
echo "repair-all started at $(date)"
echo "node: $(command -v node 2>/dev/null || echo 'NOT FOUND')"
echo "pnpm: $(command -v pnpm 2>/dev/null || echo 'NOT FOUND')"
echo "bun: $(command -v bun 2>/dev/null || echo 'NOT FOUND')"
echo "=========================================="

touch "$sentinel_file"
trap 'rm -f "$sentinel_file"; echo "repair sentinel removed at $(date)"' EXIT

/usr/bin/open "swiftbar://refreshPlugin?name=llaab.15s.sh" >/dev/null 2>&1 || true

cd "$repo_dir"

echo "[repair-all] Stopping launchd services..."
"$service_script" stop || true
sleep 2

echo "[repair-all] Clearing local client runtime caches..."
rm -rf "$client_cache_dir"
rm -rf "$client_persistent_dir/builds" "$client_persistent_dir/current"
mkdir -p "$client_persistent_dir/builds"

echo "[repair-all] Verifying dependencies..."
pnpm install --frozen-lockfile

echo "[repair-all] Building runtime workspace packages..."
pnpm turbo run build \
  --filter="@llaab/skills..." \
  --filter="@llaab/ingestion..." \
  --filter="@llaab/llm..." \
  --filter="@llaab/core..." \
  --filter="@llaab/control..." \
  --filter="@llaab/schemas..."

echo "[repair-all] Starting launchd services..."
"$service_script" start

echo "[repair-all] Service status:"
"$service_script" status

echo "repair-all complete at $(date)"
