# TODO — Hermes Layer (Discord → MCP → LLAAB)

> **Status:** Not started (2026-06-24). Phase 1 is install + CLI smoke test — in progress on Mac
> Studio.

## Goal

Stand up a **phone-operable Hermes gateway** on the Mac Studio that can reason over LLAAB vault
content and (later) trigger ingestion, capture ideas, and report status — without making Hermes
the canonical memory store.

Target flow:

```text
iPhone (Discord DM) → Hermes gateway (Mac Studio) → OpenCode Go / Ollama
                    → LLAAB MCP server → vault read + LLAAB API writes
```

## Related docs

| Doc                                                                            | Role                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [`TOOL_LANDSCAPE_COMPARISON.md`](./TOOL_LANDSCAPE_COMPARISON.md)               | Why Hermes fits LLAAB (MCP consumer, skill bridge)                          |
| [`TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md) | Later: `agent.run --executor hermes` one-shot adapter                       |
| [`TODO_ADAPTERS.md`](./TODO_ADAPTERS.md)                                       | Adapter boundary — LLAAB owns vault; Hermes owns execution                  |
| [`DONE_ORCHESTRATION.md`](./DONE_ORCHESTRATION.md)                             | Command bus, RunNodes, capability routing (Hermes adapter is Phase 3 there) |
| `~/Downloads/hermes-llaab-setup-guide.md`                                      | Source brief (security, MCP tool sketches, Discord wiring)                  |

## Constraints

- **LLAAB agent-execution rule still applies to `apps/server`:** no always-on LLM workers inside
  the Bun server. Hermes gateway is a **separate process** (like Ollama or the Vite dev server).
- **Secrets in env files only** — never commit `~/.hermes/.env` or paste keys into `config.yaml`.
- **Start read-only** on MCP tools; add write tools only after CLI + Discord smoke tests pass.
- **Use LLAAB env naming:** `LLAAB_API_URL`, `LLAAB_API_KEY`, `OPENCODE_API_KEY` (not `SERVER_*`).
- **Primary cloud model:** OpenCode Go via `OPENCODE_API_KEY` (already in repo root `.env`). Do
  not default to Anthropic unless explicitly added later for a reason-tier task.

## Architecture

| Layer                        | Responsibility                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Hermes                       | Gateway, model routing, Discord, tool orchestration                                     |
| `llaab mcp` (`packages/cli`) | MCP tools over stdio — vault read today; extended tools in Phase 4                      |
| `apps/server` (:8888)        | Write paths that already exist (ingest, node create) — MCP calls via HTTP + `X-API-Key` |
| `@llaab/core`                | Fast vault reads without server (list, read, search)                                    |

**Hybrid MCP boundary (recommended):** reads via `@llaab/core`; writes via
`POST` to `LLAAB_API_URL` with `LLAAB_API_KEY` when the server must run a pipeline.

---

## Phase 1 — Hermes install and CLI smoke test

**You are here.** First-time Hermes setup on Mac Studio.

### 1.1 Wizard choice (do this now)

At **“How would you like to set up Hermes?”** choose:

| Option                    | Use?    | Why                                                         |
| ------------------------- | ------- | ----------------------------------------------------------- |
| Quick Setup (Nous Portal) | **No**  | OAuth + Nous models — bypasses your OpenCode Go account     |
| **Full setup**            | **Yes** | Bring your own keys; enable OpenCode Go + Ollama explicitly |
| Blank Slate               | No      | Everything off — extra manual work with no benefit          |

### 1.2 Install and verify

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup          # Full setup
hermes doctor
```

### 1.3 Secrets — `~/.hermes/.env`

Copy from repo root `.env` where applicable. Hermes reads its **own** env file, not LLAAB's.

```bash
# Cloud (primary) — OpenCode Go OpenAI-compatible API
OPENCODE_API_KEY=...

# Local fallback (free, private)
# Ollama must be running; Hermes auto-discovers models

# Optional later — Phase 2
# DISCORD_BOT_TOKEN=...
# DISCORD_ALLOWED_USERS=your-discord-user-id
```

Do **not** put `LLAAB_API_KEY` in Hermes config until Phase 3 MCP wiring (MCP child process env,
not Hermes model env).

### 1.4 Model routing — `~/.hermes/config.yaml`

Aim for OpenCode Go primary, Ollama fallback. Exact provider ids depend on wizard output — run
`hermes doctor` and note listed providers. Target shape:

```yaml
providers:
  ollama:
    enabled: true
  opencode-go:          # name may vary — check doctor output
    enabled: true
    # API key from OPENCODE_API_KEY in ~/.hermes/.env

agents:
  defaults:
    model:
      primary: "opencode-go/<model>"   # e.g. glm-5.2 per OpenCode Go catalog
      fallback: "ollama/<local-model>" # e.g. llama3:latest or your installed tag
```

Skip Anthropic during initial setup unless Full setup forces a choice — leave disabled.

### 1.5 Safety defaults (before Discord)

```yaml
approvals:
  mode: smart          # not "off"

terminal:
  backend: local       # docker later, once comfortable

gateway:
  platforms:
    discord:
      enabled: false   # enable in Phase 2
```

### 1.6 CLI smoke test

```bash
hermes
# > "What model are you using?"
# > "List your available tools."
```

- [ ] Full setup completed (not Nous Portal Quick Setup)
- [ ] `hermes doctor` passes
- [ ] `OPENCODE_API_KEY` set in `~/.hermes/.env`
- [ ] Ollama running with at least one model (`ollama list`)
- [ ] CLI session answers using OpenCode Go (or falls back to Ollama if cloud unavailable)
- [ ] `approvals.mode: smart` confirmed in config

**Exit criteria:** Hermes CLI works locally with OpenCode Go + Ollama before any Discord or MCP work.

---

## Phase 2 — Discord operator console

Private server only. Follow security checklist from the setup guide.

- [ ] Create Discord application + bot; enable **Message Content Intent** (silent failure if off)
- [ ] Turn off **Public Bot**; invite to private server only
- [ ] Set `DISCORD_BOT_TOKEN` and `DISCORD_ALLOWED_USERS` in `~/.hermes/.env`
- [ ] Enable Discord in `~/.hermes/config.yaml` with `allowed_users` allowlist
- [ ] `hermes gateway` — test from phone DM: “Hello, what model are you?”
- [ ] Confirm strangers cannot message the bot (no `GATEWAY_ALLOW_ALL_USERS`)

**Exit criteria:** Text DM from iPhone → Hermes reply on Mac Studio.

---

## Phase 3 — Connect existing LLAAB MCP (read-only)

No new MCP code yet — wire what exists today (`vault_list`, `vault_read`).

**Prerequisites:** LLAAB repo at `/Users/justin/LLAAB`; `pnpm dev:cli -- mcp` works standalone.

```bash
cd /Users/justin/LLAAB
pnpm dev:cli -- mcp   # should block on stdio; Ctrl+C to exit
```

Hermes MCP registration (adjust keys to match `hermes doctor` / docs):

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  llaab:
    command: "pnpm"
    args: ["dev:cli", "--", "mcp"]
    cwd: "/Users/justin/LLAAB"
    env:
      LLAAB_VAULT: "/Users/justin/LLAAB/vault"
    tools:
      include:
        - vault_list
        - vault_read
```

- [ ] MCP server starts from Hermes without stderr errors
- [ ] Hermes CLI: “List my LLAAB ideas” → calls `vault_list`
- [ ] Hermes CLI: “Read idea &lt;id&gt;” → calls `vault_read`
- [ ] Discord DM: same read queries work through gateway

**Exit criteria:** Hermes can list and read vault nodes from phone or CLI.

---

## Phase 4 — Extend MCP tools (hybrid read/write)

Implement tools sketched in the setup guide. Suggested order:

| Tool                   | Boundary                                                 | Needs server?         |
| ---------------------- | -------------------------------------------------------- | --------------------- |
| `vault_search`         | `@llaab/core` `listNodes`                                | No                    |
| `vault_status`         | core + `GET /api/llm/status`                             | Optional              |
| `vault_plan_next`      | read `ROADMAP.md`, `.agents/handoff.md`, `NEXT_STEPS.md` | No                    |
| `vault_capture_idea`   | `POST /api/vault/nodes`                                  | Yes + `LLAAB_API_KEY` |
| `vault_ingest_youtube` | `POST /api/ingest/youtube`                               | Yes + `LLAAB_API_KEY` |

MCP child env for write tools:

```yaml
env:
  LLAAB_VAULT: "/Users/justin/LLAAB/vault"
  LLAAB_API_URL: "http://localhost:8888"
  LLAAB_API_KEY: "..."   # from root .env — child process only, not committed
```

- [ ] Add `packages/cli/src/mcp/tools/` modules + register in `server.ts`
- [ ] Unit/smoke test each tool handler
- [ ] Expand Hermes `tools.include` incrementally (search → status → plan → capture → ingest)
- [ ] Manual: ingest a YouTube URL from Discord DM
- [ ] Manual: capture an idea from Discord DM

**Exit criteria:** Phone can ingest, capture ideas, and ask “what’s next on the roadmap?”

---

## Phase 5 — macOS persistence

- [ ] `~/Library/LaunchAgents/com.hermes.gateway.plist` (see setup guide template)
- [ ] `launchctl load` + reboot test
- [ ] Log paths: `/tmp/hermes-gateway.log`, `/tmp/hermes-gateway.err`
- [ ] Optional: fourth service in `scripts/macos/llaab-service.sh` alongside server/client/icons

**Exit criteria:** Gateway survives logout/reboot; LLAAB server still separate (`com.llaab.server`).

---

## Phase 6 — Terminal integration (deferred)

Cross-link only — implement when Phases 1–4 are stable.

See [`TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md) Phase 3:

