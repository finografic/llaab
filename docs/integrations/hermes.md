# Hermes — Mac Studio operator gateway

> **Status:** Installed 2026-06-25 on Mac Studio. Phase 1–2 of
> [`TODO_HERMES_LAYER.md`](../todo/TODO_HERMES_LAYER.md) complete (setup wizard + Discord bot).
> LLAAB MCP not wired yet.

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
| Bot token       | `DISCORD_BOT_TOKEN` in `~/.hermes/.env`                                                     |
| Allowlist       | Single user ID `1089260734909223721` (real Mac Discord account — not `llaab_62288`)         |
| Home channel    | **Not set** — use `/set-home` in a channel or `hermes config set DISCORD_HOME_CHANNEL <id>` |
| Public Bot      | OFF after invite (private app; owner invited via temporary Public Bot ON)                   |
| Gateway service | **Not** launchd yet — run `hermes gateway` in foreground for testing                        |

Intents required: **Message Content Intent** enabled on Bot tab.

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

| Tool                | Notes                                             |
| ------------------- | ------------------------------------------------- |
| Image Generation    | Skipped — no FAL/OpenAI image key                 |
| TTS provider wizard | Skipped — falls back to Edge                      |
| Mixture of Agents   | Needs `OPENROUTER_API_KEY`                        |
| Premium web extract | Firecrawl/Exa/Tavily etc. — ddgs is search-only   |
| Skills Hub (GitHub) | Needs `GITHUB_TOKEN`                              |
| Context Engine      | Off                                               |
| MCP servers         | **Not yet** — Phase 3: wire `pnpm dev:cli -- mcp` |

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

## LLAAB integration (next)

See [`TODO_HERMES_LAYER.md`](../todo/TODO_HERMES_LAYER.md) Phase 3+:

1. Register LLAAB MCP in `~/.hermes/config.yaml` (`pnpm dev:cli -- mcp`, cwd `/Users/justin/LLAAB`)
2. MCP env: `LLAAB_VAULT`, `LLAAB_API_URL=http://localhost:8888`, `LLAAB_API_KEY`
3. Start read-only: `vault_list`, `vault_read`
4. Extend write tools (ingest, capture idea) after smoke tests

Hermes remains a **consumer** of LLAAB vault via MCP — canonical memory stays in LLAAB.
