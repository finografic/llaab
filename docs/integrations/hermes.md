# Hermes — Mac Studio operator gateway

> **Status:** Installed 2026-06-25 on Mac Studio. Discord gateway and LLAAB MCP
> read/capture tools are working from **LLAAB Private**.

Hermes is a **separate long-running process** on the Mac Studio — not part of `apps/server`.
It provides a phone-operable Discord gateway to glm-5.2 (OpenCode Go) with local tools.

**Secrets live only in `~/.hermes/.env`** — never commit tokens or paste them into this doc.

---

## Paths

| Path                                    | Purpose                                             |
| --------------------------------------- | --------------------------------------------------- |
| `~/.hermes/config.yaml`                 | Behavior, providers, tools, Discord, agent defaults |
| `~/.hermes/.env`                        | API keys and Discord token                          |
| `~/.hermes/cron/`, `sessions/`, `logs/` | Runtime data                                        |
| `~/.hermes/hermes-agent`                | Hermes install / code checkout                      |

Config backup from setup: `~/.hermes/config.yaml.bak.20260625_205626`

---

## Model and provider

| Setting              | Value                                     |
| -------------------- | ----------------------------------------- |
| Provider             | **OpenCode Go**                           |
| Default model        | **glm-5.2**                               |
| Base URL             | `https://opencode.ai/zen/go/v1`           |
| API key env (Hermes) | `OPENCODE_GO_API_KEY` in `~/.hermes/.env` |

LLAAB repo root `.env` uses `OPENCODE_API_KEY` for other tooling — Hermes expects
`OPENCODE_GO_API_KEY` in its own `.env` (same key value, different var name).

Setup mode: **Full setup** (not Nous Portal Quick Setup).

---

## Agent defaults

Applied during `hermes setup` (customize later with `hermes setup agent`):

| Setting               | Value                                  |
| --------------------- | -------------------------------------- |
| Max iterations        | 150                                    |
| Tool progress         | all                                    |
| Compression threshold | 0.50                                   |
| Session reset         | never (manual `/reset` or compression) |

---

## Terminal backend

| Setting      | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| Backend      | **local** (shell on Mac Studio host)                                |
| Change later | `hermes setup terminal` or Docker when Discord shell use is trusted |

---

## Discord

| Setting         | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Application     | **LLAAB Agent** (Discord Developer Portal)                                                  |
| Server          | **LLAAB Private** (private guild)                                                           |
| Server nickname | **lab** (`@lab` mentions in `#general`)                                                     |
| Bot token       | `DISCORD_BOT_TOKEN` in `~/.hermes/.env`                                                     |
| Allowlist       | Single user ID `1089260734909223721` (real Mac Discord account — not `llaab_62288`)         |
| Home channel    | **Not set** — use `/set-home` in a channel or `hermes config set DISCORD_HOME_CHANNEL <id>` |
| Public Bot      | OFF after invite (private app; owner invited via temporary Public Bot ON)                   |
| Gateway service | SwiftBar-managed launchd service `com.llaab.hermes.gateway`                                 |

Intents required: **Message Content Intent** enabled on Bot tab.

---

## Telegram

| Setting         | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Bot             | **LLAAB Inbox**                                             |
| Bot token       | `TELEGRAM_BOT_TOKEN` in `~/.hermes/.env`                    |
| Allowlist       | Single owner Telegram user ID via `TELEGRAM_ALLOWED_USERS`  |
| Home channel    | Owner DM via `TELEGRAM_HOME_CHANNEL`                        |
| Mode            | Polling                                                     |
| Reactions       | `telegram.reactions: true` in `~/.hermes/config.yaml`       |
| Gateway service | SwiftBar-managed launchd service `com.llaab.hermes.gateway` |

Validated 2026-07-07:

- `python-telegram-bot[webhooks]==22.6` installed in Hermes' venv.
- Hermes gateway connects to Telegram and Discord together.
- `hermes send --to telegram ...` delivers to the configured owner DM.
- Telegram DM `Ping` reaches Hermes and receives a reply.

