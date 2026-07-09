# TODO — LeanCTX Pilot

Purpose: trial LeanCTX as a lightweight context-hygiene layer for external developer agents
without making it canonical memory or a required LLAAB runtime dependency.

## Decision

- [x] Remove the previous repo graph integration from the normal LLAAB agent path (2026-07-09).
- [x] Choose **Hybrid** as the first LeanCTX integration mode (2026-07-09).
- [x] Install LeanCTX locally through Homebrew (2026-07-09).
- [x] Install LeanCTX integrations and reach a clean `lean-ctx doctor` result (2026-07-09).
- [ ] Pilot with Codex on a small real task.
- [ ] Keep Hermes runtime/inbox usage deferred until the developer-agent pilot is stable.

## Install

Recommended first path on macOS:

```bash
brew tap yvgude/lean-ctx
brew install lean-ctx
lean-ctx --version
```

Fast universal installer alternative:

```bash
curl -fsSL https://leanctx.com/install.sh | sh
lean-ctx --version
```

## Phase 1 — Codex Hybrid Setup

- [x] Run LeanCTX setup/init and inspect generated config (2026-07-09).
- [x] Run `lean-ctx doctor`; final result is 36/36 (2026-07-09).
- [ ] Decide whether to keep the LeanCTX daemon enabled after the pilot.
- [ ] Confirm raw `rg`, direct file reads, and normal shell commands still work as escape hatches.
- [x] Record exactly which files LeanCTX changed (2026-07-09).

Changed outside the repo:

- `~/.zshrc`
- `~/.zshrc.lean-ctx.bak`
- `~/.config/lean-ctx/env.sh`
- `~/.config/lean-ctx/shell-hook.zsh`
- `~/.config/lean-ctx/config.toml`
- `~/.local/share/lean-ctx/`
- `~/.codex/config.toml`
- `~/.codex/hooks.json`
- `~/.codex/AGENTS.md`
- `~/.codex/LEAN-CTX.md`
- `~/.claude.json`
- `~/.claude/settings.json`
- `~/.config/opencode/opencode.json`
- `~/.config/opencode/AGENTS.md`
- `~/.hermes/config.yaml`
- `~/.copilot/mcp-config.json`
- `~/.bashrc`

Changed inside the repo:

- `AGENTS.md`
- `LEAN-CTX.md`
- `.vscode/mcp.json`

## Phase 2 — Small Task Trial

- [ ] Use LeanCTX on one small LLAAB code-reading task.
- [ ] Compare the context path against normal `rg` + file reads.
- [ ] Note whether it reduced useful token load or only added process overhead.
- [ ] Confirm output is understandable enough to trust during real work.
- [ ] Confirm it does not hide important files, generated types, or route wiring.

## Phase 3 — Broader Developer-Agent Trial

- [ ] Try a second local developer agent only after Codex feels stable.
- [ ] Prefer Claude Code or OpenCode before any Hermes experiment.
- [ ] Document per-agent setup differences.
- [ ] Keep the setup reversible.

## Phase 4 — Hermes TBD

- [ ] Decide whether Hermes should use LeanCTX at all.
- [ ] If yes, prefer a narrow experiment around read/search context only.
- [ ] Do not route Telegram inbox captures through LeanCTX.
- [ ] Do not make LeanCTX required for Hermes startup.
- [ ] Do not use Full MCP unless Hermes has a clear protocol-only need.

## Exit Criteria

- [ ] LeanCTX is either adopted for specific developer-agent workflows or removed cleanly.
- [ ] Any adopted setup is documented in `.agents/handoff.md` and relevant external-agent docs.
- [ ] No generated context artifacts are committed as canonical LLAAB knowledge.
