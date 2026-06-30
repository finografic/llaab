#!/bin/zsh

set -euo pipefail

export PATH="/Users/justin/.bun/bin:/Users/justin/.nvm/versions/node/v24.16.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

readonly client_label="com.llaab.client"
readonly client_plist="$HOME/Library/LaunchAgents/$client_label.plist"
readonly client_url="http://llaab.localhost:5050"
readonly wait_seconds=90

label_exists() {
  launchctl print "gui/$UID/$1" >/dev/null 2>&1
}

restart_client() {
  if label_exists "$client_label"; then
    # bootout + bootstrap ensures updated plist/script changes are picked up.
    # kickstart -k reuses the cached plist and won't reflect script changes.
    launchctl bootout "gui/$UID/$client_label" || true
    sleep 1
  fi

  launchctl bootstrap "gui/$UID" "$client_plist"
}

wait_for_client() {
  local attempt

  for (( attempt = 1; attempt <= wait_seconds; attempt++ )); do
    if curl --silent --output /dev/null --max-time 2 "$client_url"; then
      echo "[repair-client] Client healthy at $client_url"
      return 0
    fi

    sleep 1
  done

  echo "[repair-client] Client did not become healthy within ${wait_seconds}s" >&2
  tail -n 80 "$HOME/Library/Logs/llaab/client.stderr.log" >&2 || true
  return 1
}

echo "[repair-client] Restarting persistent client..."
restart_client
wait_for_client
