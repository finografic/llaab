#!/bin/zsh

set -euo pipefail

readonly server_label="com.llaab.server"
readonly client_label="com.llaab.client"
readonly icons_label="com.llaab.icons"
readonly lmstudio_label="com.lmstudio.server"
readonly hermes_gateway_label="com.llaab.hermes.gateway"
readonly launch_agents_dir="$HOME/Library/LaunchAgents"
readonly script_dir="${0:A:h}"
readonly repo_dir="${script_dir:h:h}"
readonly logs_dir="$HOME/Library/Logs/llaab"
readonly sentinel_file="/tmp/llaab-dev-refreshing"
readonly server_plist="$launch_agents_dir/$server_label.plist"
readonly client_plist="$launch_agents_dir/$client_label.plist"
readonly icons_plist="$launch_agents_dir/$icons_label.plist"
readonly lmstudio_plist="$launch_agents_dir/$lmstudio_label.plist"
readonly hermes_gateway_plist="$launch_agents_dir/$hermes_gateway_label.plist"
readonly lmstudio_bin="$HOME/.lmstudio/bin/lms"
readonly hermes_bin="$HOME/.local/bin/hermes"
readonly client_log="$logs_dir/client.stdout.log"
readonly hermes_gateway_log="$logs_dir/hermes-gateway.stdout.log"
readonly repair_log="$logs_dir/repair-all.log"
readonly server_url="http://127.0.0.1:8888"
readonly server_health_url="$server_url/"
readonly client_url="http://llaab.localhost:5050"
readonly lmstudio_url="http://127.0.0.1:1234/v1/models"
readonly icons_url="$(
  env LLAAB_ICONS_CONFIG="$repo_dir/packages/icons/lucide-manager.config.json" node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const configPath = process.env.LLAAB_ICONS_CONFIG;
if (!configPath) throw new Error('LLAAB_ICONS_CONFIG is required.');
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

  mkdir -p "$logs_dir"

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

ensure_client_plist_port() {
  if [[ -f "$client_plist" ]]; then
    /usr/bin/plutil -replace EnvironmentVariables.PORT -string 5050 "$client_plist"
  fi
}

ensure_lmstudio_plist() {
  mkdir -p "$launch_agents_dir" "$logs_dir"

  cat > "$lmstudio_plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$lmstudio_label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$lmstudio_bin</string>
    <string>server</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$logs_dir/lmstudio.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$logs_dir/lmstudio.stderr.log</string>
</dict>
</plist>
PLIST
}

start_services() {
  start_server
  start_client
  start_lmstudio
  start_hermes_gateway
  start_icons
}

stop_services() {
  stop_hermes_gateway
  launchctl bootout "gui/$UID/$icons_label" >/dev/null 2>&1 || true
  launchctl bootout "gui/$UID/$client_label" >/dev/null 2>&1 || true
  launchctl bootout "gui/$UID/$server_label" >/dev/null 2>&1 || true
  stop_lmstudio
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
  wait_for_url "$server_health_url" "--fail" 30
}

stop_server()  { launchctl bootout "gui/$UID/$server_label" >/dev/null 2>&1 || true; }

start_client() {
  ensure_client_plist_port
  bootstrap_label "$client_label" "$client_plist"
  wait_for_url "$client_url" "" 60
}

stop_client()  { launchctl bootout "gui/$UID/$client_label" >/dev/null 2>&1 || true; }

start_icons()  {
  bootstrap_label "$icons_label" "$icons_plist"
  wait_for_url "$icons_url" "" 30
}

stop_icons()   { launchctl bootout "gui/$UID/$icons_label" >/dev/null 2>&1 || true; }

start_lmstudio() {
  ensure_lmstudio_plist
  bootstrap_label "$lmstudio_label" "$lmstudio_plist"
  wait_for_url "$lmstudio_url" "--fail" 30
}

stop_lmstudio() {
  launchctl bootout "gui/$UID/$lmstudio_label" >/dev/null 2>&1 || true
  "$lmstudio_bin" server stop >/dev/null 2>&1 || true
}

