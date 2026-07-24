# LLAAB — Roadmap

> **This is the primary high-level plan for the project.**
> Agents and contributors: check this file before proposing new work. Keep immediate validation,
> small follow-ups, large initiatives, and completed milestone history here.
>
> Last reconciled: 2026-07-24.

---

## Next

Short current execution queue. Keep this section small, actionable, and current; move detailed
implementation plans into `TODO_*.md` files.

### Up Next

- [ ] **Close podcast ingest validation** — add fixture-based episode matching coverage, then run
      one real Mac Studio `mlx_whisper` transcription and confirm the saved transcript, source,
      cleanup, extraction hand-off, and YouTube-caption fast path.
      Detail: [`TODO_PODCAST_INGEST.md`](./TODO_PODCAST_INGEST.md).
- [ ] **Finish vault/knowledge split validation** — verify ingest dirties only the nested vault
      repo, core app pages still load, discard removes expected files, and Telegram ingest/todo
      writes still work.
      Detail: [`TODO_VAULT_KNOWLEDGE_SPLIT.md`](./TODO_VAULT_KNOWLEDGE_SPLIT.md#phase-7--validation).
- [ ] **Make transcript re-extraction durable** — wrap the server workflow in `runSkill`, then
      derive transcript UI state from the shared run monitor so navigation cannot hide an active
      extraction.
      Detail: [`TODO_PROCESS_STATE_AUDIT.md`](./TODO_PROCESS_STATE_AUDIT.md#blocked-on-a-prerequisite).
- [ ] **Close the Hermes repository-pin gap** — add `vault_pin_repository`, route GitHub repository
      captures to the registry pin endpoint, preserve inbox provenance, and treat HTTP 409 as
      idempotent success.
- [ ] **Graduate completed planning docs** — after their remaining acceptance checks pass, rename
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

Start [`TODO_VERCEL_AI_SDK_MIGRATION.md`](./TODO_VERCEL_AI_SDK_MIGRATION.md) after the highest-risk
podcast/vault validation checks are closed or explicitly deferred.

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

1. standardising the LLM transport boundary
2. closing validation gaps in shipped workflows
3. adding retrieval and broader ingestion deliberately
4. exposing new UI only when it supports a real operator workflow

## P0 — Active

No large initiative is currently active. Immediate validation and cleanup tasks are maintained in
the [Next](#next) section.

## P1 — Next Up

### 1. Vercel AI SDK Transport Standardisation

Adopt Vercel AI SDK Core inside `@llaab/llm` while preserving LLAAB's `routeLlm()` /
`streamLlm()` API, task routing, cache, model catalogs, LM Studio lifecycle controls, RunNode
telemetry, and deterministic validation.

This is first because it is a bounded foundation improvement with immediate wins: shared provider
transport, true LM Studio/OpenCode streaming, consistent usage/error/timeout handling, a typed
structured-output path, and a cleaner multimodal boundary. It also reduces duplicated integration
work before retrieval, more ingestion types, or additional LLM workflows are added.

Detail: [`TODO_VERCEL_AI_SDK_MIGRATION.md`](./TODO_VERCEL_AI_SDK_MIGRATION.md)

### 2. Search and Retrieval Foundation

Define retrieval rules before unlocking `/vault/search` or adding broad RAG behavior. Start with a
deterministic local full-text search contract, context assembly limits, provenance requirements,
and explicit evaluation fixtures. Embeddings can be added later through the standardised LLM layer
when they materially improve ranking.

Reference: [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3

### 3. Article Ingestion

Replace the placeholder article fetcher with a real, bounded article ingestion path. Reuse the
existing transcript-first save/extract boundary and connect it to inbox docs/post captures. Keep
document/PDF ingestion separate because upload, parsing, and provenance requirements are different.

Planning doc required before implementation.

### 4. Extracted Skill Candidate Lifecycle

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

| Date       | Initiative                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | Podcast/RSS ingest implementation — Pocket Casts resolution, RSS matching, local whisper path, and YouTube-caption fast path; remaining live/fixture checks are in [Next](#next). |
| 2026-07-19 | One-step topic-oriented wiki generation — discover, compile, link, and auto-promote. Detail: [`DONE_WIKI_TOPIC_DISCOVERY_PIPELINE.md`](./DONE_WIKI_TOPIC_DISCOVERY_PIPELINE.md)   |
| 2026-07-15 | Wiki generation and knowledge promotion. Detail: [`DONE_WIKI_GENERATION.md`](./DONE_WIKI_GENERATION.md)                                                                           |
| 2026-07-11 | Grid layout migration. Detail: [`DONE_GRID_LAYOUT_MIGRATION.md`](./DONE_GRID_LAYOUT_MIGRATION.md)                                                                                 |
| 2026-07-10 | Registry package/repository resource projections and operational inbox integration.                                                                                               |
| 2026-07-09 | Vault/knowledge split core phases and inbox review workflows; final manual split validation remains in [Next](#next).                                                             |
| 2026-06-13 | Vite/React Router client migration. Detail: [`DONE_CLIENT_VITE_MIGRATION.md`](./DONE_CLIENT_VITE_MIGRATION.md)                                                                    |
| 2026-06-07 | Orchestration, provider, command bus, Terminal, capability, and harness foundations. Detail: [`DONE_ORCHESTRATION.md`](./DONE_ORCHESTRATION.md)                                   |
| 2026-06-07 | UI refactor and horizontal navigation foundation. Detail: [`DONE_UI_REFACTOR.md`](./DONE_UI_REFACTOR.md)                                                                          |
| 2026-04-18 | Foundational schemas, controlled extraction, RunNode persistence, and YouTube ingestion. Detail: [`DONE_FOUNDATIONAL_LAYER.md`](./DONE_FOUNDATIONAL_LAYER.md)                     |
