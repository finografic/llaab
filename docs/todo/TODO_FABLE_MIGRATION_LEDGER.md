# Fable Migration Ledger

Branch: `codex/fable-ai-sdk-migration-setup` · Started: 2026-07-24 · Last updated: 2026-07-26

## Status

Task A complete (A0–A5). Anthropic, OpenCode, and LM Studio completions all run through AI SDK
`generateText` via `ai-sdk-model-registry.ts` with transport retries pinned to 0; Anthropic
streams through `streamText`. Ollama stays on the native client (Phase 6 parity decision
pending). LM Studio keeps its CLI lifecycle preflight, progress polling, and
`AbortSignal.timeout` completion-timeout semantics; OpenCode keeps its pre-request API-key gate
and catalog logic. `@anthropic-ai/sdk` removed. A3: LM Studio and OpenCode `stream()` really stream via
`streamText` (consuming `fullStream` so transport errors still throw); `streamLlm`'s
caller-facing shape is unchanged. A4: additive `routeLlmObject()` typed structured-output API
(AI SDK `Output.object` for anthropic/opencode; deterministic JSON-extraction fallback for
local providers) with `LlmObjectResult` / `LlmStructuredOutputError` exported from the barrel.
A5 closeout done: full verification run, `.agents/handoff.md` LLM Layer updated, migration doc
status/checkboxes updated (kept as `TODO_`), no roadmap edit (see Decisions).

## Resume Here

Task A is complete. Task B (process-state audit) was later completed in
`docs/todo/DONE_PROCESS_STATE_AUDIT.md`. Phase 4 is now complete: wiki-link enrichment uses
`routeLlmObject()` while keeping deterministic validation; retry ownership is documented as SDK
transport retries pinned to `0`, `@llaab/control` semantic retries, and workflow-owned transport
retries; local structured-output fallback keeps deterministic JSON extraction. Phase 5 is now
complete: code-image extraction uses `routeLlmVisionObject()` and shared structured-output
validation. The next migration-doc work is the Phase 6 Ollama parity decision.

## Phase Log

| Phase                             | State                                                        | Commit   | Verified by                                                                                                   |
| --------------------------------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------- |
| Setup                             | done — brief and ledger only                                 | 8c580799 | `pnpm run lint:md`; `git diff --check`                                                                        |
| A0 characterization tests         | done — 102 tests, 8 files                                    | 94ba1a1  | `pnpm exec vitest run packages/llm` (105 passing); `pnpm typecheck`; `pnpm lint`; `pnpm build`                |
| A1 dependencies and boundary      | done — deps, registry, smoke                                 | 7ff1976  | `pnpm exec vitest run packages/llm` (109 passing); `pnpm typecheck`; `pnpm build`; Bun smoke                  |
| A2 provider migration             | done — anthropic 5fe4105, opencode 109adf1, lmstudio 8792891 | 8792891  | `pnpm exec vitest run packages/llm` (109 passing) after each provider; `pnpm typecheck`; `pnpm build`         |
| A3 streaming                      | done — lmstudio + opencode real streaming                    | 303aaa8  | `pnpm exec vitest run packages/llm` (112 passing); `pnpm typecheck`; `pnpm build`                             |
| A4 cross-cutting behavior         | done — routeLlmObject + structured-output boundary           | 1d5e7fe  | `pnpm exec vitest run packages/llm` (122 passing); `pnpm typecheck`; `pnpm build`                             |
| A5 verification and documentation | done — handoff, doc status, final summary                    | 3eb3d46  | `pnpm test` (355 passing, only the 4 pre-existing wiki failures); `pnpm typecheck`; `pnpm lint`; `pnpm build` |
| B process-state audit             | not started — deliberate (see Resume Here)                   | —        | —                                                                                                             |

## Decisions

- Deferred podcast ingest and vault/knowledge split validation checks for this run (require Mac
  Studio operator validation).
- **Pre-existing test failures, not caused by this work:** `pnpm test` at branch start already has
  4 failures in `packages/schemas/src/wiki.schema.test.ts` and
  `apps/server/src/routes/vault/vault-wiki-drafts.routes.test.ts` (verified by stashing all A0
  changes and re-running). Left untouched per scope discipline; "green" for this migration means
  zero new failures and all `packages/llm` tests passing.
