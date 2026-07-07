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

## Next

> Maintained working list. Larger initiatives live in [`ROADMAP.md`](./ROADMAP.md) — this doc
> covers concrete near-term tasks, manual testing, and small fixes not large enough for ROADMAP.
>
> Last updated: 2026-06-25 (Hermes first-run plan)

---

## Manual Testing Checklist

Things to verify end-to-end after recent orchestration and UI changes:

- [x] Ingest a fresh YouTube URL → confirm transcript + source nodes created
- [ ] Open `/terminal` → confirm socket connects and typed commands stream output
- [ ] Run `ai.run extract "..."` from `/terminal` → confirm a `RunNode` is created
- [ ] Run `shell.exec --enable-session --confirm`, then `shell.exec --confirm node --version`,
      then `shell.exec --disable-session`
- [ ] View `/vault/runs/[id]` for a terminal command → confirm command metadata is readable
- [ ] Verify dark mode renders correctly across all pages (no light backgrounds)
- [ ] Verify badge colors look correct in dark mode (nodes/[id], runs, sources, transcripts)
- [ ] Verify `/ingest` drag-and-drop still works after the shadcn migration
- [ ] Verify `/ingest` pipeline cards still show correct states for fresh ingest, reused transcript, and extract retry
- [ ] Verify sidebar nav expand/collapse + active route styling after the shadcn migration
- [ ] Verify `/vault` file tree selection and content preview after replacing the DS tree
- [ ] Ingest same URL again → confirm dedup fires (`Already saved` in UI)
- [ ] Ingest URL with content from different domains (d:infra, d:ui, etc.) → confirm tag variance
- [ ] Verify extraction produces ideas in `/vault/nodes/ideas/` with correct `source_id`
- [ ] View transcript detail page (`/vault/transcripts/[id]`) — check summary and linked ideas
- [ ] View idea node page (`/vault/nodes/[id]`) — confirm title renders, source_id visible
- [ ] View source detail page (`/vault/sources/[id]`) — confirm linked transcripts show
- [ ] Run `pnpm dev:clean:vault:recent:2h` → confirm it removes nodes from last 2 hours including ideas

---

## Up Next