ensure_hermes_gateway_plist() {
  mkdir -p "$launch_agents_dir" "$logs_dir"

  cat > "$hermes_gateway_plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$hermes_gateway_label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$hermes_bin</string>
    <string>gateway</string>
    <string>--accept-hooks</string>
    <string>run</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$repo_dir</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>HERMES_ACCEPT_HOOKS</key>
    <string>1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$logs_dir/hermes-gateway.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$logs_dir/hermes-gateway.stderr.log</string>
</dict>
</plist>
PLIST
}

start_hermes_gateway() {
  ensure_hermes_gateway_plist
  if "$hermes_bin" gateway status 2>/dev/null | grep -q 'Gateway is running'; then
    return
  fi
  bootstrap_label "$hermes_gateway_label" "$hermes_gateway_plist"
}

stop_hermes_gateway() {
  launchctl bootout "gui/$UID/$hermes_gateway_label" >/dev/null 2>&1 || true
  "$hermes_bin" gateway stop >/dev/null 2>&1 || true
}

restart_hermes_gateway() {
  stop_hermes_gateway
  start_hermes_gateway
}

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

service_state_url_first() {
  local label="$1"
  local url="$2"
  local curl_flag="$3"

  if curl --silent $curl_flag --output /dev/null --max-time 1 "$url" 2>/dev/null; then
    echo "running"
    return
  fi

  local pid
  pid="$(launchctl list 2>/dev/null | awk -v lbl="$label" '$3 == lbl {print $1}')"

  if [[ -z "$pid" || "$pid" == "-" ]]; then
    echo "stopped"
  else
    echo "launching"
  fi
}

print_status() {
  local server_state client_state icons_state lmstudio_state hermes_gateway_state
  lmstudio_state="$(service_state_url_first "$lmstudio_label" "$lmstudio_url" "--fail")"
  server_state="$(service_state "$server_label" "$server_health_url" "--fail")"
  client_state="$(service_state "$client_label" "$client_url" "")"
  icons_state="$(service_state  "$icons_label"  "$icons_url" "")"
  hermes_gateway_state="$(hermes_gateway_state)"

  printf 'lmstudio=%s\nserver=%s\nclient=%s\nhermes_gateway=%s\nicons=%s\n' "$lmstudio_state" "$server_state" "$client_state" "$hermes_gateway_state" "$icons_state"
}

hermes_gateway_state() {
  local pid
  pid="$(launchctl list 2>/dev/null | awk -v lbl="$hermes_gateway_label" '$3 == lbl {print $1}')"

  if [[ -n "$pid" && "$pid" != "-" ]]; then
    echo "running"
    return
  fi

  if "$hermes_bin" gateway status 2>/dev/null | grep -q 'Gateway is running'; then
    echo "running"
    return
  fi

  if [[ "$pid" == "-" ]]; then
    echo "launching"
  else
    echo "stopped"
  fi
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

repair_all() {
  mkdir -p "$logs_dir"
  touch "$repair_log"
  touch "$sentinel_file"
  /usr/bin/open -a Console "$repair_log"
  "$script_dir/repair-all-services.sh" >/dev/null 2>&1 &!
  /usr/bin/open "swiftbar://refreshPlugin?name=llaab.15s.sh" >/dev/null 2>&1 || true
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
  restart-hermes) restart_hermes_gateway ;;
  start-server)   start_server ;;
  stop-server)    stop_server ;;
  start-client)   start_client ;;
  stop-client)    stop_client ;;
  start-icons)    start_icons ;;
  stop-icons)     stop_icons ;;
  start-lmstudio) start_lmstudio ;;
  stop-lmstudio)  stop_lmstudio ;;
  start-hermes)   start_hermes_gateway ;;
  stop-hermes)    stop_hermes_gateway ;;
  status)         print_status ;;
  open)           open_ui ;;
  open-ingest)    open_ingest ;;
  open-icons)     open_icons ;;
  repair-client)  repair_client_with_log ;;
  repair-all)     repair_all ;;
  *)
    echo "usage: $0 {start|stop|restart|restart-icons|restart-hermes|start-server|stop-server|start-client|stop-client|start-icons|stop-icons|start-lmstudio|stop-lmstudio|start-hermes|stop-hermes|status|open|open-ingest|open-icons|repair-client|repair-all}" >&2
    exit 1
    ;;
esac
