# TODO — Vercel AI SDK Migration

> **Status:** Phases 0–7 complete/deferred (2026-07-26). Code-image extraction routes through
> `@llaab/llm`; Ollama intentionally remains on the native client; embeddings are deferred until
> retrieval design proves a measurable need.
> Transport migrated inside `@llaab/llm` on branch `codex/fable-ai-sdk-migration-setup`; see
> [`TODO_FABLE_MIGRATION_LEDGER.md`](./TODO_FABLE_MIGRATION_LEDGER.md). Live closeout checks remain
> open in Phase 8.

---

## Goal

Use Vercel AI SDK Core as the provider-agnostic inference engine beneath `@llaab/llm`, reducing
provider-specific transport code while preserving LLAAB's domain-level routing, local-first model
support, durable process state, and deterministic output validation.

Target boundary:

```text
skills / ingestion / server
  → routeLlm() / streamLlm() / routeLlmObject()
  → LLAAB task routing, cache, progress, and telemetry
  → AI SDK Core
  → Anthropic / LM Studio / OpenCode / selected Ollama adapter
```

## Why Now

- `@llaab/llm` already provides the correct ownership boundary.
- Anthropic, LM Studio, OpenCode, and Ollama repeat completion/stream/result mapping.
- LM Studio and OpenCode currently simulate streaming by yielding one completed response.
- Structured workflows repeatedly strip fences, find JSON, parse it, and apply Zod separately.
- Vision extraction has separate Ollama and LM Studio request implementations.
- Search/retrieval may later need a consistent embedding interface.

This is a bounded foundation improvement before adding more model-backed workflows.

## Preserve

- `routeLlm()`, `streamLlm()`, `resolveLlmRoute()`, and current task names
- persisted `configs/llm-routing.json` provider/model choices
- the 24-hour cache and explicit cache invalidation behavior
- `LlmCompleteResult` fields used by RunNode traces and UI
- model catalogs, availability checks, and provider-qualified model options
- LM Studio CLI model loading, unload/load overrides, progress polling, and model inspection
- Ollama model listing, capabilities, context-length inspection, and `num_ctx` behavior
- `@llaab/control` semantic retry/reject decisions
- deterministic wiki, extraction, consolidation, and link validation
- OpenCode executor behavior; executor adapters are not inference transports

## Non-Goals

- replacing LLAAB task routing with Vercel AI Gateway
- adopting `@ai-sdk/react` or building a chat UI
- replacing RunNode/control semantics with AI SDK agents
- migrating Hermes provider configuration
- removing tolerant normalization from wiki compilation
- forcing Ollama onto a community provider before parity is proven
- adding embeddings before retrieval requirements are defined

## Proposed Dependencies

Add to `@llaab/llm` only:

- `ai`
- `@ai-sdk/anthropic`
- `@ai-sdk/openai-compatible`

Keep `ollama` initially. Evaluate an Ollama AI SDK provider in a separate phase.

Pin one stable AI SDK major version across the migration. Do not mix examples from older
`generateObject()` APIs with the selected version's `generateText()` plus `Output.object()` API.

## Progress

- [x] Phase 0 — baseline contracts and runtime spike
- [x] Phase 1 — internal AI SDK model registry and shared result mapping
- [x] Phase 2 — Anthropic and OpenCode migration
- [x] Phase 3 — LM Studio migration with lifecycle preservation
- [x] Phase 4 — typed structured-output boundary and low-risk pilot
- [x] Phase 5 — multimodal vision migration
- [x] Phase 6 — Ollama parity decision
- [x] Phase 7 — optional embedding boundary deferred until retrieval design
- [ ] Phase 8 — telemetry, documentation, and migration closeout

## Phase 0 — Baseline Contracts and Runtime Spike

- [x] Record the current public behavior of `routeLlm()`, `streamLlm()`, cache hits, usage fields,
      provider ids, model overrides, progress callbacks, and error propagation.
- [x] Add focused contract tests around the public router rather than testing SDK internals.
- [x] Add provider transport tests with mocked HTTP responses for Anthropic-compatible metadata and
      OpenAI-compatible completion/stream payloads.
- [x] Verify the chosen AI SDK version typechecks under strict ESM, TypeScript 7, Node 24, and the
      Bun server runtime.
- [x] Run one minimal Bun smoke call against a local or mocked OpenAI-compatible endpoint
      (`packages/llm/scripts/ai-sdk-bun-smoke.ts`).
- [x] Confirm package size and dependency changes are acceptable before migrating providers.

Exit criteria: the SDK can run inside `@llaab/llm` under Bun without changing a consumer.

## Phase 1 — Internal Model Registry and Shared Mapping

- [x] Add a named implementation module such as `ai-sdk-model-registry.ts`; keep `index.ts` as a
      barrel only.
- [x] Map existing provider ids and model ids to AI SDK `LanguageModel` instances (anthropic,
      lmstudio, opencode; ollama stays native pending Phase 6).
- [x] Use the official Anthropic provider for `anthropic`.
- [x] Use separate `createOpenAICompatible()` instances for `lmstudio` and `opencode`.
- [x] Centralise conversion from AI SDK results to `LlmProviderResult` /
      `LlmCompleteResult`, including duration and token usage.
