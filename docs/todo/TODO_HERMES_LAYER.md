# TODO — Hermes Layer (Discord → MCP → LLAAB)

> **Status:** Phase 1–5 baseline complete. Hermes installed, OpenCode Go glm-5.2, Discord bot
> on **LLAAB Private**, LLAAB MCP read/capture works from Discord, and SwiftBar manages the
> gateway. Live config:
> [`docs/integrations/hermes.md`](../integrations/hermes.md).

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
| [`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md)                       | Beginner-safe first-run checklist from installed Hermes to read-only MCP    |
| [`TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md) | Later: `agent.run --executor hermes` one-shot adapter                       |
| [`TODO_ADAPTERS.md`](./TODO_ADAPTERS.md)                                       | Adapter boundary: LLAAB owns vault; Hermes owns execution                   |
| [`DONE_ORCHESTRATION.md`](./DONE_ORCHESTRATION.md)                             | Command bus, RunNodes, capability routing (Hermes adapter is Phase 3 there) |
| [`docs/integrations/hermes.md`](../integrations/hermes.md)                     | **Live Mac Studio config** (model, Discord, tools, paths)                   |
| `~/Downloads/hermes-llaab-setup-guide.md`                                      | Source brief (security, MCP tool sketches, Discord wiring)                  |

## Constraints

- **LLAAB agent-execution rule still applies to `apps/server`:** no always-on LLM workers inside
  the Bun server. Hermes gateway is a **separate process** (like Ollama or the Vite dev server).
- **Secrets in env files only** — never commit `~/.hermes/.env` or paste keys into `config.yaml`.
- **Start read-only** on MCP tools; add write tools only after CLI + Discord smoke tests pass.
- **Use LLAAB env naming:** `LLAAB_API_URL`, `LLAAB_API_KEY`, `OPENCODE_API_KEY`.
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

