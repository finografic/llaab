# TODO — Hermes First Run and LLAAB Connection

> **Status:** Phase 4 read-only Discord MCP complete (2026-06-26). Hermes can answer LLAAB
> vault read queries from **LLAAB Private** using `vault_list` / `vault_read`.

## Goal

Get Hermes usable from the Mac Studio and iPhone without exposing risky write or shell surfaces too
early. This is the operator runbook for a first-time Hermes user; the broader architecture lives in
[`TODO_HERMES_LAYER.md`](./TODO_HERMES_LAYER.md).

Target first win:

```text
Hermes CLI → LLAAB MCP → vault_list / vault_read
Discord → Hermes gateway → simple reply
Discord → Hermes gateway → LLAAB read-only vault query
```

## Source Docs

| Doc                                                                            | Use                                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`TODO_HERMES_LAYER.md`](./TODO_HERMES_LAYER.md)                               | Overall phase plan and security boundaries                            |
| [`docs/integrations/hermes.md`](../integrations/hermes.md)                     | Live Mac Studio Hermes config and installation facts                  |
| [`TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md) | Later terminal `agent.run --executor hermes` work                     |
| `/Users/justin/Downloads/hermes-llaab-setup-guide.md`                          | Imported setup/security/MCP guide; adapt ports and env names to LLAAB |

## Current Facts

- Hermes is already installed on the Mac Studio.
- Setup mode should be **Full setup**, not Quick Setup / Nous Portal.
- LLAAB local ports: client `3000`, server `8888`.
- Existing LLAAB MCP command: `pnpm dev:cli -- mcp`.
- Existing MCP tools today: `vault_list`, `vault_read`.
- Hermes secrets belong in `~/.hermes/.env`, never repo `.env` or committed config.
- For LLAAB write tools, use repo convention `LLAAB_API_KEY`.

## Phase 0 — Orientation and Safety

Purpose: make sure the first Hermes choices are safe and understandable.

- [x] Open `~/.hermes/config.yaml` and confirm the setup wizard used **Full setup**.
- [x] At “How would you like to set up Hermes?”, choose **Full setup** if prompted again.
- [x] Do **not** choose Quick Setup / Nous Portal for this integration.
- [x] Keep `approvals.mode: smart` or stricter; do not use `off`.
- [x] Keep `terminal.backend: local` for now, but do not rely on Discord shell access yet.
- [x] Confirm no `GATEWAY_ALLOW_ALL_USERS=true` exists in `~/.hermes/.env`.
- [ ] Confirm Discord bot **Public Bot** is off after invitation to **LLAAB Private**.

Beginner note: if the wizard asks twice about tools, that can be normal. Hermes can configure tool
sets separately for CLI and Discord.

## Phase 1 — CLI Smoke Test

Purpose: prove Hermes itself works before Discord or MCP.

```bash
hermes doctor
hermes
```

In the Hermes CLI, ask:

```text
What model are you using?
List your available tools.
```

- [x] `hermes doctor` runs without blocking setup errors (2026-06-25).
- [x] CLI answers a basic prompt (2026-06-25).
- [x] CLI reports expected model routing: OpenCode Go primary, Ollama fallback if configured.
- [x] CLI tool list appears without config errors.
- [x] Note any missing macOS permissions from `hermes doctor` in `docs/integrations/hermes.md`.

Exit criteria: Hermes can answer locally from Terminal.

## Phase 2 — Discord Gateway Smoke Test

Purpose: prove phone-to-Mac messaging before giving Hermes LLAAB tools.

```bash
hermes gateway
```

From Discord, test in **LLAAB Private** or DM:

```text
hello
what model are you using?
```

- [x] Gateway starts in the foreground (2026-06-25).
- [x] Bot replies from Discord when mentioned (2026-06-26).
- [x] Message Content Intent is enabled (2026-06-26).
- [ ] Only the allowlisted Discord user can interact.
- [x] Record the working channel / DM behavior in `docs/integrations/hermes.md`.
- [x] Reset or re-copy `DISCORD_BOT_TOKEN`; previous token was present but rejected by Discord as
      invalid (2026-06-26).

Exit criteria: iPhone message → Hermes reply on Mac Studio.

## Phase 3 — Standalone LLAAB MCP Test

Purpose: prove LLAAB’s existing MCP server works before Hermes launches it.

```bash
cd /Users/justin/LLAAB
pnpm dev:cli -- mcp
```

Expected behavior: the command blocks on stdio. Stop it with `Ctrl+C`.

- [x] MCP server starts without module or environment errors (2026-06-25).
- [x] Existing tools are still `vault_list` and `vault_read`.
- [x] No new write tools are added in this phase.

Exit criteria: `pnpm dev:cli -- mcp` can start cleanly.

## Phase 4 — Register Read-Only LLAAB MCP in Hermes

Purpose: let Hermes read the vault through MCP with the smallest useful tool surface.

Add a read-only MCP server entry to `~/.hermes/config.yaml`.

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

Use Node + built CLI for Hermes MCP. The Bun source command starts standalone, but Hermes' Python
MCP client hangs during `initialize` when it launches Bun.

Then test:

```text
List five LLAAB idea nodes.
Read one of those idea nodes.
```

- [x] Hermes starts the LLAAB MCP child process (2026-06-26).
- [x] Hermes can list vault nodes using `vault_list` (2026-06-26).
- [ ] Hermes can read a selected node using `vault_read`.
- [x] Discord can perform the same read-only query (2026-06-26).
- [x] Keep write tools excluded.

Exit criteria: Hermes can answer read-only vault questions from CLI and Discord.

## Phase 5 — Add Beginner Operating Notes

Purpose: preserve what was learned so the next restart is less mysterious.

- [ ] Update `docs/integrations/hermes.md` with exact working provider IDs from `hermes doctor`.
- [x] Update `docs/integrations/hermes.md` with the confirmed MCP config shape.
- [ ] Add a short “Common first-run failures” section:
      message intent missing, wrong Discord user ID, MCP cwd wrong, pnpm not on PATH.
- [x] Update `TODO_HERMES_LAYER.md` checkboxes for completed first-run phases.

Exit criteria: another agent can reproduce the setup from committed docs without guessing.

## Phase 6 — Deferred Write Tools

Do not begin until Phase 4 passes.

- [ ] Add `vault_search` as a read-only MCP tool.
- [ ] Add `vault_status` as a mostly read-only health summary.
- [ ] Add `vault_plan_next` over roadmap / handoff / next steps.
- [ ] Add `vault_capture_idea` using `POST /api/vault/nodes` with `LLAAB_API_KEY`.
- [ ] Add `vault_ingest_youtube` using `POST /api/ingest/youtube` with `LLAAB_API_KEY`.
- [ ] Expand Hermes `tools.include` one tool at a time.

Write-tool MCP child env, when needed:

```yaml
env:
  LLAAB_VAULT: "/Users/justin/LLAAB/vault"
  LLAAB_API_URL: "http://localhost:8888"
  LLAAB_API_KEY: "..." # from a secret env source; do not commit
```

Exit criteria: phone can capture an idea and ingest a YouTube link after explicit validation.

## Non-Goals

- Do not make Hermes part of `apps/server`.
- Do not expose shell or terminal automation to Discord as the first integration.
- Do not expose write tools before read-only MCP works from CLI and Discord.
- Do not commit `~/.hermes/.env`, Discord tokens, API keys, or copied Hermes config with secrets.