- [ ] **Hermes first run — CLI, Discord, then read-only LLAAB MCP** — Hermes is installed; verify
      `hermes doctor`, foreground `hermes gateway`, standalone `pnpm dev:cli -- mcp`, then register
      only `vault_list` / `vault_read`.
      Detail: [`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md).
- [x] **Verify per-idea tag fix and confirm distinct tag sets** — extracted ideas were all
      showing the transcript's full, identical tag set; the fix now asks the LLM for tags
      per idea directly. Needs a rebuild + fresh extraction to confirm it actually works.
      Verified against generated vault artifacts: 21/18/27 extracted ideas across three
      transcript groups each had distinct per-idea tag sets, with zero matching the full
      transcript tag set.
      Detail: [`TODO_IDEA_TAG_RELEVANCE.md`](./TODO_IDEA_TAG_RELEVANCE.md).
- [x] **Migrate the ingest form pipeline to durable process state** — see
      [`TODO_PROCESS_STATE_AUDIT.md`](./TODO_PROCESS_STATE_AUDIT.md). `IngestForm.tsx`'s
      transcript/extraction status and elapsed timers are local-state-only despite
      `ingest-youtube` being `runSkill`-backed — same bug class fixed for consolidation
      (status disappears if the page remounts/is navigated away from mid-run).
      Done: `/ingest` now derives active ingest status from `useRunMonitor()` and lets the
      run-backed `ingest-youtube` request own extraction during initial ingest.

- [ ] **Build nav-unlocked observability pages** — start with `/llm/providers`,
      `/llm/capabilities`, `/system/doctor`, and `/system/harness`.
      Detail: [`TODO_NAV_UNLOCKED_PAGES.md`](./TODO_NAV_UNLOCKED_PAGES.md).

- [ ] **Update nav locks as pages land** — only flip `live: true` in
      `apps/client/src/lib/nav-menu.config.ts` after the page/route exists and passes
      the relevant client typecheck/build verification.

- [ ] **Decide extracted SkillNode behavior** — extraction returns `skills`, but the pipeline
      creates `IdeaNode`s only. Decide whether generated skill phrases become candidate
      `SkillNode`s, and what review/status model they should use.

---

## Documentation

- [ ] **Populate `apps/server/src/routes/AGENTS.md` stub sections** — Crons is fully written; Agent,
      Ingest, LLM, and Runs each currently have a one-line `> TODO — populate` placeholder plus a
      bare route list. Fill each in with the same depth as the Crons section (what the group owns,
      how its routes are wired/validated, any non-obvious behavior) following the file-map pattern
      already used in `apps/server/src/routes/vault/AGENTS.md`.

## Code — Small Fixes & Polish

- [ ] **Terminal follow-up UX** — vertical slice is complete and graduated to
      [`DONE_TERMINAL_PANEL.md`](./DONE_TERMINAL_PANEL.md). Remaining polish:
      add UI command injection from node/transcript pages (for example,
      "Read in Terminal" → `fs.read ...`), promote autocomplete from static suggestions to live
      vault path search, and hot-link URLs in terminal output once command streams show URLs.

- [x] **Extraction retry button** — `POST /api/vault/transcripts/:id/extract` route exists and
      transcript detail page includes "Re-extract" action.

- [x] **LLM model status indicator** — `/llm` page calls `GET /api/llm/status` and surfaces model
      routing/availability.

- [x] **`related` field on idea nodes** — currently always `[]`. Consider auto-linking extracted ideas
      to their transcript via `related` (in addition to `source_id`). Low priority — `source_id` is
      the primary provenance link.
      Done: both extraction paths set `related: [transcriptId]`; verified all 70 current idea
      files include their `source_id` in `related`.

- [x] **Expand LLM auto-tag triggers** — model-family terms such as `gemma`, `llama`,
      `mistral`, `qwen`, `phi`, and `gemini` now contribute to `d:llm` tagging through the
      Phase 6b auto-tag expansion.

- [x] **shadcn initial-setup audit** — fixed dark mode (`data-theme` → `class="dark"`), re-enabled
      `app.css`, removed duplicate framework imports, fixed light-mode badge hex colors across 6
      pages, installed `badge`, `breadcrumb`, `table`, `tooltip`, `scroll-area` to `packages/ui`.

---

## Near-Term Integration

- [x] **Install `@finografic/ai-harness` in the first LLAAB consumer package** — now added to
      `@llaab/ingestion`.

- [x] **Spike harness at the transcript extraction boundary** — `llm-extract.ts` now uses a small
      local harness prep pipeline before `control.execute(...)`.

- [x] **Validate the new extraction prep in real transcript ingestion** — run the actual ingest +
      extract flow and confirm the staged preparation is useful in practice.
      Start here:
      `packages/ingestion/src/extract/harness-prep.ts`,
      `packages/ingestion/src/extract/llm-extract.ts`,
      `packages/control/src/orchestrator.ts`.
      Done means:
      extraction succeeds, harness stages appear in trace output, and there is a written call on
      whether current truncation is acceptable.

- [x] **Compare current truncation-based prep vs harness-ready prep** — confirm what should stay
      local to LLAAB now and what should move into the harness package later.
      Specifically answer:
      should `prepareExtractionInput(...)` remain local for now, or is transcript length handling
      the next package-level feature gap?

- [x] **Decide next priority after consumer validation** — if transcript extraction still feels
      blocked by input prep limits, do harness extension before Terminal Panel. If not, Terminal
      Panel can stay next.
      Record that decision in both `ROADMAP.md` and `TODO_HARNESS.md`.

- [x] **Capture one short implementation note after validation** — update `TODO_HARNESS.md` with:
      what was tested, what failed or held up, and whether Phase 2 or Terminal should come next.

### Orchestration verdict

The orchestration foundation is complete: provider interface, LLM metadata, token-aware extraction
prep, command bus, Terminal Panel, capability routing, diagnostics, OpenCode registration, and
session-gated `shell.exec`. The next highest-value work is exposing this architecture through
small nav pages rather than adding another backend layer immediately.

---

## Roadmap Items — Current Priority Order

See [`ROADMAP.md`](./ROADMAP.md) for full descriptions. Suggested order:

1. **P0 — Nav-unlocked observability pages** — `/llm/providers`, `/llm/capabilities`,
   `/system/doctor`, `/system/harness`
2. **P1 — Execution pages** — `/agent`, `/execute/skills`, `/pipeline/extract`
3. **P1 — Extracted SkillNode creation** — decide and implement skill promotion from extraction
4. **P2 — Adapter expansion** — only when a concrete workflow needs a new external executor
5. **P2 — Harness package graduation** — move reusable token/chunk/context utilities into
   `@finografic/ai-harness` when the package boundary is clear
6. **P2 — Search and retrieval discipline** — design before unlocking `/vault/search`
7. **P3 — Source Auto-Follow** — agent loop slot exists; needs explicit trigger story
8. **P3 — Library Watch** — npmx.dev logic is portable; `PackageNode` schema needed first
9. **P3 — Karpathy graph** — defer until vault has meaningful node density (50+ nodes)

---

## Open Questions (carry-forward from architecture)

- **Harness priority call** — answered 2026-06-07: token-aware extraction prep was completed in
  the orchestration work. Remaining harness work is package-boundary cleanup, not a blocker for
  nav observability pages.

- **Tag origin tracking** — separate `autoTags` / `manualTags` fields vs. derive post-hoc?
  Decide before building solid/outline tag UI. Tracked in `DONE_TAXONOMY.md`.

- **LLM dev tools** — `/llm` covers status/routing; `/llm/providers`, `/llm/capabilities`, and
  `/system/doctor` are now the preferred surfaces for deeper diagnostics.

- **Skill extraction from transcripts** — the LLM currently extracts `ideas` and `skills` arrays
  from transcripts, but only `IdeaNode`s are created. `SkillNode`s from extraction are not yet
  implemented. Decision needed: should extracted `skills` phrases also become `SkillNode`s?

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
shell gating, and Ollama/LM Studio LLM routing exist. Future work is adding more external
execution adapters only when there is a concrete workflow driver. Near-term: evaluate
`@lmstudio/sdk` when agents/adapters need LM Studio model lifecycle control, tool-use, or local
agentic flows beyond the current OpenAI-compatible inference endpoint.

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
Integrate it with LLAAB's vault rather than building a custom graph UI from scratch.
LLAAB's vault exposes node relationships (source → transcript → idea → skill lineage) via
`listNodes` + `GET /api/vault/nodes` — the integration surface is an export/adapter, not a UI.
Scope TBD pending research into Karpathy Pattern's data format requirements.

### Source Auto-Follow

`SourceNode` has a `follow` field. Build a scheduled job that re-ingests followed sources when
new content appears. Agent loop registry already has the slot reserved (commented out).
Trigger: `lab agent run` or `POST /api/agent/run` on a user-controlled schedule.

### Hermes Layer (Discord → MCP → LLAAB)

Phone-operable Hermes gateway on Mac Studio: OpenCode Go + Ollama routing, Discord operator
console, LLAAB MCP tools for vault read/write. Separate long-running process — not inside
`apps/server`.

Detail: [`docs/todo/TODO_HERMES_LAYER.md`](./TODO_HERMES_LAYER.md)

### Terminal Agent and Hermes Integrations

Extend the Terminal Panel as the shared command surface for local LLAAB agents, future Hermes
tasks, and explicit automation. Commands remain typed, one-shot, and persisted as run history.

Detail: [`docs/todo/TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md)

