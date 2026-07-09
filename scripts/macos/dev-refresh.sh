#!/bin/zsh

readonly script_dir="${0:A:h}"
readonly repo_dir="${script_dir:h:h}"
readonly service_script="$repo_dir/scripts/macos/llaab-service.sh"
readonly sentinel_file="/tmp/llaab-dev-refreshing"
readonly log_dir="$HOME/Library/Logs/llaab"
readonly log_file="$log_dir/dev-refresh.log"

mkdir -p "$log_dir"

# SwiftBar runs with a minimal PATH — add Homebrew and the nvm node bin so pnpm works.
# pnpm at /opt/homebrew/bin/pnpm is a #!/usr/bin/env node script and needs node in PATH.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
_nvm_version="$(cat "$repo_dir/.nvmrc" 2>/dev/null | tr -d '[:space:]')"
_node_bin="$HOME/.nvm/versions/node/v${_nvm_version#v}/bin"
if [[ -d "$_node_bin" ]]; then
  export PATH="$_node_bin:$PATH"
fi
unset _nvm_version _node_bin

# Redirect all output to the log file
exec > >(tee -a "$log_file") 2>&1

set -euo pipefail
set -x

echo ""
echo "=========================================="
echo "dev-refresh started at $(date)"
echo "node: $(which node 2>/dev/null || echo 'NOT FOUND')"
echo "pnpm: $(which pnpm 2>/dev/null || echo 'NOT FOUND')"
echo "=========================================="

/usr/bin/open -a Console "$log_file"

touch "$sentinel_file"
trap 'rm -f "$sentinel_file"; echo "sentinel removed at $(date)"' EXIT

/usr/bin/open "swiftbar://refreshPlugin?name=llaab.15s.sh"

cd "$repo_dir"

echo "Building runtime workspace packages..."
pnpm turbo run build \
  --filter="@llaab/skills..." \
  --filter="@llaab/ingestion..." \
  --filter="@llaab/llm..." \
  --filter="@llaab/core..." \
  --filter="@llaab/control..." \
  --filter="@llaab/schemas..."

echo "Restarting server and client services..."
"$service_script" stop-client
"$service_script" stop-server
"$service_script" start-server
"$service_script" start-client

echo "LLAAB dev refresh complete at $(date)."