For the guided first-use checklist, start with
[`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md).

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

- [x] Full setup completed (not Nous Portal Quick Setup) (2026-06-25)
- [x] `hermes doctor` passes with only optional provider-key warnings (2026-06-25)
- [x] `OPENCODE_GO_API_KEY` set in `~/.hermes/.env` (Hermes var name; same key as LLAAB `OPENCODE_API_KEY`)
- [x] Ollama running with at least one model (`ollama list`) (2026-06-25)
- [x] CLI session answers using OpenCode Go (2026-06-25)
- [x] `approvals.mode: manual` confirmed in config (stricter than `smart`) (2026-06-25)

**Exit criteria:** Hermes CLI works locally with OpenCode Go + Ollama before any Discord and MCP work.

---

## Phase 2 — Discord operator console

Private server only. Follow security checklist from the setup guide.

- [x] Create Discord application + bot; enable **Message Content Intent** (2026-06-25)
- [x] Turn off **Public Bot** after invite; **LLAAB Private** server only
- [x] Set `DISCORD_BOT_TOKEN` and allowlist user ID in `~/.hermes/.env`
- [x] Discord enabled in Hermes setup wizard
- [x] `hermes gateway` — test from phone or **LLAAB Private** channel (2026-06-26)
- [ ] Confirm strangers cannot message the bot (no `GATEWAY_ALLOW_ALL_USERS`)

**Exit criteria:** Text message from iPhone → Hermes reply on Mac Studio.

---

## Phase 3 — Connect existing LLAAB MCP (read-only)

No new MCP code yet — wire what exists today (`vault_list`, `vault_read`).

**Prerequisites:** LLAAB repo at `~/LLAAB`; built CLI at
`packages/cli/dist/index.js`.

```bash
cd ~/LLAAB
pnpm dev:cli -- mcp   # should block on stdio; Ctrl+C to exit
```

Hermes MCP registration:

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  llaab:
    command: /Users/justin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
    args:
      - ~/LLAAB/packages/cli/dist/index.js
      - mcp
    env:
      LLAAB_VAULT: ~/LLAAB/vault
    tools:
      include:
        - vault_list
        - vault_read

platform_toolsets:
  discord:
    - llaab
```

- [x] Standalone `pnpm dev:cli -- mcp` starts and blocks on stdio as expected (2026-06-25)
- [x] MCP server starts from Hermes without stderr errors (2026-06-26)
- [x] Hermes MCP test discovers `vault_list` and `vault_read` (2026-06-26)
- [x] Discord channel: “Read idea &lt;id&gt;” → calls `vault_read` (2026-06-26)
- [x] Discord channel: same read queries work through gateway (2026-06-26)

**Exit criteria:** Hermes can list and read vault nodes from phone or CLI.

---

## Phase 4 — Extend MCP tools (hybrid read/write)

Implement tools sketched in the setup guide. Suggested order:

| Tool                   | Boundary                                        | Needs server?         |
| ---------------------- | ----------------------------------------------- | --------------------- |
| `vault_search`         | `@llaab/core` `listNodes`                       | No                    |
| `vault_status`         | core + `GET /api/llm/status`                    | Optional              |
| `vault_plan_next`      | read `ROADMAP.md#next` and `.agents/handoff.md` | No                    |
| `vault_capture_idea`   | `POST /api/vault/nodes`                         | Yes + `LLAAB_API_KEY` |
| `vault_ingest_youtube` | `POST /api/ingest/youtube`                      | Yes + `LLAAB_API_KEY` |

MCP child env for write tools:

```yaml
env:
  LLAAB_VAULT: "~/LLAAB/vault"
  LLAAB_API_URL: "http://localhost:8888"
  LLAAB_API_KEY: "..."   # from root .env — child process only, not committed
```

- [x] Add `vault_capture_idea` and register in `server.ts` (2026-06-26)
- [ ] Unit/smoke test each tool handler
- [x] Expand Hermes `tools.include` to `vault_capture_idea` after read-only smoke tests (2026-06-26)
- [ ] Manual: ingest a YouTube URL from Discord DM
- [x] Manual: capture an idea from Discord (2026-06-26)

**Exit criteria:** Phone can ingest, capture ideas, and ask “what’s next on the roadmap?”

---

## Phase 5 — macOS persistence

- [x] `scripts/macos/llaab-service.sh` manages `com.llaab.hermes.gateway` (2026-06-26)
- [ ] Reboot test
- [x] SwiftBar tails `~/.hermes/logs/gateway.log`; launchd stdout/stderr also exist under
      `~/Library/Logs/llaab/` (2026-06-26)
- [x] SwiftBar shows Hermes Gateway alongside server/client/LM Studio/icons (2026-06-26)

**Exit criteria:** Gateway survives logout/reboot; LLAAB server still separate (`com.llaab.server`).

---

## Phase 6 — Model routing and cost controls

OpenCode Go `glm-5.2` is capable but expensive for gateway chatter. Early Discord smoke tests cost
about `$0.53`, which is too high for routine checks like “hello”, simple vault reads, and MCP tool
selection.

### Routing goals

- Greetings / acknowledgements: use a tiny local or cheapest cloud model; no file/tool reasoning
  unless explicitly requested.
- Simple MCP reads (`vault_read`): use a small local or cheapest cloud model; tool results can
  carry most of the answer.
- List/search/status tools: use a small local or cheapest cloud model; deterministic tool call plus
  concise formatting.
- Capture tools (`vault_capture_*`): use a small reasoning model; needs light extraction/tagging,
  but not the premium default.
- Planning / synthesis / debugging: use `glm-5.2` or stronger when combining multiple sources,
  code context, or nuanced tradeoffs.
- Risky mutation / shell operations: use a strong model plus approval gates; escalate deliberately
  and preserve manual approval where possible.

### Implementation options

- [ ] Define Hermes task tiers: `cheap`, `standard`, `reasoning`, `mutation`.
- [ ] Map common Discord intents to task tiers before agent invocation where Hermes supports it.
- [ ] Assign default model/provider per MCP tool class, especially read-only versus write tools.
- [ ] Prefer deterministic routing rules over fully agent-decided routing for predictable cost.
- [ ] Allow agent escalation only when the task crosses clear thresholds: multi-step planning,
      ambiguity, failed cheap attempt, mutation risk, or explicit user request.
- [ ] Track cost per gateway session and document target spend for smoke tests.

**Agent model choice:** allow the agent to choose only within a bounded policy. Good cases include
“this cheap model failed to parse the request”, “the user asks for strategy/planning”, or “the tool
result is ambiguous”. Bad cases include every greeting or simple read silently escalating to the
premium model.

**Exit criteria:** Simple Discord/MCP tests route to a cheap model by default, with visible or logged
escalation when a stronger model is used.

---

## Phase 7 — Terminal integration (deferred)

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
