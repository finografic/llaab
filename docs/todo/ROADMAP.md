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

Nothing active — `P1` harness validation is the next item to pick up.

---

## P1 — Next Up

### Install and validate `@finografic/ai-harness` in the transcript extraction path

Adopt the released package as a real LLAAB dependency and prove the first consumer integration at
the extraction boundary. Start small: validate the package inside the current transcript
extraction flow before expanding the runtime harness scope.

Current state: package install + initial extraction-boundary spike are done. Remaining work is
real-flow validation and deciding whether transcript constraints push the broader harness
extension ahead of Terminal / Command Panel.

Implementation boundary for agents with no prior context:

- current consumer package: `packages/ingestion`
- harness prep entrypoint: `packages/ingestion/src/extract/harness-prep.ts`
- current extraction boundary: `packages/ingestion/src/extract/llm-extract.ts`
- downstream model-governance boundary: `packages/control/src/orchestrator.ts`

What "validate" means here:

- run a real ingest + extract flow, not just unit tests
- confirm extraction still succeeds with the harness prep stage in place
- inspect run traces and confirm the harness stages are visible and useful
- decide whether the current character truncation remains acceptable for transcript extraction
- if transcript prep is still the blocker, promote Harness Layer extension above Terminal Panel

Detail: [`docs/todo/TODO_HARNESS.md`](./TODO_HARNESS.md)

---

## P2 — Planned

### LLM execution metadata in node frontmatter

Write model name, wall-clock duration, and token counts (prompt + completion) to the frontmatter
of transcript and idea nodes at the point of extraction. This makes every vault node
self-documenting — you can see exactly which model produced it and how long it took.

Implementation boundary:

- Wrap `llmExtract` in `packages/ingestion/src/extract/llm-extract.ts` to capture timing and
  model info from the response.
- Pass metadata through to `extractTranscriptIdeas` in `packages/skills/src/extract-transcript-ideas.ts`.
- Write `llm_model`, `llm_duration_ms`, `llm_prompt_tokens`, `llm_completion_tokens` fields
  via `updateNode` on both the transcript and each created idea node.
- Schema: add optional fields to `TranscriptNode` and `IdeaNode` in `packages/schemas`.

---

### Terminal / Command Panel

Typed command bus (WS) + xterm.js UI. Not a shell — a controlled execution surface for vault
ops, LLM calls, and agent runs. Gated shell adapter as opt-in power-user mode.

Priority rule: this stays next only if the harness consumer validation above does not reveal that
transcript extraction is blocked by missing token-aware prep, chunking, or routing support.

Detail: [`docs/todo/TODO_TERMINAL_PANEL.md`](./TODO_TERMINAL_PANEL.md)

---

## P3 — Backlog / Ideas

### Retrieval & Context-Assembly Discipline

Define per-workflow context rules before the vault outgrows naive prompt stuffing. Distinguish
direct source material, derived summaries, operational instructions, and execution history.
Decide when retrieval runs: before model call, after deterministic cleaning, or after failed
validation. First driver: transcript extraction as transcript volume grows.