- **Phase 0 SDK spike relocated to A1.** `TODO_VERCEL_AI_SDK_MIGRATION.md` Phase 0 includes
  installing the AI SDK and a Bun smoke run; the session brief scopes A0 to tests only with no new
  deps. Brief wins on scope — the spike happens first thing in A1.
- **Sanctioned A3 test change, pre-declared:** the single-chunk pseudo-stream tests in
  `providers/lmstudio.test.ts` ("yields the full completion as a single chunk") and
  `providers/opencode.test.ts` (same name) pin current behaviour that A3 deliberately replaces
  with real streaming. Replacing exactly those two tests in A3 is the only sanctioned exception to
  "A0 tests pass unmodified".
- **A2 provider order will follow the migration doc, not the brief's suggestion.** The brief
  suggests Ollama first; the migration doc explicitly keeps Ollama on the native client until its
  Phase 6 parity decision and migrates Anthropic + OpenCode (Phase 2) then LM Studio (Phase 3).
  Repo doc wins on specifics.
- **AI SDK version pin (A1):** `ai@^7.0.37` + `@ai-sdk/anthropic@^4.0.19` +
  `@ai-sdk/openai-compatible@^3.0.14`, resolved against workspace `zod@4.4.3`. One major across
  the whole migration; uses the v7 `generateText`/`streamText` API (usage fields
  `inputTokens`/`outputTokens`, `maxOutputTokens`, model instances are `LanguageModelV4`).
- **Transport retries pinned to 0** (`AI_SDK_MAX_RETRIES`): the SDK default of 2 would multiply
  LLAAB's semantic retries. Enforced by a call-count test in `ai-sdk-model-registry.test.ts`.
- **A2 Anthropic wire-shape test adjustment (sanctioned, logged here per brief §0.8):**
  `@ai-sdk/anthropic` serializes `system` and user message `content` as text-block arrays where
  `@anthropic-ai/sdk` sent plain strings — both canonical per the Anthropic API. The two affected
  assertions in `providers/anthropic.test.ts` now compare joined block text (`textOf`) instead of
  string equality; every other A0 assertion (URL, method, `max_tokens`, usage mapping, error
  messages, SSE stream deltas) passes byte-identical. Alternative rejected: forcing string
  serialization would mean forking the provider's request builder.
- **A2 OpenCode wire-shape test adjustment (sanctioned, logged here per brief §0.8):** the AI SDK
  emits lowercase header names plus an additive `user-agent` header. The header assertion in
  `providers/opencode.test.ts` now normalizes via `Headers` and pins `authorization` +
  `content-type` values instead of exact-object equality. Request bodies stayed byte-identical
  (plain-string message content), so all body pins pass unmodified. Error contract preserved by
  `mapOpenCodeError` (APICallError status/body → `OpenCode request failed: …`; malformed success
  responses → `Unexpected response from OpenCode`; statusless network errors propagate).
- **`@ai-sdk/gateway` is a transitive dep of `ai@7`** (its default global provider). LLAAB never
  uses it — all models come from `resolveAiSdkModel` — so the "no AI Gateway dependency"
  acceptance criterion is about usage, not node_modules presence. Size impact of all AI SDK
  packages combined: ~13 MB in `node_modules/.pnpm` (acceptable).
- **No TODO→DONE rename and no ROADMAP edit (A5).** The brief authorises both "if Task A is fully
  complete", and its A0–A5 shape is complete — but the brief also says the migration doc wins on
  specifics, and that doc still tracks open work (Phase 4 consumer pilot, Phases 5–8). The repo's
  todo-done convention forbids renaming while unchecked items remain, and marking the roadmap P1
  item Delivered would misstate the doc's status. Conservative choice: doc stays `TODO_` with an
  accurate status header and per-phase checkboxes; ROADMAP.md untouched; the operator can judge
  whether "transport standardisation" as a roadmap initiative is close enough to done to move it.
  Rejected alternative: rename + Delivered row now, which would orphan Phases 5–8.

- **A4 structured-output design:** `routeLlmObject(task, prompt, zodSchema, opts?)` is additive
  public API (frozen exports unchanged). Anthropic/OpenCode routes use the AI SDK
  `Output.object` path; ollama/lmstudio routes use text generation + deterministic JSON
  extraction (`structured-output.ts`) because local models fence JSON and LM Studio's model
  lifecycle lives in `complete()`. No caching for object responses in v1. Failures throw
  `LlmStructuredOutputError` carrying the raw model text. Note: the openai-compatible chat model
  does not send `response_format` JSON schemas (AI SDK warns "responseFormat is not supported")
  — prompts must instruct JSON output; validation happens SDK-side/LLAAB-side.

