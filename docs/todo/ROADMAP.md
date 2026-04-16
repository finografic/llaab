# LLAAB — Roadmap

> **This is the primary high-level plan for the project.**
> Agents and contributors: check this file before proposing new work. Add new items here when
> conceiving features. Keep it ordered by priority — move items down as priorities shift, and
> move completed items to the Done section at the bottom.

---

## How to use this file

| Tier | Meaning                                   |
| ---- | ----------------------------------------- |
| P0   | Active — being worked on now              |
| P1   | Next — fully scoped, ready to start       |
| P2   | Planned — direction decided, detail TBD   |
| P3   | Backlog — good ideas, not yet prioritised |

Each item: one-line description + link to detail doc if one exists in `docs/todo/`.
When an item is done, move it to the Done section at the bottom with a completion date.

---

## P0 — Active

_Nothing active right now — pick from P1._

---

## P1 — Next Up

### `apps/server` — Hono API Server

Dedicated Hono server for all vault I/O, skill execution, and future agent coordination.
Decouples business logic from Astro's UI layer so skills can be triggered from CLI, agents, and
other clients — not only the browser.

Detail: [`docs/todo/TODO_APP_SERVER.md`](./TODO_APP_SERVER.md)

---

## P2 — Planned

### CLI — First Commands

Wire up the `@llaab/cli` binary with a command parser (commander or citty). Initial commands:
`llaab ingest <url>` and `llaab vault list [--type]`. This validates that the skill layer works
from a terminal context independently of the web client.

### LLM Communication Layer

Route all LLM calls through the `apps/server` API once it exists. Hono supports streaming
(`c.streamText()`) natively. Cover both Anthropic and Ollama providers already in `@llaab/llm`.
Expose endpoints the client and agents can call without importing provider SDKs directly.
Task-based routing (trivial → local small, code → local mid, reasoning → remote API).

Detail: [`docs/todo/TODO_LOCAL_LLM.md`](./TODO_LOCAL_LLM.md)

### Vault Browser — Write Capability

Currently read-only. Add the ability to create/edit `IdeaNode` and `PromptNode` entries from the
browser UI. Uses the server API for writes — no direct `fs` calls from the client.

---

## P3 — Backlog / Ideas

### Migrate ESLint → oxlint

`oxfmt` is already in place. Pairing it with oxlint gives a fully unified Rust-based lint+format
pipeline — faster, better `oxfmt` integration, and no config impedance mismatch. Earlier is
better: the longer the ESLint config grows, the more surface to migrate. Do before the codebase
expands significantly.

Detail: [`docs/todo/TODO_OXLINT_MIGRATION.md`](./TODO_OXLINT_MIGRATION.md)

### Agent Loop Infrastructure

Background agent that monitors the vault, triggers skills on new nodes, and persists `RunNode`
traces. Needs `apps/server` in place first. Trigger mechanism TBD (HTTP, file watch, cron).

### Vault Graph View

Visualise relationships between vault nodes — source → transcript → idea → skill lineage. Likely
a React island using a lightweight graph library. Read-only to start.

### Source Auto-Follow

`SourceNode` has a `follow` field. Build a scheduled job that re-ingests followed sources when
new content appears. Depends on `apps/server` and the agent loop infrastructure.

### Terminal / Command Panel

Typed command bus (WS) + xterm.js UI. Not a shell — a controlled execution surface for vault
ops, LLM calls, and agent runs. Gated shell adapter as opt-in power-user mode.
Depends on `apps/server` + LLM layer.

Detail: [`docs/todo/TODO_TERMINAL_PANEL.md`](./TODO_TERMINAL_PANEL.md)

### `@llaab/client` — Hono RPC Integration

Once `apps/server` exists, optionally replace plain `fetch` calls in the client with Hono's typed
RPC client. Full end-to-end type safety from server router definitions to React components.

---

## Done

| Date       | Item                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| 2026-04-16 | Taxonomy system — `autoTag`, `d:` tags, TagsInput on IngestForm, tag pills, skills doc |
| 2026-04-16 | Vault browser sub-pages — transcripts, nodes, runs list + run detail                   |
| 2026-04-16 | Fix web ingest — route through `ingestYouTube` skill to produce `RunNode`              |
| 2026-04-15 | Rename `apps/web` → `apps/client`, `@llaab/web` → `@llaab/client`                      |
| 2026-04-15 | `AppLayout` — sidebar shell, `NavbarVertical`, `AppHeader`, `AppFooter`                |
| 2026-04-15 | Fix vault path resolution — `vault-root.ts` anchored to `import.meta.url`              |
| 2026-04-15 | YouTube transcript fix — VTT format, trailing trim, word-level dedup                   |
| 2026-04-13 | Ingest form, gated vault browser, Panda CSS, DS components wired                       |
| 2026-04-08 | `@llaab/control`, `runSkill`, `RunNode` persistence, decision traces                   |
| 2026-04-04 | Schema split, `createNode`, `listNodes`, `captureIdea` skill                           |
| 2026-03-30 | Monorepo genesis — all packages scaffolded, lint, typecheck green                      |
