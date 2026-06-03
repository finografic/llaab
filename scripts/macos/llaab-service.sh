#!/bin/zsh

set -euo pipefail

readonly server_label="com.llaab.server"
readonly client_label="com.llaab.client"
readonly icons_label="com.llaab.icons"
readonly launch_agents_dir="$HOME/Library/LaunchAgents"
readonly script_dir="/Users/justin/LLAAB/scripts/macos"
readonly server_plist="$launch_agents_dir/$server_label.plist"
readonly client_plist="$launch_agents_dir/$client_label.plist"
readonly icons_plist="$launch_agents_dir/$icons_label.plist"
readonly server_url="http://127.0.0.1:3000"
readonly client_url="http://llaab.localhost:4321"
readonly icons_url="http://localhost:5199"

label_exists() {
  launchctl print "gui/$UID/$1" >/dev/null 2>&1
}

bootstrap_label() {
  local label="$1"
  local plist="$2"

  if label_exists "$label"; then
    launchctl bootout "gui/$UID/$label" >/dev/null 2>&1 || true
  fi

  launchctl bootstrap "gui/$UID" "$plist"
}

start_services() {
  bootstrap_label "$server_label" "$server_plist"
  bootstrap_label "$client_label" "$client_plist"
  bootstrap_label "$icons_label" "$icons_plist"
}

stop_services() {
  launchctl bootout "gui/$UID/$icons_label" >/dev/null 2>&1 || true
  launchctl bootout "gui/$UID/$client_label" >/dev/null 2>&1 || true
  launchctl bootout "gui/$UID/$server_label" >/dev/null 2>&1 || true
}

restart_services() {
  stop_services
  start_services
}

print_status() {
  local server_state="stopped"
  local client_state="stopped"
  local icons_state="stopped"

  if curl --silent --fail --max-time 2 "$server_url/api/llm/status" >/dev/null; then
    server_state="running"
  fi

  if curl --silent --output /dev/null --max-time 2 "$client_url"; then
    client_state="running"
  fi

  if curl --silent --output /dev/null --max-time 2 "$icons_url"; then
    icons_state="running"
  fi

  printf 'server=%s\nclient=%s\nicons=%s\n' "$server_state" "$client_state" "$icons_state"
}

open_ui() {
  open "$client_url"
}

open_ingest() {
  open "$client_url/ingest"
}

open_icons() {
  open "http://localhost:5199/"
}

repair_client() {
  "$script_dir/repair-persistent-client.sh"
}

case "${1:-}" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  status)
    print_status
    ;;
  open)
    open_ui
    ;;
  open-ingest)
    open_ingest
    ;;
  open-icons)
    open_icons
    ;;
  repair-client)
    repair_client
    ;;
  *)
    echo "usage: $0 {start|stop|restart|status|open|open-ingest|open-icons|repair-client}" >&2
    exit 1
    ;;
esac
