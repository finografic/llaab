#!/bin/zsh

set -euo pipefail

readonly server_label="com.llaab.server"
readonly client_label="com.llaab.client"
readonly launch_agents_dir="$HOME/Library/LaunchAgents"
readonly server_plist="$launch_agents_dir/$server_label.plist"
readonly client_plist="$launch_agents_dir/$client_label.plist"
readonly server_url="http://127.0.0.1:3000"
readonly client_url="http://llaab.localhost:4321"

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
}

stop_services() {
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

  if curl --silent --fail --max-time 2 "$server_url/api/llm/status" >/dev/null; then
    server_state="running"
  fi

  if curl --silent --fail --max-time 2 "$client_url" >/dev/null; then
    client_state="running"
  fi

  printf 'server=%s\nclient=%s\n' "$server_state" "$client_state"
}

open_ui() {
  open "$client_url"
}

open_ingest() {
  open "$client_url/ingest"
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
  *)
    echo "usage: $0 {start|stop|restart|status|open|open-ingest}" >&2
    exit 1
    ;;
esac