### Crons Page and External Automation Recipes

Add a `/crons` page for one-shot automation recipes, manual runs, recent run history, and external
schedule snippets. LLAAB exposes jobs; `cron`, `launchd`, GitHub Actions, Vercel Cron, or another
external scheduler owns timing.

Detail: [`docs/todo/TODO_CRONS_PAGE.md`](./TODO_CRONS_PAGE.md)

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

### Cross-Tab Sync

Exploratory only — no concrete need yet. The root TanStack Query provider already syncs components
within the current tab; it cannot reach a second tab or window. `BroadcastChannel` is the candidate
if that ever becomes a real workflow (e.g. live run-status updates across tabs); WebSocket is
ruled out as it would require an always-on server connection, conflicting with the "LLAAB does
not own a scheduler" rule.

Detail: [`docs/todo/TODO_CROSS_TAB_SYNC.md`](./TODO_CROSS_TAB_SYNC.md)

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

| Date       | Item                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-13 | Client migration — Astro SSR replaced by Vite 8 + React Router SPA; vault auth/tree/clean APIs on server; Astro removed; persistent client uses `vite preview`. Detail: [`DONE_CLIENT_VITE_MIGRATION.md`](./DONE_CLIENT_VITE_MIGRATION.md) |
| 2026-06-07 | Navigation menu — `NavbarVertical` replaced by horizontal shadcn `NavigationMenu` in `AppHeader`; megamenu config in `nav-menu.config.ts`; future routes disabled with lock icon; `/icons` redirect; homepage Models card                  |
| 2026-06-06 | ESLint → oxlint migration — root, `apps/client`, `apps/server`, and `packages/ui` on oxlint + oxfmt; ESLint removed repo-wide; lint-staged and CI use oxlint                                                                               |
| 2026-06-06 | Zod v3 → v4 upgrade — all packages on `zod@^4`; `@llaab/schemas` + `@hono/zod-validator` in `apps/server` validated                                                                                                                        |
| 2026-06-06 | UI Refactor — shadcn expansion + typography system: type-scale tokens, px → rem, shadcn adoption, inline style cleanup. Detail: [`DONE_UI_REFACTOR.md`](./DONE_UI_REFACTOR.md)                                                             |
| 2026-04-18 | Foundational schema usage layer — `writeNode`/`updateNode`, `@llaab/control`, `RunNode` persistence, YouTube ingestion v1, controlled idea extraction. Detail: [`DONE_FOUNDATIONAL_LAYER.md`](./DONE_FOUNDATIONAL_LAYER.md)                |
| 2026-06-05 | SwiftBar overhaul — three-state service indicators (stopped/launching/running), per-service submenus, health-aware refresh timing, traffic-light icons                                                                                     |
| 2026-06-05 | Icons service hardening + lucide-manager polish — config-safe runtime dir, launchctl stability, optional branding img, relative img path auto-conversion, embedded picker UI improvements                                                  |
| 2026-06-01 | Client UI migration — remove PandaCSS and `@finografic/design-system`; adopt app-local shadcn/ui + Tailwind 4                                                                                                                              |
| 2026-05-28 | Repo public-readiness — vault privacy audit flow, initial `lab/` approvals, and prepare-to-publish cleanup                                                                                                                                 |
| 2026-04-29 | Vault browser nodes page — `PageLayout` + `FileList` + DS TreeView integration                                                                                                                                                             |
| 2026-04-27 | Layout system — `PageLayout`, `PageHero`, Finder-style `FileList`, sticky sidebar, layout guide                                                                                                                                            |
| 2026-04-20 | Transcript extraction UX + linking — `related`, ideas endpoint, linked idea cards, improved re-extract flow                                                                                                                                |
| 2026-04-19 | Ollama extraction stability — switch to chat API, local model fix, clean-vault script improvements                                                                                                                                         |
| 2026-04-18 | Dark theme + two-phase ingestion — layout refactor, transcript-first save, best-effort extraction                                                                                                                                          |
| 2026-04-17 | Vault page coverage — detail pages for nodes, transcripts, sources; all list pages linked; Sources in nav                                                                                                                                  |
| 2026-04-17 | Fix `llmExtract` — JSON system prompt, fence stripping, `parseJsonFromText`; agent loop now produces IdeaNodes                                                                                                                             |
| 2026-04-16 | MCP server — `lab mcp` stdio command, vault resources + vault_list/vault_read tools                                                                                                                                                        |
| 2026-04-16 | Hono RPC — typed `hc<AppType>` client, routers refactored to chain form, `api.ts` in client                                                                                                                                                |
| 2026-04-16 | Agent loop — one-shot processor, skill registry, dedup index, `/api/agent/*`, `lab agent run`                                                                                                                                              |
| 2026-04-16 | LLM communication layer — real Anthropic + Ollama providers, task router, cache, `/api/llm/*`                                                                                                                                              |
| 2026-04-16 | CLI — `lab ingest <url>` and `lab vault list [--type]` via citty                                                                                                                                                                           |
| 2026-04-16 | `apps/server` — Hono server + client migration (`api-client.ts`, remove skills/ingestion deps)                                                                                                                                             |
| 2026-04-16 | Taxonomy system — `autoTag`, `d:` tags, TagsInput on IngestForm, tag pills, skills doc                                                                                                                                                     |
| 2026-04-16 | Vault browser sub-pages — transcripts, nodes, runs list + run detail                                                                                                                                                                       |
| 2026-04-16 | Fix web ingest — route through `ingestYouTube` skill to produce `RunNode`                                                                                                                                                                  |
| 2026-04-15 | Rename `apps/web` → `apps/client`, `@llaab/web` → `@llaab/client`                                                                                                                                                                          |
| 2026-04-15 | `AppLayout` — sidebar shell, `NavbarVertical`, `AppHeader`, `AppFooter`                                                                                                                                                                    |
| 2026-04-15 | Fix vault path resolution — `vault-root.ts` anchored to `import.meta.url`                                                                                                                                                                  |
| 2026-04-15 | YouTube transcript fix — VTT format, trailing trim, word-level dedup                                                                                                                                                                       |
| 2026-04-13 | Ingest form, gated vault browser, Panda CSS, DS components wired                                                                                                                                                                           |
| 2026-04-08 | `@llaab/control`, `runSkill`, `RunNode` persistence, decision traces                                                                                                                                                                       |
| 2026-04-04 | Schema split, `createNode`, `listNodes`, `captureIdea` skill                                                                                                                                                                               |
| 2026-03-30 | Monorepo genesis — all packages scaffolded, lint, typecheck green                                                                                                                                                                          |