## Deferred / Noticed

- **Consumer-side structured-output pilot (wiki-link enrichment) done on 2026-07-26** —
  `linkWikiTopics()` now calls `routeLlmObject()` with a structured payload schema, then preserves
  deterministic `validateWikiLinkSuggestions()` domain validation.
- **Migration doc Phases 6 (Ollama parity decision), 7 (embeddings), and the live-app parts of
  Phase 8** remain open in `TODO_VERCEL_AI_SDK_MIGRATION.md`.
- **Phase 5 vision boundary done on 2026-07-26** — `routeLlmVisionObject()` applies the same
  deterministic structured-output extraction/validation to multimodal local-provider output, and
  `packages/cli` no longer owns code-image JSON parsing.
- Podcast ingest fixture/live validation remains in `ROADMAP.md#next`.
- Vault/knowledge split manual validation remains in `ROADMAP.md#next`.
- `resolveModel` in `packages/llm/src/router.ts` has an inert ternary (a model override never
  changes the provider — both branches identical). Pinned as current behaviour in
  `router.contract.test.ts`; not "fixed".
- Cache key excludes `system`/`maxTokens`, and `cacheSet` still writes under `bypassCache: true`.
  Pinned as current behaviour; not changed.

## Risks & Landmines

- Do not update `ROADMAP.md` until Task A is fully complete and verified; the session brief
  authorizes only the final completion roadmap edit.
- Do not edit consumer package source to fit the migration unless the brief's stop conditions are
  handled in this ledger first.
- **Unprotected areas (no A0 coverage — take extra care when migrating):** LM Studio progress-poll
  internals (`lms ps` line-parsing regex, 2.5s cadence, duplicate suppression — only the
  `onProgress` lifecycle and stop-on-error are pinned); real `AbortSignal.timeout` /
  `execFile` timeout firing (only the requested ms values are pinned); Anthropic SDK retry/backoff
  on 408/429/5xx; live wire formats (fixtures encode assumed shapes); legacy `summarizeText`
  (`client.ts`); `cloud-model-catalog.ts` resolution/persistence.
- Router/config tests chdir into a temp dir because `configs/llm-routing.json` and
  `configs/cloud-model-catalog.json` paths resolve from `process.cwd()` at module load — this
  relies on Vitest's default forks pool and breaks under `pool: 'threads'`.

## Final Summary (Task A)

**Shipped** (branch `codex/fable-ai-sdk-migration-setup`, commits 94ba1a1 → this commit): 122
`packages/llm` tests (102-test A0 characterization net + A1/A3/A4 additions); AI SDK Core
transport (`ai@7`, `@ai-sdk/anthropic@4`, `@ai-sdk/openai-compatible@3`, `zod@4` in
`packages/llm` only) behind `ai-sdk-model-registry.ts` with `maxRetries` 0; Anthropic, OpenCode,
and LM Studio completions migrated; real streaming for LM Studio and OpenCode; additive
`routeLlmObject()` + `LlmObjectResult` + `LlmStructuredOutputError`; `@anthropic-ai/sdk`
removed; Bun smoke script `packages/llm/scripts/ai-sdk-bun-smoke.ts`. Public API frozen —
consumers compile with zero source edits (full-workspace `pnpm typecheck` and `pnpm build`
green).

**Unprotected by tests:** LM Studio progress-poll internals; real timeout firing; live provider
wire quirks (fixtures encode assumed shapes — first live LM Studio/OpenCode/Anthropic calls
after this migration deserve a watchful eye); legacy `summarizeText`; `cloud-model-catalog.ts`.
The structured-output SDK path sends no `response_format` schema (prompt-driven JSON).

**Human must verify manually:** `/llm` page shows correct provider/model routing and
availability after Rebuild & Reload; one real extraction/consolidation run end-to-end (RunNode
telemetry fields: model, provider, duration_ms, prompt_tokens, completion_tokens); LM Studio
live completion incl. model auto-load and progress; `/api/llm/stream` streaming behaviour in
the browser; the 4 pre-existing wiki test failures (unrelated to this work) still need an owner.