- [x] Set transport retries explicitly. Do not rely on AI SDK defaults because several LLAAB
      workflows already retry semantic/schema failures.
- [x] Add explicit abort/timeout options without weakening the existing LM Studio completion
      timeout.
- [x] Preserve provider-specific request options through a small typed internal mapping rather than
      leaking AI SDK `providerOptions` to consumers.

Exit criteria: one internal model resolver can serve text generation without changing public types.

## Phase 2 — Anthropic and OpenCode

- [x] Migrate Anthropic completion and streaming to `generateText()` / `streamText()`.
- [x] Preserve system prompts, output-token limits, usage counts, provider/model ids, and errors.
- [x] Migrate OpenCode completion through its OpenAI-compatible endpoint.
- [x] Replace OpenCode's one-chunk pseudo-stream with actual streamed text deltas.
- [x] Preserve the OpenCode model catalog and availability logic outside the transport.
- [x] Remove `@anthropic-ai/sdk` only after all direct imports are gone and parity tests pass.

Exit criteria: Anthropic and OpenCode pass the router contract tests and OpenCode streams multiple
deltas from a streaming fixture.

## Phase 3 — LM Studio

- [x] Keep `ensureRequestedModelLoaded()` as an explicit preflight before generation.
- [x] Keep CLI model inspection, load overrides, and progress polling owned by LLAAB.
- [x] Replace only `/chat/completions` request/response handling with the OpenAI-compatible provider.
- [x] Preserve `LLAAB_LMSTUDIO_BASE_URL`, API key, temperature, and completion timeout semantics.
- [x] Replace LM Studio's one-chunk pseudo-stream with real text streaming.
- [x] Ensure progress polling always stops on success, provider error, timeout, or abort.
- [x] Keep model listing and embedding-model filtering independent of AI SDK transport.

Exit criteria: local completion, timeout, progress, usage, and streaming behavior remain observable
through existing routes and RunNode metadata.

## Phase 4 — Structured Output

- [x] Add a LLAAB-owned API such as `routeLlmObject()` that accepts a schema and returns typed data
      plus the same provider/model/usage metadata as `routeLlm()`.
- [x] Keep AI SDK types private to `@llaab/llm`; consumers should depend on LLAAB types and schemas.
- [x] Distinguish transport retries from semantic retries in `@llaab/control`.
      → AI SDK transport retries stay pinned to `0` at `generateText()`/`streamText()` boundaries;
      `@llaab/control` owns schema/semantic retry decisions through `onInvalid`/`onFailure`, and
      workflow-specific transport retries remain explicit one-shot choices outside the SDK.
- [x] Pilot structured output on a low-risk, optional workflow such as wiki-link enrichment.
      → `linkWikiTopics()` now calls `routeLlmObject()` with a wiki-link payload schema, while
      preserving best-effort warning-only failure behavior.
- [x] Retain deterministic validation that rejects unknown ids, invalid relationships, weak
      rationales, and other domain errors after schema validation.
      → Structured rows still pass through `validateWikiLinkSuggestions()` before any proposed link
      is accepted.
- [x] Preserve access to raw model text/usage when structured generation fails
      (`LlmStructuredOutputError` carries the raw model text).
- [x] Evaluate JSON-extraction middleware for local models that still return fenced JSON
      (deterministic fence/prose extraction ships as the local-provider fallback; middleware
      rejected for now because local providers still need tolerant text-to-object extraction, and
      OpenAI-compatible structured generation does not enforce JSON-schema response format here).
- [x] Do not migrate wiki compilation first; its tolerant normalization and repair behavior is
      intentional.
- [x] Do not remove extraction/consolidation repair paths until model/provider parity is measured.

Exit criteria: one production workflow uses typed structured output with no loss of domain
validation or diagnostics.

## Phase 5 — Multimodal Vision

- [x] Extend the internal LLAAB request shape to support text plus image content without exposing
      provider-specific payloads.
      → Added `LlmImageInput`, provider `completeWithImage`, and `routeLlmVision()`.
- [x] Route code-image extraction through `@llaab/llm` instead of separate CLI fetch functions.
      → `packages/cli` now delegates to `routeLlmVisionObject()` and only owns prompt construction
      plus code-extraction result normalization.
- [x] Preserve LM Studio model loading before multimodal requests.
      → `lmStudioCompleteWithImage()` reuses the provider's model-load preflight and timeout/env
      helpers.
- [x] Preserve Ollama image support while the Ollama transport decision remains open.
      → `ollamaCompleteWithImage()` preserves the native Ollama chat image payload and JSON-format
      request.
- [x] Replace ad hoc image extraction parsing with the structured-output boundary where provider
      compatibility is proven.
      → Added `routeLlmVisionObject()` and removed CLI-local JSON parsing.
- [x] Add fixtures for code screenshot, non-code image, malformed output, and low confidence.

Exit criteria: the CLI no longer owns provider-specific vision HTTP payloads.

## Phase 6 — Ollama Parity Decision

