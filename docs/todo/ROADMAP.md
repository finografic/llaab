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

_Nothing queued — pick from P2._

---

## P2 — Planned

### `@llaab/client` — Hono RPC Integration

Replace plain `fetch` calls in `api-client.ts` with Hono's typed RPC client. Full end-to-end
type safety from server router definitions to React components — automatically covers all new
routes added going forward. Do before the Terminal Panel while call-site count is still small.

### Terminal / Command Panel

Typed command bus (WS) + xterm.js UI. Not a shell — a controlled execution surface for vault
ops, LLM calls, and agent runs. Gated shell adapter as opt-in power-user mode.

Detail: [`docs/todo/TODO_TERMINAL_PANEL.md`](./TODO_TERMINAL_PANEL.md)

---

## P3 — Backlog / Ideas

### Migrate ESLint → oxlint

`oxfmt` is already in place. Pairing it with oxlint gives a fully unified Rust-based lint+format
pipeline — faster, better `oxfmt` integration, and no config impedance mismatch. Earlier is
better: the longer the ESLint config grows, the more surface to migrate. Do before the codebase
expands significantly.

Detail: [`docs/todo/TODO_OXLINT_MIGRATION.md`](./TODO_OXLINT_MIGRATION.md)

### Karpathy Pattern — Vault Graph Integration

Andrej Karpathy's knowledge graph visualization is a purpose-built, battle-tested graph view.
Integrate it with LLAAB's vault rather than building a custom React island from scratch.
LLAAB's vault exposes node relationships (source → transcript → idea → skill lineage) via
`listNodes` + `GET /api/vault/nodes` — the integration surface is an export/adapter, not a UI.
Scope TBD pending research into Karpathy Pattern's data format requirements.

### Source Auto-Follow

`SourceNode` has a `follow` field. Build a scheduled job that re-ingests followed sources when
new content appears. Agent loop registry already has the slot reserved (commented out).
Trigger: `llaab agent run` or `POST /api/agent/run` on a user-controlled schedule.

### MCP Server

Expose LLAAB vault as an MCP server on `apps/server` so external tools (Claude Code, Cline,
OpenCode, t3code) can read vault nodes as first-class context. Highest-leverage integration
play — one server, all clients.

---

## Done

| Date       | Item                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------- |
| 2026-04-16 | Agent loop — one-shot processor, skill registry, dedup index, `/api/agent/*`, `llaab agent run` |
| 2026-04-16 | LLM communication layer — real Anthropic + Ollama providers, task router, cache, `/api/llm/*`   |
| 2026-04-16 | Vault browser write — `POST /api/vault/nodes`, `CreateIdeaPanel` island on nodes page           |
| 2026-04-16 | CLI — `llaab ingest <url>` and `llaab vault list [--type]` via citty                            |
| 2026-04-16 | `apps/server` — Hono server + client migration (`api-client.ts`, remove skills/ingestion deps)  |
| 2026-04-16 | Taxonomy system — `autoTag`, `d:` tags, TagsInput on IngestForm, tag pills, skills doc          |
| 2026-04-16 | Vault browser sub-pages — transcripts, nodes, runs list + run detail                            |
| 2026-04-16 | Fix web ingest — route through `ingestYouTube` skill to produce `RunNode`                       |
| 2026-04-15 | Rename `apps/web` → `apps/client`, `@llaab/web` → `@llaab/client`                               |
| 2026-04-15 | `AppLayout` — sidebar shell, `NavbarVertical`, `AppHeader`, `AppFooter`                         |
| 2026-04-15 | Fix vault path resolution — `vault-root.ts` anchored to `import.meta.url`                       |
| 2026-04-15 | YouTube transcript fix — VTT format, trailing trim, word-level dedup                            |
| 2026-04-13 | Ingest form, gated vault browser, Panda CSS, DS components wired                                |
| 2026-04-08 | `@llaab/control`, `runSkill`, `RunNode` persistence, decision traces                            |
| 2026-04-04 | Schema split, `createNode`, `listNodes`, `captureIdea` skill                                    |
| 2026-03-30 | Monorepo genesis — all packages scaffolded, lint, typecheck green                               |
