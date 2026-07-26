# LLAAB — Roadmap

> **This is the primary high-level plan for the project.**
> Agents and contributors: check this file before proposing new work. Keep immediate validation,
> small follow-ups, large initiatives, and completed milestone history here.
>
> Last reconciled: 2026-07-26.

---

## Next

Short current execution queue. Keep this section small, actionable, and current; move detailed
implementation plans into `TODO_*.md` files.

### Active Experiment — Local Agent-Pipeline Integration

LLAAB is being driven by a local `@finografic/ai-agent-pipeline` integration experiment: each issue
spins up a worktree at `~/.agent-pipeline/worktrees/<N>-<slug>/` paired with an `agent/<N>-<slug>`
branch (e.g. `agent/9-clarify-local-agent-pipeline-integration`) and aimed at one PR. Progress is
tracked per-issue via the worktree branch and PR history — not via a roadmap item. The experiment is
tooling for cutting roadmap work, not a roadmap deliverable itself; the unfinished items in
[Up Next](#up-next) remain the source of truth for pending projects and are not marked complete by
this experiment.

> `pipeline status` (the local `pipeline` CLI at `~/.bun/bin/pipeline`) reports the agent-pipeline
> runtime queue/state (e.g. `WIP: 1/1`) and is an **inspection command only** — it is not a separate
> workflow that must be run to complete roadmap work. `pipeline run`/`gate`/`abort` drive the
> worktree lifecycle; `status` and `doctor` only observe it.

> Gate review comments now render visible status icons: `✅` for pass, `❌` for fail, and `⚠️` for
> warnings.

### Up Next

- [x] **Finish outstanding LLM Migration bugfixes**
      Detail: [`DONE_BUGFIXES_LLM_MIGRATION.md`](./DONE_BUGFIXES_LLM_MIGRATION.md).

- [x] **Close podcast ingest validation** — add fixture-based episode matching coverage, then run
      one real Mac Studio `mlx_whisper` transcription and confirm the saved transcript, source,
      cleanup, extraction hand-off, and YouTube-caption fast path.
      Detail: [`DONE_PODCAST_INGEST.md`](./DONE_PODCAST_INGEST.md).
- [x] **Finish vault/knowledge split validation** — verify ingest dirties only the nested vault
      repo, core app pages still load, discard removes expected files, and Telegram ingest/todo
      writes still work.
      Detail: [`DONE_VAULT_KNOWLEDGE_SPLIT.md`](./DONE_VAULT_KNOWLEDGE_SPLIT.md#phase-7--validation).
- [x] **Make transcript re-extraction durable** — wrap the server workflow in `runSkill`, then
      derive transcript UI state from the shared run monitor so navigation cannot hide an active
      extraction.
      Detail: [`DONE_PROCESS_STATE_AUDIT.md`](./DONE_PROCESS_STATE_AUDIT.md).
- [x] **Close the Hermes repository-pin gap** — add `vault_pin_repository`, route GitHub repository
      captures to the registry pin endpoint, preserve inbox provenance, and treat HTTP 409 as
      idempotent success.
- [x] **Graduate completed planning docs** — after their remaining acceptance checks pass, rename
      stale `TODO_` documents to `DONE_` and update inbound links.

### Manual Testing Checklist

#### One-Step Wiki Creation

- [ ] Consolidate a broad regression transcript and click **Create Wiki(s)** once.
- [ ] Confirm several coherent topics auto-promote without draft/candidate review steps.
- [ ] Confirm an ambiguous/invalid branch creates no suffixed wiki and does not block siblings.
- [ ] Confirm evidence metrics separate refs, transcripts, channels, and independent sources.
- [ ] Re-run unchanged generation for stable no-op/update, then test Unpublish and regeneration.

#### Runtime Surfaces

- [ ] Open `/terminal` and confirm typed commands stream output.
- [ ] Run `ai.run extract "..."` and confirm a durable `RunNode` is created.
- [ ] Verify `/llm` shows current provider/model routing and availability.
- [ ] Verify dark mode across primary app, vault, registry, inbox, and knowledge routes.

### Next Large Initiative

Start Search and Retrieval Foundation. The AI SDK migration is delivered; embeddings are explicitly
deferred until retrieval design proves a measurable ranking need.

## Priority Model

| Tier | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| P0   | Active — being implemented now                                   |
| P1   | Next up — scoped and ready to start                              |
| P2   | Planned — valuable, but needs an earlier dependency or rescoping |
| P3   | Backlog — retain the idea without committing near-term capacity  |

## Current State

The primary ingest-to-knowledge loop is operational:

```text
YouTube or podcast
  → transcript
  → extracted ideas
  → canonical ideas
  → focused wiki discovery / compile / link
  → promoted knowledge wiki
```

The repository also has durable `RunNode` process state, provider/model routing, an operational
inbox, package and repository registries, a terminal command surface, Hermes/MCP integration, and
the nested private vault plus committed knowledge split.

The roadmap therefore shifts away from proving basic orchestration and toward:

1. closing validation gaps in shipped workflows
2. adding retrieval and broader ingestion deliberately
3. exposing new UI only when it supports a real operator workflow

## P0 — Active

No large initiative is currently active. Immediate validation and cleanup tasks are maintained in
the [Next](#next) section.

## P1 — Next Up

### 1. Search and Retrieval Foundation

Define retrieval rules before unlocking `/vault/search` or adding broad RAG behavior. Start with a
deterministic local full-text search contract, context assembly limits, provenance requirements,
and explicit evaluation fixtures. Embeddings can be added later through the standardised LLM layer
when they materially improve ranking.

Reference: [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3

### 2. Article Ingestion

Replace the placeholder article fetcher with a real, bounded article ingestion path. Reuse the
existing transcript-first save/extract boundary and connect it to inbox docs/post captures. Keep
document/PDF ingestion separate because upload, parsing, and provenance requirements are different.

Planning doc required before implementation.

### 3. Extracted Skill Candidate Lifecycle

The extraction schema returns `skills[]`, but the pipeline persists only `IdeaNode`s. Decide whether
model-extracted skills become provisional `SkillNode`s, another candidate shape, or remain trace
metadata. Define provenance, review, promotion, and execution eligibility before writing nodes.

This decision should precede richer agent/skill execution pages.

## P2 — Planned

### System Diagnostics and Execution Surfaces

Rescope [`TODO_NAV_UNLOCKED_PAGES.md`](./TODO_NAV_UNLOCKED_PAGES.md) before implementation:

- keep provider/model routing on the existing `/llm` page rather than duplicating it across
  `/llm/providers` and `/llm/capabilities`
- consider a capability section within `/llm`
- retain `/system/doctor` as the strongest read-only observability candidate
- build `/agent`, `/execute/skills`, and `/pipeline/extract` only when their operator workflows
  are clearer than the existing Terminal, transcript detail, and Runs surfaces

### Document Ingestion

Add explicit PDF/Office upload and parsing after article ingestion establishes the shared
provenance and extraction contracts. Do not combine remote article fetching and local document
upload into one implementation.

### Hermes Cost Controls and Terminal Integration

Complete bounded model-tier routing for routine Hermes reads versus expensive reasoning, then add
one-shot Terminal integration only where it preserves approval gates and durable run history.

Detail: [`TODO_HERMES_LAYER.md`](./TODO_HERMES_LAYER.md),
[`TODO_TERMINAL_AGENT_INTEGRATIONS.md`](./TODO_TERMINAL_AGENT_INTEGRATIONS.md)

### Harness Package Graduation

Token-aware chunking works locally in LLAAB. Graduate only genuinely reusable token, chunk, and
context helpers into `@finografic/ai-harness`; do not move LLAAB-specific extraction policy.

Detail: [`TODO_HARNESS.md`](./TODO_HARNESS.md)

### Source Auto-Follow

Implement user-triggered, one-shot refresh recipes for followed sources after retrieval and
additional ingestion contracts settle. External scheduling remains outside `apps/server`.

## P3 — Backlog

### Registry Watch Automation

Rescope [`TODO_LIBRARY_WATCH.md`](./TODO_LIBRARY_WATCH.md) around the existing package/repository
registry and projected `ResourceNode`s. Do not introduce a parallel `PackageNode` model merely to
refresh metadata.

### LLM Benchmark Metadata

Evaluate whether external LLM Stats data would improve model selection on `/llm`. Keep this behind
the transport migration and require a clear operator decision it enables.

Detail: [`TODO_LLM_STATS_PAGE.md`](./TODO_LLM_STATS_PAGE.md)

### Knowledge Graph Visualisation

Add a graph adapter/view only after search and retrieval contracts prove which relationships are
useful. Reuse the promoted-wiki graph as the source of truth rather than generating a second graph.

### Tree Search Extraction

Retain multi-model adaptive inference as an experiment until ordinary structured extraction has
measured failure cases that justify the added cost and complexity.

Detail: [`TODO_TREE_SEARCH_EXTRACTION.md`](./TODO_TREE_SEARCH_EXTRACTION.md)

### Cross-Tab Sync

Revisit only when a concrete multi-window workflow requires it. Current TanStack Query state is
adequate within one tab.

Detail: [`TODO_CROSS_TAB_SYNC.md`](./TODO_CROSS_TAB_SYNC.md)

## Delivered

| Date       | Initiative                                                                                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-26 | Vercel AI SDK transport standardisation — Anthropic/OpenCode/LM Studio transport migrated behind `@llaab/llm`, real LM Studio/OpenCode streaming, typed structured output, vision boundary, native Ollama parity decision, and embedding deferral. Detail: [`DONE_VERCEL_AI_SDK_MIGRATION.md`](./DONE_VERCEL_AI_SDK_MIGRATION.md) |
| 2026-07-26 | LLM migration bugfix pass — provider override, cache key/bypass semantics, consolidation/wiki transport retries, and LM Studio progress parser coverage closed. Detail: [`DONE_BUGFIXES_LLM_MIGRATION.md`](./DONE_BUGFIXES_LLM_MIGRATION.md)                                                                                      |
| 2026-07-26 | Vault/knowledge split validation — nested vault dirty-state isolation, app loading, discard behavior, and Hermes Telegram YouTube/todo writes validated. Detail: [`DONE_VAULT_KNOWLEDGE_SPLIT.md`](./DONE_VAULT_KNOWLEDGE_SPLIT.md)                                                                                               |
| 2026-07-26 | Podcast/RSS ingest — Pocket Casts resolution, RSS matching, local whisper path, YouTube-caption fast path, and full extraction hand-off validated. Detail: [`DONE_PODCAST_INGEST.md`](./DONE_PODCAST_INGEST.md)                                                                                                                   |
| 2026-07-19 | One-step topic-oriented wiki generation — discover, compile, link, and auto-promote. Detail: [`DONE_WIKI_TOPIC_DISCOVERY_PIPELINE.md`](./DONE_WIKI_TOPIC_DISCOVERY_PIPELINE.md)                                                                                                                                                   |
| 2026-07-15 | Wiki generation and knowledge promotion. Detail: [`DONE_WIKI_GENERATION.md`](./DONE_WIKI_GENERATION.md)                                                                                                                                                                                                                           |
| 2026-07-11 | Grid layout migration. Detail: [`DONE_GRID_LAYOUT_MIGRATION.md`](./DONE_GRID_LAYOUT_MIGRATION.md)                                                                                                                                                                                                                                 |
| 2026-07-10 | Registry package/repository resource projections and operational inbox integration.                                                                                                                                                                                                                                               |
| 2026-07-09 | Vault/knowledge split core phases and inbox review workflows.                                                                                                                                                                                                                                                                     |
| 2026-06-13 | Vite/React Router client migration. Detail: [`DONE_CLIENT_VITE_MIGRATION.md`](./DONE_CLIENT_VITE_MIGRATION.md)                                                                                                                                                                                                                    |
| 2026-06-07 | Orchestration, provider, command bus, Terminal, capability, and harness foundations. Detail: [`DONE_ORCHESTRATION.md`](./DONE_ORCHESTRATION.md)                                                                                                                                                                                   |
| 2026-06-07 | UI refactor and horizontal navigation foundation. Detail: [`DONE_UI_REFACTOR.md`](./DONE_UI_REFACTOR.md)                                                                                                                                                                                                                          |
| 2026-04-18 | Foundational schemas, controlled extraction, RunNode persistence, and YouTube ingestion. Detail: [`DONE_FOUNDATIONAL_LAYER.md`](./DONE_FOUNDATIONAL_LAYER.md)                                                                                                                                                                     |