- [x] Compare the existing official `ollama` client with current AI SDK community providers and
      Ollama's OpenAI-compatible endpoint.
- [x] Verify chat/system separation, real streaming, multimodal input, structured output,
      `num_ctx`, `num_predict`, reasoning, usage counts, errors, and abort behavior.
- [x] Verify model list/show capabilities and context-length inspection remain available.
- [x] Keep the native adapter if AI SDK integration would reduce reliability or local controls.
- [x] Record that no provider package pin or migration contract suite is needed while Ollama stays
      native.

Exit criteria: an explicit documented keep/migrate decision based on parity, not API uniformity
alone.

Decision: keep Ollama on the native `ollama` client for now.

Evidence:

- Current `ollama-ai-provider-v2@4.0.1` targets AI SDK `^7.0.0` and exposes `num_ctx`,
  `num_predict`, streaming, embeddings, and multimodal-capable chat models, so it is a plausible
  future adapter.
- LLAAB still relies on `ollama show` metadata for `capabilities`, native context-length
  extraction from `model_info`, model catalog details, and availability checks.
- The native adapter already preserves image payloads, `format: 'json'`, `num_ctx`, `num_predict`,
  stream chunks, usage counts, and local error behavior with focused coverage.
- Migrating text generation alone would not remove the native client because listing/show/context
  inspection still need it, and migrating vision now would add a community dependency without
  eliminating risk.

Revisit when one of these is true:

- The AI SDK has an official or first-party Ollama provider with list/show metadata parity.
- LLAAB adds embeddings and chooses a shared Ollama embedding boundary.
- Native Ollama request handling becomes a maintenance burden compared with the community adapter.

## Phase 7 — Optional Embedding Boundary

Start only after search/retrieval defines a measurable need.

- [x] Add LLAAB-owned `embedText()` / `embedManyTexts()` APIs and embedding route configuration.
      → Deferred until retrieval ranking has a measurable fixture set; no API added now.
- [x] Evaluate LM Studio and Ollama embedding models through the same provider registry.
      → Deferred with the API; premature provider wiring would be unused surface area.
- [x] Add deterministic caching keyed by provider, model, and content hash.
      → Deferred with embeddings; cache design depends on the retrieval contract.
- [x] Connect embeddings to the existing optional wiki-discovery similarity hook only after
      fixture-based ranking evaluation.
- [x] Record model, dimensions, content hash, and provenance for reproducibility.
      → Retained as requirements for the future retrieval initiative.

Decision: do not add embeddings in this migration. The next roadmap item is Search and Retrieval
Foundation, which should define the measurable ranking/evaluation need first.

## Phase 8 — Closeout

- [x] Update `packages/llm` and orchestration documentation with the final provider boundary.
- [x] Document retry ownership: transport, structured-output, semantic, and workflow retries.
- [x] Document which providers support text, streaming, structured output, vision, tools, and
      embeddings.
- [x] Verify `/api/llm/complete`, `/api/llm/stream`, and `/llm`.
      → 2026-07-26 local smoke: `/llm` returned the Vite app shell; `/api/llm/complete` returned
      text/provider/model/duration; `/api/llm/stream` returned SSE data and `[DONE]`.
- [ ] Verify extraction, consolidation, wiki creation, and image-code extraction.
- [x] Run focused package/app typechecks and provider contract tests.
      → Ran focused `@llaab/llm`, `@llaab/cli`, and `@llaab/server` typechecks/build/tests around
      the migrated boundary.
- [x] After server-consumed package changes, run the required Rebuild & Reload App workflow before
      browser verification.
- [ ] Graduate this document to `DONE_VERCEL_AI_SDK_MIGRATION.md` and move the roadmap item to
      Delivered.

## Acceptance Criteria

- Existing consumers require no direct AI SDK imports.
- Existing task/provider/model routing configuration remains valid.
- Cache behavior and invalidation semantics remain unchanged.
- OpenCode and LM Studio provide true streaming.
- Usage and duration metadata remain available to RunNode traces.
- Retry multiplication is prevented by explicit settings and tests.
- LM Studio lifecycle/progress behavior remains intact.
- At least one low-risk workflow uses typed structured output.
- Bun runtime smoke verification passes.
- Ollama remains reliable, whether native or migrated.
- No Vercel-hosted service or AI Gateway dependency is introduced.

## Risks

| Risk                                                         | Mitigation                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| AI SDK transport retries multiply LLAAB semantic retries     | Set `maxRetries` explicitly and test total call counts                          |
| Local models reject JSON Schema response formats             | Pilot selectively; retain raw text parsing and extraction middleware            |
| Strict schemas reject outputs current normalizers can repair | Keep domain normalization after generation and avoid wiki compile first         |
| LM Studio lifecycle behavior is lost                         | Keep load/progress/model-inspection code as LLAAB preflight and metadata layers |
| Community Ollama provider drifts                             | Keep native Ollama until parity and maintenance quality are proven              |
| SDK types leak through the monorepo                          | Expose only LLAAB-owned request/result types                                    |
| Bun incompatibility appears despite Node support             | Require Phase 0 Bun smoke before provider migration                             |
