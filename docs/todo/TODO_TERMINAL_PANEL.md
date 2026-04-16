# TODO — Terminal / Command Panel

> **Status:** Not started. Depends on `apps/server` with WebSocket support.
> Tertiary priority — implement after server and LLM layer exist.

---

## What this is (and isn't)

This is **not** "embed a shell in the browser."
This is a **typed command bus with a terminal UI** — a persistent execution surface for
interacting with vault operations, LLM calls, agent runs, and (optionally) constrained shell.

The distinction matters architecturally: string parsing → typed commands → structured output.
Every command is introspectable, loggable, and replayable.

---

## Architecture

```
apps/client (Astro + React)
  └── TerminalPanel (xterm.js)
        ↕ WebSocket (ws://.../terminal)

apps/server (Hono)
  └── WS /terminal
        └── Command Gateway (auth + Zod validation)
              └── Command Bus (dispatch by kind)
                    ├── LlmAdapter     — ai.run → Ollama / Anthropic
                    ├── FsAdapter      — fs.read, fs.list (sandboxed)
                    ├── AgentAdapter   — agent.run → skill execution
                    └── ShellAdapter   — shell.exec (allowlisted, opt-in)

packages/core (shared)
  └── command protocol types + Zod schemas
```

---

## Command types (discriminated union)

```ts
type Command =
  | { kind: 'ai.run';     prompt: string; model?: string; context?: { files?: string[] } }
  | { kind: 'fs.read';    path: string }
  | { kind: 'fs.list';    path: string }
  | { kind: 'agent.run';  agentId: string; input?: unknown }
  | { kind: 'shell.exec'; cmd: string; cwd?: string }   // gated by capability
```

---

## Output stream protocol

```ts
type OutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'token';  data: string }         // LLM token stream
  | { type: 'meta';   data: unknown }        // structured data (file links, progress)
  | { type: 'done';   code: number }
```

`meta` events allow the terminal to render clickable file links, progress bars, node cards —
not just raw text.

---

## Security model (non-negotiable)

- All WS messages validated with Zod before dispatch
- FS adapter restricted to vault root — no `../` escapes, paths normalized
- Shell adapter gated by `capabilities.shell = true` on session; allowlist:
  `['git', 'pnpm', 'node', 'yt-dlp']` — deny everything else
- Rate limiting per connection per command type
- Audit log: every command + result + duration persisted as a `RunNode`

---

## UI features (power-user tier)

- **Command injection API** — UI clicks a file → `insertCommand('fs.read ./vault/nodes/...')`
- **History navigation** — up/down arrow, persistent across sessions
- **Autocomplete** — command kinds, file paths from vault index, known agent IDs
- **Structured output rendering** — `meta` events render as clickable pills, not raw JSON
- **Split output modes** — raw text / structured / JSON debug (toggle)

---

## Implementation phases

### Phase 1 — Vertical slice

- [ ] xterm.js React island in `apps/client`
- [ ] WS endpoint in `apps/server` (`/terminal`)
- [ ] `ai.run` command → Ollama streaming → token events → terminal

### Phase 2 — FS + structured output

- [ ] `fs.read` + `fs.list` commands
- [ ] Clickable path rendering in terminal
- [ ] UI → terminal injection (`insertCommand` API)

### Phase 3 — Agent integration

- [ ] `agent.run` command → `runSkill` → streaming stage events
- [ ] Terminal as agent console / run log

### Phase 4 — Security hardening

- [ ] Capability-based session permissions
- [ ] FS sandbox enforcement
- [ ] Audit log via RunNode

### Phase 5 — Shell (optional, power mode)

- [ ] `shell.exec` behind `capabilities.shell` flag
- [ ] `node-pty` adapter with command allowlist
- [ ] Explicit enable per dev session (never default-on)

---

## opencode.ai / t3code consideration

`opencode.ai` and `t3code` are full-featured agent IDE interfaces. Worth watching, but:

- They're opinionated full environments, not embeddable panels
- LLAAB's terminal is a lighter, purpose-built execution surface for vault operations
- If opencode or t3code becomes compelling, the right move is to use it _alongside_ LLAAB
  (pointing at the vault), not to replace this panel

Revisit when the agent loop infrastructure is in place and the scope becomes clearer.

---

## Anti-patterns to avoid

- Raw shell passthrough as the default
- Blocking (non-streaming) responses
- Mixing terminal UI logic with execution logic
- No validation layer on incoming WS messages
- Always-on connections with no timeout / cleanup
