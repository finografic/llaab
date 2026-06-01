#!/bin/zsh
# <xbar.title>LLAAB</xbar.title>
# <xbar.version>v0.1.0</xbar.version>
# <xbar.author>Justin Rankin</xbar.author>
# <xbar.author.github>finografic</xbar.author.github>
# <xbar.desc>Persistent local control for the LLAAB client and API services.</xbar.desc>
# <xbar.dependencies>zsh,curl</xbar.dependencies>
# <xbar.abouturl>http://llaab.localhost:4321</xbar.abouturl>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>

set -euo pipefail

readonly control_script="/Users/justin/LLAAB/scripts/macos/llaab-service.sh"
readonly logs_dir="/Users/justin/Library/Logs/llaab"
readonly client_log="$logs_dir/client.stdout.log"
readonly server_log="$logs_dir/server.stdout.log"
readonly app_url="http://llaab.localhost:4321"
readonly ingest_url="http://llaab.localhost:4321/ingest"
readonly icons_url="http://localhost:5199/"
readonly github_url="https://github.com/finografic"

status_output="$("$control_script" status)"
server_state="$(printf '%s\n' "$status_output" | awk -F= '/^server=/{print $2}')"
client_state="$(printf '%s\n' "$status_output" | awk -F= '/^client=/{print $2}')"

if [[ "$server_state" == "running" && "$client_state" == "running" ]]; then
  echo "🌱 LLAAB | color=#52c41a tooltip=$app_url"
else
  echo "🌱 LLAAB | color=#ff7875 tooltip=$app_url"
fi

echo "---"
echo "Open App | href=$app_url shortcut=CMD+SHIFT+L"
echo "Open Ingest | href=$ingest_url shortcut=CMD+SHIFT+I"
echo "Open Icons | href=$icons_url"
echo "---"
echo "Start Services | bash=$control_script param1=start terminal=false refresh=true"
echo "Restart Services | bash=$control_script param1=restart terminal=false refresh=true"
echo "Stop Services | bash=$control_script param1=stop terminal=false refresh=true"
echo "---"
echo "Server: $server_state"
echo "Client: $client_state"
echo "---"
echo "Local URL: $app_url | href=$app_url"
echo "GitHub: finografic | href=$github_url"
echo "---"
echo "Tail Server Log | bash=/usr/bin/open param1=-a param2=Console param3=$server_log terminal=false"
echo "Tail Client Log | bash=/usr/bin/open param1=-a param2=Console param3=$client_log terminal=false"
