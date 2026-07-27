# DONE — Search and Retrieval Foundation

> **Status:** Done (2026-07-28). Deterministic local retrieval is complete; embeddings remain
> explicitly deferred until real misses prove a measurable ranking need.

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

- [x] Unlock a minimal `/vault/search` view only after API and MCP behavior are stable.
- [x] Surface query, result metadata, match reasons, snippets, and open/read actions.
- [x] Add filters and result grouping after the minimal result list has operator feedback.
- [x] Avoid graph or RAG chat UI until retrieval behavior has real operator feedback.
- [x] Add manual browser checks for dense desktop and mobile layouts.

## Phase 5 — Embedding Decision Gate

- [x] Compare deterministic search against fixture expectations and real operator misses.
- [x] Define measurable ranking failures that embeddings should improve.
- [x] Decide whether an embedding adapter through `@llaab/llm` is needed after the contract is
      stable.
- [x] Explicitly keep embeddings deferred because no repeatable ranking miss requires them yet.

## Embedding Decision

Embeddings are **not needed yet**.

The deterministic search contract now has fixture coverage for title, tag, body, recency tie-break,
type/status/tag filters, representative vault node types, provenance, snippets, no-match behavior,
and bounded context assembly. The current `/vault/search`, `GET /api/vault/search`, and
`vault_search` MCP surfaces are good enough to collect operator feedback without adding a vector
store, embedding lifecycle, cache invalidation path, or background indexing.

Add embeddings only after at least one repeatable miss is captured where deterministic search cannot
rank the expected evidence high enough. A future embedding adapter should improve one of these
measurable failures:

- synonym or paraphrase queries miss evidence whose exact terms are absent
- conceptually related evidence ranks below unrelated exact string matches
- long transcript bodies hide the expected source despite relevant snippets
- multi-hop evidence needs semantic recall before graph/context assembly can help

If those misses appear, add embeddings as a ranking adapter behind the existing
`VaultSearchQuery` / `VaultSearchResult` contract through `@llaab/llm`; do not replace the current
deterministic search API or make retrieval depend on a background index.

## Follow-On — `chat.ask` (2026-07-28)

The first consumer of this foundation is the Terminal `chat.ask` command, which answers open-ended
questions by treating `knowledge/` and `vault/` as retrieved context for the routed model. It adds
`searchKnowledgeDocs` (the `knowledge/` counterpart to `searchVaultNodes`, sharing the tokenizer and
snippet builder) and consumes `buildVaultContextPackets` unchanged — the retrieval contract defined
here needed no revision to support it. Detail: `.agents/handoff.md` § Apps → `@llaab/client`.

Live validation of that command exposed one ranking defect in this phase's tokenizer, now fixed:
`tokenizeSearchQuery` performed no stopword or punctuation handling, so a natural-language question
matched `the` / `of` / `for` against every document body while a trailing `?` prevented the real
term from matching at all. Asking "What is the capital city of Portugal?" returned 8 knowledge hits
scoring 140–240; after filtering stopwords and trimming surrounding punctuation the same question
returns 1 hit scoring 20, while "What are the rules for agent execution in LLAAB?" keeps its full
knowledge-tier result set. Queries consisting only of stopwords fall back to the raw terms, so a
literal search for `the` still returns results. This improves `/vault/search` and `vault_search`
equally, and does not change the result, provenance, or context-packet shapes.

## Validation

- [x] Run focused core tests for search ranking and snippets.
- [x] Run server route tests for `/api/vault/search`.
- [x] Run MCP smoke test for `vault_search`.
- [x] Run client tests/build only when the UI phase begins.
- [x] Run markdown lint and format checks for this plan.
- [x] Record the embedding decision gate outcome.

## References

- [`ROADMAP.md`](./ROADMAP.md) — delivered milestone and next large initiative owner.
- [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3 — retrieval and context
  assembly rationale.
- [`DONE_VERCEL_AI_SDK_MIGRATION.md`](./DONE_VERCEL_AI_SDK_MIGRATION.md) — embedding boundary
  deferred until this work defines measurable need.
- [`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md) — deferred `vault_search` MCP tool.