Validated 2026-07-08:

- Telegram reactions are enabled for the owner DM.
- Hermes applies `eyes` to the owner's message while processing.
- Hermes swaps the reaction to `thumbs up` on success or `thumbs down` on failure.
- Inbox drops receive one final explicit receipt message, such as
  `✅ Ingested YouTube video: electron-is-getting-replaced-deno-programming`.
- Telegram dropbox execution calls the deterministic inbox router and LLAAB API tooling directly.

`LLAAB_API_KEY` is configured in both repo `.env` and `~/.hermes/.env`; do not print or commit the
value.

---

## Tools enabled

Wizard configures **CLI** and **Discord** toolsets separately (browser/search prompts appear
twice — expected, not a loop).

### Enabled and configured

| Tool                 | Provider / notes                                                          |
| -------------------- | ------------------------------------------------------------------------- |
| Browser Automation   | **Local Browser** — headless Chromium                                     |
| Computer Use         | **cua-driver** 0.6.8 (background) — `/Users/justin/.local/bin/cua-driver` |
| Web Search           | **ddgs** (DuckDuckGo, no API key)                                         |
| Text-to-Speech       | **Edge TTS** (default; provider step skipped in wizard)                   |
| Vision               | Available via main multimodal provider                                    |
| Terminal / Commands  | On                                                                        |
| Task Planning (todo) | On                                                                        |
| Skills               | On                                                                        |

### Skipped / not configured

| Tool                | Notes                                           |
| ------------------- | ----------------------------------------------- |
| Image Generation    | Skipped — no FAL/OpenAI image key               |
| TTS provider wizard | Skipped — falls back to Edge                    |
| Mixture of Agents   | Needs `OPENROUTER_API_KEY`                      |
| Premium web extract | Firecrawl/Exa/Tavily etc. — ddgs is search-only |
| Skills Hub (GitHub) | Needs `GITHUB_TOKEN`                            |
| Context Engine      | Off                                             |
| MCP servers         | `llaab` scoped tools; see below                 |

### LLAAB MCP server

The repo MCP server is started with `lab mcp` and should stay narrow for inbox use.

Read/search tools:

- `vault_list`
- `vault_read`

Write tools:

- `vault_capture_idea`
- `vault_capture_inbox`
- `vault_ingest_youtube`
- `vault_pin_library`
- `vault_capture_todo`
- `vault_capture_web_link`
- `vault_capture_attachment`

The inbox write tools call existing LLAAB API endpoints with `LLAAB_API_KEY`. They do not expose
terminal, browser, arbitrary file writes, or shell execution.

Receipt and observability helpers live in `@llaab/core`:

- `createHermesInboxToolCall`
- `createHermesInboxReceipt`
- `createHermesInboxLogEvent`

The repo-side one-shot executor is:

```bash
lab inbox "https://youtu.be/..."
lab inbox "https://www.npmjs.com/package/zod"
lab inbox "todo: follow up on Hermes inbox"
lab inbox --attachmentPath /tmp/screenshot.png --attachmentName screenshot.png --attachmentMime image/png
```

Use `--json` when a gateway bridge needs the structured route, tool call, receipt, and log event.
Messaging bridges should prefer explicit options over positional text when attachments are present:

```bash
lab inbox \
  --platform telegram \
  --user "$TELEGRAM_USER_ID" \
  --chat "$TELEGRAM_CHAT_ID" \
  --message "$TELEGRAM_MESSAGE_ID" \
  --rawText "$CAPTION" \
  --attachmentPath "$CACHED_PATH" \
  --attachmentName "$FILENAME" \
  --attachmentMime "$MIME_TYPE" \
  --attachmentKind image \
  --attachmentSize "$SIZE_BYTES"
```

