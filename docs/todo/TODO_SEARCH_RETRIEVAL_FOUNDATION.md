# TODO — Search and Retrieval Foundation

> **Status:** Active (2026-07-26). Phases 0–2 complete; Phase 3 context assembly started.

## Goal

Define and implement LLAAB's first deterministic retrieval layer before adding `/vault/search`,
RAG-like context stuffing, embeddings, or graph-heavy UI. The first version should make local vault
search useful, testable, provenance-aware, and safe to reuse inside model workflows.

## Why Now

The ingest-to-knowledge loop is operational, and the vault is large enough that `listNodes({
search })` substring matching is no longer a sufficient system boundary. Retrieval should become an
explicit contract: given a query and constraints, return ranked, inspectable local evidence with
clear snippets, match reasons, and deterministic limits.

## Current Baseline

- `listNodes({ search })` performs simple case-insensitive substring matching across title, tags,
  and body.
- `GET /api/vault/nodes?search=...` exposes that same list filter.
- MCP `vault_list` exposes the same primitive for Hermes and other local agents.
- There is no first-class search result shape, score, snippet, matched-field list, context budget,
  or retrieval evaluation fixture.

## Product Decisions

- Start with local deterministic full-text retrieval; do not add embeddings yet.
- Treat embeddings as a later ranking adapter only after fixtures show measurable improvement.
- Retrieval results are evidence references, not trusted knowledge promotion.
- Context assembly must distinguish direct source material, derived summaries, operational
  instructions, and execution history.
- All retrieval work is one-shot and request-bound; no background indexing, watchers, or scheduler.
- Hermes and other MCP clients should use `vault_search` for compact ranked evidence, then
  `vault_read` for explicitly selected full content.
- UI comes after the search contract is stable enough to avoid reworking the operator surface.

## Non-Goals

- No vector database.
- No embedding API in this phase.
- No automatic source refresh or external web retrieval.
- No broad chat/RAG UI.
- No graph visualization.
- No vault mutations from retrieval.

## Phase 0 — Contract and Fixtures

- [x] Define a `VaultSearchQuery` / `VaultSearchResult` contract with deterministic ordering,
      matched fields, snippets, source path, node type, tags, status, and provenance metadata.
- [x] Add a fixture corpus that covers transcripts, canonical ideas, resources, wiki drafts, inbox
      captures, runs, and instructions.
- [x] Add ranking fixtures for title hits, tag hits, body hits, recency tie-breaks, and type/status
      filters.
- [x] Document the expected behavior for empty queries, short queries, limit handling, and no-match
      results.

## Phase 1 — Core Search Service

- [x] Add a core search service that reads vault nodes and returns the contract from Phase 0.
- [x] Keep route handlers thin; search scoring, snippet creation, and field matching live in the
      owning service layer.
- [x] Preserve existing `listNodes()` behavior so current routes and MCP tools do not regress.
- [x] Add focused unit tests for scoring, snippets, filters, and deterministic ordering.

## Phase 2 — API and MCP Surface

- [x] Add a read-only `GET /api/vault/search` endpoint after the core contract is tested.
- [x] Add a read-only `vault_search` MCP tool that returns compact result summaries and node IDs.
- [x] Keep `vault_list` available for basic listing and backward compatibility.
- [x] Document Hermes usage boundaries before expanding any write-capable MCP surface.

## Phase 3 — Context Assembly

- [x] Define a reusable context-packet shape for workflow inputs.
- [x] Add deterministic context assembly limits by token/character budget and evidence kind.
- [x] Require every packet to carry source node ID, title, type, path, snippet/source span when
      available, and why it was selected.
- [x] Add fixtures showing that context assembly prefers relevant evidence over large undifferentiated
      prompt stuffing.

## Phase 4 — Operator UI

- [ ] Unlock a minimal `/vault/search` view only after API and MCP behavior are stable.
- [ ] Surface query, filters, result groups, match reasons, snippets, and open/read actions.
- [ ] Avoid graph or RAG chat UI until retrieval behavior has real operator feedback.
- [ ] Add manual browser checks for dense desktop and mobile layouts.

## Phase 5 — Embedding Decision Gate

- [ ] Compare deterministic search against fixture expectations and real operator misses.
- [ ] Define measurable ranking failures that embeddings should improve.
- [ ] If needed, add an embedding adapter through `@llaab/llm` after the contract is stable.
- [ ] If not needed, explicitly keep embeddings deferred.

## Validation

- [x] Run focused core tests for search ranking and snippets.
- [x] Run server route tests for `/api/vault/search`.
- [x] Run MCP smoke test for `vault_search`.
- [ ] Run client tests/build only when the UI phase begins.
- [ ] Run markdown lint and format checks for this plan.

## References

- [`ROADMAP.md`](./ROADMAP.md) — current P0 owner.
- [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3 — retrieval and context
  assembly rationale.
- [`DONE_VERCEL_AI_SDK_MIGRATION.md`](./DONE_VERCEL_AI_SDK_MIGRATION.md) — embedding boundary
  deferred until this work defines measurable need.
- [`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md) — deferred `vault_search` MCP tool.
