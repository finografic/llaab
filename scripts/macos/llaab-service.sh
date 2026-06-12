#!/bin/zsh

set -euo pipefail

readonly server_label="com.llaab.server"
readonly client_label="com.llaab.client"
readonly icons_label="com.llaab.icons"
readonly launch_agents_dir="$HOME/Library/LaunchAgents"
readonly script_dir="/Users/justin/LLAAB/scripts/macos"
readonly logs_dir="$HOME/Library/Logs/llaab"
readonly server_plist="$launch_agents_dir/$server_label.plist"
readonly client_plist="$launch_agents_dir/$client_label.plist"
readonly icons_plist="$launch_agents_dir/$icons_label.plist"
readonly client_log="$logs_dir/client.stdout.log"
readonly server_url="http://127.0.0.1:8888"
readonly client_url="http://llaab.localhost:3000"
readonly icons_url="$(
  /Users/justin/.nvm/versions/node/v24.3.0/bin/node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const configPath = '/Users/justin/LLAAB/packages/icons/lucide-manager.config.json';
const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
const port = raw?.manager?.server?.port ?? 5199;
const configuredHost = raw?.manager?.server?.host;
const host =
  configuredHost && configuredHost !== '0.0.0.0' && configuredHost !== '::' && configuredHost !== '::1'
    ? configuredHost
    : 'localhost';

process.stdout.write(`http://${host}:${port}`);
NODE
)"

label_exists() {
  launchctl print "gui/$UID/$1" >/dev/null 2>&1
}

bootstrap_label() {
  local label="$1"
  local plist="$2"

  if label_exists "$label"; then
    launchctl bootout "gui/$UID/$label" >/dev/null 2>&1 || true
    # bootout is async — wait until the label is fully gone before bootstrapping
    local attempts=0
    while label_exists "$label" && (( attempts < 25 )); do
      sleep 0.2
      (( attempts++ ))
    done
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

restart_icons() {
  if label_exists "$icons_label"; then
    launchctl kickstart -k "gui/$UID/$icons_label"
  else
    launchctl bootstrap "gui/$UID" "$icons_plist"
  fi
  wait_for_url "$icons_url" "" 45
}

wait_for_url() {
  local url="$1"
  local curl_flag="$2"  # "--fail" for API endpoints, "" for plain reachability
  local max_attempts="${3:-30}"
  local attempt

  for (( attempt = 1; attempt <= max_attempts; attempt++ )); do
    if curl --silent $curl_flag --output /dev/null --max-time 1 "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 0  # time out gracefully so SwiftBar still refreshes
}

start_server() {
  bootstrap_label "$server_label" "$server_plist"
  wait_for_url "$server_url/api/llm/status" "--fail" 30
}

stop_server()  { launchctl bootout "gui/$UID/$server_label" >/dev/null 2>&1 || true; }

start_client() {
  bootstrap_label "$client_label" "$client_plist"
  wait_for_url "$client_url" "" 60
}

stop_client()  { launchctl bootout "gui/$UID/$client_label" >/dev/null 2>&1 || true; }

start_icons()  {
  bootstrap_label "$icons_label" "$icons_plist"
  wait_for_url "$icons_url" "" 30
}

stop_icons()   { launchctl bootout "gui/$UID/$icons_label" >/dev/null 2>&1 || true; }

open_client_log() {
  /usr/bin/open -a Console "$client_log"
}

service_state() {
  local label="$1"
  local url="$2"
  local curl_flag="$3"  # "--fail" for API endpoints, "" for plain reachability

  local pid
  pid="$(launchctl list 2>/dev/null | awk -v lbl="$label" '$3 == lbl {print $1}')"

  if [[ -z "$pid" || "$pid" == "-" ]]; then
    echo "stopped"
    return
  fi

  if curl --silent $curl_flag --output /dev/null --max-time 1 "$url" 2>/dev/null; then
    echo "running"
  else
    echo "launching"
  fi
}

print_status() {
  local server_state client_state icons_state
  server_state="$(service_state "$server_label" "$server_url/api/llm/status" "--fail")"
  client_state="$(service_state "$client_label" "$client_url" "")"
  icons_state="$(service_state  "$icons_label"  "$icons_url" "")"

  printf 'server=%s\nclient=%s\nicons=%s\n' "$server_state" "$client_state" "$icons_state"
}

open_ui() {
  open "$client_url"
}

open_ingest() {
  open "$client_url/ingest"
}

open_icons() {
  open "$icons_url/"
}

repair_client() {
  "$script_dir/repair-persistent-client.sh"
}

restart_services_with_client_log() {
  open_client_log
  restart_services
}

repair_client_with_log() {
  open_client_log
  repair_client
}

case "${1:-}" in
  start)          start_services ;;
  stop)           stop_services ;;
  restart)        restart_services_with_client_log ;;
  restart-icons)  restart_icons ;;
  start-server)   start_server ;;
  stop-server)    stop_server ;;
  start-client)   start_client ;;
  stop-client)    stop_client ;;
  start-icons)    start_icons ;;
  stop-icons)     stop_icons ;;
  status)         print_status ;;
  open)           open_ui ;;
  open-ingest)    open_ingest ;;
  open-icons)     open_icons ;;
  repair-client)  repair_client_with_log ;;
  *)
    echo "usage: $0 {start|stop|restart|restart-icons|start-server|stop-server|start-client|stop-client|start-icons|stop-icons|status|open|open-ingest|open-icons|repair-client}" >&2
    exit 1
    ;;
esac
