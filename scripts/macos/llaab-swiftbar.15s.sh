#!/bin/zsh
# <xbar.title>LLAAB</xbar.title>
# <xbar.version>v0.2.0</xbar.version>
# <xbar.author>Justin Rankin</xbar.author>
# <xbar.author.github>finografic</xbar.author.github>
# <xbar.desc>Persistent local control for the LLAAB client and API services.</xbar.desc>
# <xbar.dependencies>zsh,curl</xbar.dependencies>
# <xbar.abouturl>http://llaab.localhost:4321</xbar.abouturl>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>

set -euo pipefail

readonly control_script="/Users/justin/LLAAB/scripts/macos/llaab-service.sh"
readonly dev_refresh_script="/Users/justin/LLAAB/scripts/macos/dev-refresh.sh"
readonly logs_dir="/Users/justin/Library/Logs/llaab"
readonly client_log="$logs_dir/client.stdout.log"
readonly icons_log="$logs_dir/icons.stdout.log"
readonly server_log="$logs_dir/server.stdout.log"
readonly app_url="http://llaab.localhost:4321"
readonly ingest_url="http://llaab.localhost:4321/ingest"
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

process.stdout.write(`http://${host}:${port}/`);
NODE
)"
readonly github_url="https://github.com/finografic"

status_output="$("$control_script" status)"
server_state="$(printf '%s\n' "$status_output" | awk -F= '/^server=/{print $2}')"
client_state="$(printf '%s\n' "$status_output" | awk -F= '/^client=/{print $2}')"
icons_state="$(printf '%s\n' "$status_output"  | awk -F= '/^icons=/{print $2}')"

# While a dev refresh is in progress, show server and client as launching (yellow)
# regardless of current launchctl state — file is written by dev-refresh.sh and
# removed on exit; stale sentinels older than 15 min are ignored.
if [[ -n "$(find /tmp/llaab-dev-refreshing -maxdepth 0 -mmin -15 -type f 2>/dev/null)" ]]; then
  server_state="launching"
  client_state="launching"
fi

traffic_light() {
  case "$1" in
    running)   printf '🟢' ;;
    launching) printf '🟡' ;;
    *)         printf '⚫' ;;
  esac
}

# Menubar icon: green when all running, amber when any launching, dim otherwise
if [[ "$server_state" == "running" && "$client_state" == "running" && "$icons_state" == "running" ]]; then
  echo "🌱 LLAAB | color=#52c41a tooltip=$app_url"
elif [[ "$server_state" == "launching" || "$client_state" == "launching" || "$icons_state" == "launching" ]]; then
  echo "🌱 LLAAB | color=#faad14 tooltip=$app_url"
else
  echo "🌱 LLAAB | color=#8c8c8c tooltip=$app_url"
fi

echo "---"
echo "Open App | href=$app_url shortcut=CMD+SHIFT+L"
echo "Open Ingest | href=$ingest_url shortcut=CMD+SHIFT+I"
echo "Open Icons | href=$icons_url"

echo "---"

# ── LLAAB Server ──────────────────────────────────────────────
echo "$(traffic_light "$server_state") LLAAB Server: $server_state"
if [[ "$server_state" == "stopped" ]]; then
  echo "-- Start Service | bash=$control_script param1=start-server terminal=false refresh=true"
  echo "-- Stop Service | color=#6b7280"
else
  echo "-- Start Service | color=#6b7280"
  echo "-- Stop Service | bash=$control_script param1=stop-server terminal=false refresh=true"
fi

# ── LLAAB Client ──────────────────────────────────────────────
echo "$(traffic_light "$client_state") LLAAB Client: $client_state"
if [[ "$client_state" == "stopped" ]]; then
  echo "-- Start Service | bash=$control_script param1=start-client terminal=false refresh=true"
  echo "-- Stop Service | color=#6b7280"
  echo "-- Repair Client | bash=$control_script param1=repair-client terminal=false refresh=true"
else
  echo "-- Start Service | color=#6b7280"
  echo "-- Stop Service | bash=$control_script param1=stop-client terminal=false refresh=true"
  echo "-- Repair Client | bash=$control_script param1=repair-client terminal=false refresh=true"
fi

# ── Icons ──────────────────────────────────────────────────────
echo "$(traffic_light "$icons_state") Icons: $icons_state"
if [[ "$icons_state" == "stopped" ]]; then
  echo "-- Start Service | bash=$control_script param1=start-icons terminal=false refresh=true"
  echo "-- Stop Service | color=#6b7280"
else
  echo "-- Start Service | color=#6b7280"
  echo "-- Stop Service | bash=$control_script param1=stop-icons terminal=false refresh=true"
  echo "-- Restart Icons | bash=$control_script param1=restart-icons terminal=false refresh=true"
fi

echo "---"
echo "Start All Services | bash=$control_script param1=start terminal=false refresh=true"
echo "Stop All Services | bash=$control_script param1=stop terminal=false refresh=true"
echo "---"
echo "Restart All Services | bash=$control_script param1=restart terminal=false refresh=true"
echo "Dev Refresh | bash=$dev_refresh_script terminal=false refresh=true"
echo "---"
echo "Local URL: $app_url | href=$app_url"
echo "GitHub: finografic | href=$github_url"
echo "---"
echo "Tail Server Log | bash=/usr/bin/open param1=-a param2=Console param3=$server_log terminal=false"
echo "Tail Client Log | bash=/usr/bin/open param1=-a param2=Console param3=$client_log terminal=false"
echo "Tail Icons Log | bash=/usr/bin/open param1=-a param2=Console param3=$icons_log terminal=false"