- [ ] `agent.run --executor hermes --task ...` one-shot adapter
- [ ] Persist Hermes runs as `RunNode`s
- [ ] Stream progress to Terminal Panel

Hermes gateway remains **outside** `apps/server`; the terminal adapter shells out or HTTP-calls
Hermes for explicit one-shot tasks.

---

## Security checklist

| Rule                                           | Why                                             |
| ---------------------------------------------- | ----------------------------------------------- |
| Never `GATEWAY_ALLOW_ALL_USERS=true`           | Anyone with bot access runs tools on Mac Studio |
| `approvals.mode: smart` minimum                | Blocks prompt-injection shell commands          |
| Private Discord server + allowlist             | Public channels = injection surface             |
| MCP `tools.include` allowlist                  | Don’t expose ingest until trusted               |
| Keys in `.env` only                            | `config.yaml` is easier to share/version        |
| `terminal.backend: docker` when enabling shell | Sandbox risky commands (later)                  |

---

## Manual validation (end-to-end)

Run after Phase 4:

1. `hermes doctor` — all green
2. CLI: “LLAAB status” → node counts + server health
3. Discord: “ingest &lt;youtube-url&gt; tags agents, hermes”
4. Discord: “what’s next on the roadmap?”
5. Discord: “idea: …” → new idea node in vault
6. Confirm `apps/server` on :8888 was up for write tools; reads work with server down

---

## Non-goals (this plan)

- Rebuilding Hermes inside LLAAB
- Making Hermes the canonical vault or run store
- Always-on agent loop inside `apps/server`
- Exposing shell/terminal to Discord before Docker backend + smart approvals
- Anthropic as default cloud provider (OpenCode Go first)