The local Telegram bridge in `~/.hermes/hermes-agent/gateway/platforms/base.py` intercepts owner DMs
before normal agent handling when the message is a supported bare inbox item (`todo:`, URL, `npx`,
`npmx`) or contains cached Telegram media. Set `LLAAB_TELEGRAM_INBOX_BRIDGE=0` in `~/.hermes/.env`
to disable that bypass. Attachment binaries stay in Hermes' local media cache for now; LLAAB stores
the cached path plus filename, MIME type, size, source message id, chat id, user id, and timestamp.

Telegram inbox UX contract:

1. Hermes uses the platform default lifecycle reactions on the user's original message.
2. `eyes` means the drop was received and is being processed.
3. `thumbs up` means the route finished successfully; `thumbs down` means the route failed.
4. Hermes sends exactly one final receipt message with the result and target id/title.
5. The bridge does not send an intermediate `Received...` message.

Validated 2026-07-07:

- `lab inbox "todo: ..."` creates a real inbox todo node through the API.
- `lab inbox "https://www.npmjs.com/package/zod"` pins the npm package.
- Telegram DM `todo: ...` creates a vault todo node and returns a short receipt.
- Telegram DM npm package links pin libraries and return a short receipt.
- `lab inbox --attachmentPath ...` routes screenshots/files to `vault_capture_attachment`.
- Duplicate npm pin attempts return an idempotent already-pinned receipt.
- MCP write tools can read `LLAAB_API_KEY` from local env files when the process env omits it.

Validated 2026-07-08:

- Telegram DM YouTube links start the existing ingest pipeline.
- Telegram DM YouTube receipts return after ingest completion without timing out.
- Telegram reaction flow shows `eyes` while running and `thumbs up` after success.

---

## Computer Use (cua-driver)

Installed during setup. macOS permissions may still be required:

```bash
cua-driver permissions status
cua-driver permissions grant   # launches CuaDriver for TCC dialogs
```

System Settings → Privacy & Security → **Accessibility** and **Screen Recording** for CuaDriver /
Hermes as needed.

---

## Operational commands

```bash
hermes doctor              # diagnose
hermes                     # CLI chat (smoke test)
hermes gateway             # Discord gateway (foreground)
hermes gateway install     # launchd background service (after smoke test)
hermes setup model         # change model/provider
hermes setup gateway       # reconfigure Discord
hermes setup tools         # tool providers
hermes config              # view settings
```

Reload shell after first install: `source ~/.zshrc`

LLAAB SwiftBar also manages the gateway through `scripts/macos/llaab-service.sh`:

```bash
scripts/macos/llaab-service.sh start-hermes
scripts/macos/llaab-service.sh stop-hermes
scripts/macos/llaab-service.sh restart-hermes
```

SwiftBar starts the launchd wrapper with stdout/stderr under `~/Library/Logs/llaab/`, but the
useful runtime log is Hermes' own `~/.hermes/logs/gateway.log`.

---

## Doctor Snapshot — 2026-06-25

`hermes doctor` is usable and mostly healthy. The current result has no blocking install issues for
basic CLI testing.

Phase 1 CLI one-shot also works:

```bash
hermes --oneshot "Answer in two short bullet points: 1. What model/provider are you using? 2. Name five available tools you can use."
```

Observed response:

```text
• Model: glm-5.2 via opencode-go
• Tools: terminal, read_file, write_file, patch, web_search
```

Ollama fallback is available locally. `ollama list` reports multiple installed models, including
`gemma4:12b-mlx`, `qwen3.6:35b-a3b-q4_K_M`, `qwen3.6:27b-mlx`,
`gemma4:26b-a4b-it-qat`, `gemma4:e4b-it-qat`, `llama3.2:3b`, and `gpt-oss:20b`.

### Green checks