Reference: [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3,
[`TODO_ORCHESTRATION_V4.md`](./TODO_ORCHESTRATION_V4.md)

---

### Candidate / Promotion States for LLM-Created Nodes

Extend beyond `seed → growing → mature → archived` with an explicit candidate or provisional state
for LLM-assisted creation before promotion to trusted knowledge. Gives the control layer a cleaner
place to store partially trusted extraction results. Schema design TBD — may be a new status value
or a separate provenance flag.

Reference: [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §6

---

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

### Library Watch

Track npm packages, frameworks, Homebrew tools, and other ecosystem dependencies as a new
`PackageNode` vault type. Cards show weekly downloads, dep count, bundle size, last published
date, version. `follow: true` nodes auto-refresh stats on `llaab agent run` via a new
`refreshPackageStats` skill in the agent loop registry. Fetch logic ported from npmx.dev
(`app/utils/npm/api.ts` + `shared/types/npm-registry.ts`) — strip Nuxt wrappers, use plain fetch.

Detail: [`docs/todo/TODO_LIBRARY_WATCH.md`](./TODO_LIBRARY_WATCH.md)

### Harness Layer — Token-Aware Control Pipeline

Extend the new `@finografic/ai-harness` package beyond its current debug-pipeline scope so LLAAB
can use it for real runtime preparation around `control.execute()`: tokenization/counting,
chunking for long inputs (transcripts), structured context assembly, and deterministic model
routing. First concrete driver: transcript → harness prep → control → idea extraction.

Do not start this until Phase 1 validation has been done in the real transcript flow and the
decision has been made that current prep limits are the next actual bottleneck.

Detail: [`docs/todo/TODO_HARNESS.md`](./TODO_HARNESS.md)

---

## Done

| Date       | Item                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-06 | ESLint → oxlint migration — root, `apps/client`, `apps/server`, and `packages/ui` on oxlint + oxfmt; ESLint removed repo-wide; lint-staged and CI use oxlint                                                                |
| 2026-06-06 | Zod v3 → v4 upgrade — all packages on `zod@^4`; `@llaab/schemas` + `@hono/zod-validator` in `apps/server` validated                                                                                                         |
| 2026-06-06 | UI Refactor — shadcn expansion + typography system: type-scale tokens, px → rem, shadcn adoption, inline style cleanup. Detail: [`DONE_UI_REFACTOR.md`](./DONE_UI_REFACTOR.md)                                              |
| 2026-04-18 | Foundational schema usage layer — `writeNode`/`updateNode`, `@llaab/control`, `RunNode` persistence, YouTube ingestion v1, controlled idea extraction. Detail: [`DONE_FOUNDATIONAL_LAYER.md`](./DONE_FOUNDATIONAL_LAYER.md) |
| 2026-06-05 | SwiftBar overhaul — three-state service indicators (stopped/launching/running), per-service submenus, health-aware refresh timing, traffic-light icons                                                                      |
| 2026-06-05 | Icons service hardening + lucide-manager polish — config-safe runtime dir, launchctl stability, optional branding img, relative img path auto-conversion, embedded picker UI improvements                                   |
| 2026-06-01 | Client UI migration — remove PandaCSS and `@finografic/design-system`; adopt app-local shadcn/ui + Tailwind 4                                                                                                               |
| 2026-05-28 | Repo public-readiness — vault privacy audit flow, initial `lab/` approvals, and prepare-to-publish cleanup                                                                                                                  |
| 2026-04-29 | Vault browser nodes page — `PageLayout` + `FileList` + DS TreeView integration                                                                                                                                              |
| 2026-04-28 | Fix client SSR React dedupe — cross-repo design-system / Ark / Zag single-instance resolution                                                                                                                               |
| 2026-04-27 | Layout system — `PageLayout`, `PageHero`, Finder-style `FileList`, sticky sidebar, layout guide                                                                                                                             |
| 2026-04-20 | Transcript extraction UX + linking — `related`, ideas endpoint, linked idea cards, improved re-extract flow                                                                                                                 |
| 2026-04-19 | Ollama extraction stability — switch to chat API, local model fix, clean-vault script improvements                                                                                                                          |
| 2026-04-18 | Dark theme + two-phase ingestion — layout refactor, transcript-first save, best-effort extraction                                                                                                                           |
| 2026-04-17 | Vault page coverage — detail pages for nodes, transcripts, sources; all list pages linked; Sources in nav                                                                                                                   |
| 2026-04-17 | Fix `llmExtract` — JSON system prompt, fence stripping, `parseJsonFromText`; agent loop now produces IdeaNodes                                                                                                              |
| 2026-04-16 | MCP server — `llaab mcp` stdio command, vault resources + vault_list/vault_read tools                                                                                                                                       |
| 2026-04-16 | Hono RPC — typed `hc<AppType>` client, routers refactored to chain form, `api.ts` in client                                                                                                                                 |
| 2026-04-16 | Agent loop — one-shot processor, skill registry, dedup index, `/api/agent/*`, `llaab agent run`                                                                                                                             |
| 2026-04-16 | LLM communication layer — real Anthropic + Ollama providers, task router, cache, `/api/llm/*`                                                                                                                               |
| 2026-04-16 | Vault browser write — `POST /api/vault/nodes`, `CreateIdeaPanel` island on nodes page                                                                                                                                       |
| 2026-04-16 | CLI — `llaab ingest <url>` and `llaab vault list [--type]` via citty                                                                                                                                                        |
| 2026-04-16 | `apps/server` — Hono server + client migration (`api-client.ts`, remove skills/ingestion deps)                                                                                                                              |
| 2026-04-16 | Taxonomy system — `autoTag`, `d:` tags, TagsInput on IngestForm, tag pills, skills doc                                                                                                                                      |
| 2026-04-16 | Vault browser sub-pages — transcripts, nodes, runs list + run detail                                                                                                                                                        |
| 2026-04-16 | Fix web ingest — route through `ingestYouTube` skill to produce `RunNode`                                                                                                                                                   |
| 2026-04-15 | Rename `apps/web` → `apps/client`, `@llaab/web` → `@llaab/client`                                                                                                                                                           |
| 2026-04-15 | `AppLayout` — sidebar shell, `NavbarVertical`, `AppHeader`, `AppFooter`                                                                                                                                                     |
| 2026-04-15 | Fix vault path resolution — `vault-root.ts` anchored to `import.meta.url`                                                                                                                                                   |
| 2026-04-15 | YouTube transcript fix — VTT format, trailing trim, word-level dedup                                                                                                                                                        |
| 2026-04-13 | Ingest form, gated vault browser, Panda CSS, DS components wired                                                                                                                                                            |
| 2026-04-08 | `@llaab/control`, `runSkill`, `RunNode` persistence, decision traces                                                                                                                                                        |
| 2026-04-04 | Schema split, `createNode`, `listNodes`, `captureIdea` skill                                                                                                                                                                |
| 2026-03-30 | Monorepo genesis — all packages scaffolded, lint, typecheck green                                                                                                                                                           |
