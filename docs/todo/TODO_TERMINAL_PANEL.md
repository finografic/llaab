# TODO — Terminal / Command Panel

> **Status:** Vertical slice completed by the orchestration work in
> [DONE_ORCHESTRATION.md](DONE_ORCHESTRATION.md): `/terminal` WebSocket, typed command bus,
> `ai.run`, `agent.run`, `fs.read`, `fs.list`, and session-gated `shell.exec` are implemented.
> The stable architecture reference is now
> [07 — Orchestration and adapters](../07_ORCHESTRATION_AND_ADAPTERS.md).

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

## WS message envelopes

Every message over the socket is wrapped — never raw command payloads.

```ts
// Client → Server
interface CommandEnvelope {
  type: 'command';
  payload: {
    id:      string;                               // client-assigned UUID
    ts:      string;                               // ISO timestamp
    source:  'terminal' | 'ui' | 'agent';          // who triggered this
    command: Command;
  };
}

// Server → Client
interface OutputEnvelope {
  type:  'event';
  cmdId: string;                                   // correlates to CommandEnvelope.id
  event: OutputEvent;
}
```

---

## Command types (discriminated union)

```ts
type Command =
  | { kind: 'ai.run';     task: TaskType; prompt: string; model?: string; context?: { files?: string[] } }
  | { kind: 'fs.read';    path: string }
  | { kind: 'fs.list';    path: string }
  | { kind: 'agent.run';  agentId: string; input?: unknown }
  | { kind: 'shell.exec'; cmd: string; cwd?: string }   // gated by capability
```

`task` on `ai.run` maps directly to `TaskType` in `@llaab/llm` — the LLM adapter calls the
same `routeLlm` / `streamLlm` that the HTTP endpoints use. No parallel LLM logic.

---

## Output stream protocol

```ts
type OutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
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

## LLM layer integration

The `LlmAdapter` is not a separate LLM implementation — it's a thin dispatch to `@llaab/llm`:

```
Terminal: ai.run { task: 'extract', prompt: '...' }
   → LlmAdapter.handle()
   → streamLlm('extract', prompt)       ← same fn as POST /api/llm/stream
   → yield { type: 'token', data: '...' }
```

This means: any model config, routing rules, or cache behaviour applied to HTTP LLM calls
automatically applies to terminal `ai.run` commands too — one source of truth.

---

## UI features (power-user tier)

- **Command injection API** — UI clicks a file → `insertCommand('fs.read ./vault/nodes/...')`
- **History navigation** — up/down arrow, persistent across sessions
- **Autocomplete** — command kinds, file paths from vault index, known agent IDs
- **Structured output rendering** — `meta` events render as clickable pills, not raw JSON
- **Split output modes** — raw text / structured / JSON debug (toggle)
- **Dry-run mode** — append `--dry` to any command: shows what would execute without running it
- **Replay** — re-run any previous command by ID; deterministic because commands are typed, not strings
- **Multi-pane** — one terminal instance per agent run (Phase 3+); each pane tracks its `cmdId` stream

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