- Security advisories: none active.
- MCP server security: no suspicious MCP stdio commands.
- Python environment: Python 3.11.15, virtual environment active, version files consistent.
- SSL / CA certificates: valid.
- Required core packages: installed.
- Config files: `~/.hermes/.env` and `~/.hermes/config.yaml` exist; config is up to date.
- Command installation: venv entry point and `~/.local/bin/hermes` exist.
- External tools: `git`, `rg`, Docker, Node.js, agent-browser, Playwright Chromium, browser-tools,
  and UI-TARS workspace deps are available.
- API connectivity: OpenCode Go key is configured.
- Core tools available: browser, clarify, code execution, computer use, terminal, delegation,
  Discord, Discord admin, file, memory, session search, skills, todo, TTS, and web.
- Memory provider: built-in memory active.
- `hermes config check` shows `OPENCODE_GO_API_KEY`, `DISCORD_BOT_TOKEN`, and
  `DISCORD_ALLOWED_USERS` configured; `GATEWAY_ALLOW_ALL_USERS` and `DISCORD_ALLOW_ALL_USERS` are
  unset.

### Warnings / optional gaps

- `python-telegram-bot` and `discord.py` are optional and not installed.
- Nous Portal, OpenAI Codex, MiniMax, and xAI OAuth are not logged in; this is okay for OpenCode Go
  first-run testing.
- OpenRouter API is not configured.
- Several optional tools are unavailable because provider keys or system dependencies are missing
  (`image_gen`, `moa`, video, X search, Spotify, Skills Hub GitHub token, and similar extras).
- Doctor reports one issue: run `hermes setup` to configure missing API keys for full tool access.

Interpretation: proceed to Discord gateway testing. Do not chase optional provider keys until
Discord gateway and read-only LLAAB MCP are confirmed.

---

## Security posture

- Discord allowlist: single user ID only
- `approvals.mode`: manual (stricter than smart)
- Do not set `GATEWAY_ALLOW_ALL_USERS`
- Bot on private server only
- Terminal backend **local** — treat Discord shell access carefully until Docker backend

---

## Gateway Test — 2026-06-25

Foreground gateway command:

```bash
hermes gateway run
```

Initial result: Hermes starts the gateway process, but Discord connection failed before any message
test.

```text
discord.errors.LoginFailure: Improper token has been passed.
```

Token shape check without printing the secret:

- `DISCORD_BOT_TOKEN` exists in `~/.hermes/.env`.
- It is not quoted.
- It does not start with the `Bot` prefix.
- It contains no whitespace.
- It is not an obvious placeholder.

Resolution: reset / re-copy the bot token from Discord Developer Portal → Application
**LLAAB Agent** → Bot → Reset Token, update `~/.hermes/.env`, then rerun `hermes gateway run`.

Follow-up result: after reauthorizing the bot and enabling **Message Content Intent**, Discord
mentions work in `#general`:

```text
@lab hello
```

Hermes replies in a thread. Plain unmentioned channel messages are ignored because
`discord.require_mention` is enabled.

---

## LLAAB MCP Integration

Working read-only config in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  llaab:
    command: /Users/justin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
    args:
      - /Users/justin/LLAAB/packages/cli/dist/index.js
      - mcp
    env:
      LLAAB_VAULT: /Users/justin/LLAAB/vault
    tools:
      include:
        - vault_list
        - vault_read

platform_toolsets:
  discord:
    - llaab
```

Use the built Node CLI for Hermes MCP. `bun packages/cli/src/index.ts mcp` starts standalone, but
Hermes' Python MCP client hangs during `initialize` when it launches the Bun process.

Validated:

- `hermes mcp test llaab` connects and discovers 3 tools.
- Discord query `list 3 LLAAB vault nodes` returns vault nodes through the gateway.
- Discord `capture idea: ...` creates raw LLAAB `idea` nodes through `vault_capture_idea`.
- Discord tool surface is restricted to `llaab`; broad terminal/file/browser/search tools are not enabled.

Next: extend write tools (ingest, capture idea) only after the read-only path stays stable.

Hermes remains a **consumer** of LLAAB vault via MCP — canonical memory stays in LLAAB.
