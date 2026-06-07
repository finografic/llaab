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

### Navigation Pages Unlocked by Orchestration

Build the next simple frontend pages for nav items that were locked while orchestration, providers,
capabilities, command bus, and diagnostics were still missing. Start with read-only observability
pages before adding new ingestion types.

Detail: [`docs/todo/TODO_NAV_UNLOCKED_PAGES.md`](./TODO_NAV_UNLOCKED_PAGES.md)

---

## P1 — Next Up

### Execution UI Surfaces

After provider/system observability pages exist, add the first execution pages unlocked by the
agent loop and command bus: `/agent`, `/execute/skills`, and `/pipeline/extract`.

Detail: [`docs/todo/TODO_NAV_UNLOCKED_PAGES.md`](./TODO_NAV_UNLOCKED_PAGES.md#phase-2--execution-pages)

### Extracted SkillNode Creation

The LLM extraction schema already has a `skills` array, but the pipeline currently creates
`IdeaNode`s only. Decide and implement whether extracted skills should become candidate
`SkillNode`s, including provenance, status, tags, and review UX.

Reference: [`NEXT_STEPS.md`](./NEXT_STEPS.md#open-questions-carry-forward-from-architecture)

---

## P2 — Planned

### Adapter Expansion Beyond the Foundation

The adapter foundation is done: providers, capabilities, command handlers, OpenCode registration,
and shell gating exist. Future work is adding more external execution adapters only when there is
a concrete workflow driver.

Detail: [`docs/todo/TODO_ADAPTERS.md`](./TODO_ADAPTERS.md)

### Harness Package Graduation

Token-aware extraction prep exists locally in LLAAB. The remaining harness work is deciding what
should graduate into `@finografic/ai-harness` as reusable package functionality.

Detail: [`docs/todo/TODO_HARNESS.md`](./TODO_HARNESS.md)

### Search and Retrieval Discipline

Define search/retrieval rules before implementing `/vault/search` or broader RAG behavior. Start
with simple full-text search only if it does not conflict with future context assembly.

Reference: [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3

---

## P3 — Backlog / Ideas

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
Trigger: `lab agent run` or `POST /api/agent/run` on a user-controlled schedule.

### Article and Document Ingestion

Add `/ingest/article` and `/ingest/document` only after the nav-unlocked observability pages and
execution pages are in place. These need new parsing/fetching paths and should preserve the
transcript-first rule where applicable.

### Library Watch

Track npm packages, frameworks, Homebrew tools, and other ecosystem dependencies as a new
`PackageNode` vault type. Cards show weekly downloads, dep count, bundle size, last published
date, version. `follow: true` nodes auto-refresh stats on `lab agent run` via a new
`refreshPackageStats` skill in the agent loop registry. Fetch logic ported from npmx.dev
(`app/utils/npm/api.ts` + `shared/types/npm-registry.ts`) — strip Nuxt wrappers, use plain fetch.

Detail: [`docs/todo/TODO_LIBRARY_WATCH.md`](./TODO_LIBRARY_WATCH.md)

## Done

### Orchestration and adapter foundation

Completed 2026-06-07. LLAAB now has LLM provider interfaces, execution metadata, token-aware
extraction prep, typed command bus, Terminal Panel vertical slice, capability routing, CLI
diagnostics, OpenCode executor registration, session-gated `shell.exec`, and a consolidated
architecture reference.

Detail: [`docs/todo/DONE_ORCHESTRATION.md`](./DONE_ORCHESTRATION.md),
[`docs/07_ORCHESTRATION_AND_ADAPTERS.md`](../07_ORCHESTRATION_AND_ADAPTERS.md)

### Install and validate `@finografic/ai-harness` in the transcript extraction path

Completed 2026-06-07. The released harness package is installed in `@llaab/ingestion`, exercised
before `control.execute(...)`, and validated through a real YouTube transcript plus persisted
`extract-transcript-ideas` RunNode. Verdict: integration is stable, but blind character
truncation is not an acceptable quality baseline; token-aware harness extension is promoted ahead
of Terminal Panel.

Detail: [`docs/todo/TODO_HARNESS.md`](./TODO_HARNESS.md)

| Date       | Item                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-07 | Navigation menu — `NavbarVertical` replaced by horizontal shadcn `NavigationMenu` in `AppHeader`; megamenu config in `nav-menu.config.ts`; future routes disabled with lock icon; `/icons` redirect; homepage Models card   |
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
| 2026-04-16 | MCP server — `lab mcp` stdio command, vault resources + vault_list/vault_read tools                                                                                                                                         |
| 2026-04-16 | Hono RPC — typed `hc<AppType>` client, routers refactored to chain form, `api.ts` in client                                                                                                                                 |
| 2026-04-16 | Agent loop — one-shot processor, skill registry, dedup index, `/api/agent/*`, `lab agent run`                                                                                                                               |
| 2026-04-16 | LLM communication layer — real Anthropic + Ollama providers, task router, cache, `/api/llm/*`                                                                                                                               |
| 2026-04-16 | Vault browser write — `POST /api/vault/nodes`, `CreateIdeaPanel` island on nodes page                                                                                                                                       |
| 2026-04-16 | CLI — `lab ingest <url>` and `lab vault list [--type]` via citty                                                                                                                                                            |
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
