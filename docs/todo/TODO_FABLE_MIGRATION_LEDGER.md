# Fable Migration Ledger

Branch: `codex/fable-ai-sdk-migration-setup` · Started: 2026-07-24 · Last updated: 2026-07-24 A1

## Status

A0 and A1 complete. 102 characterization tests pin the pre-migration contract; the AI SDK
(`ai@7`, `@ai-sdk/anthropic@4`, `@ai-sdk/openai-compatible@3`) is installed in `packages/llm`
only, with the internal boundary in `packages/llm/src/ai-sdk-model-registry.ts`
(`resolveAiSdkModel`, `toProviderResult`, `AI_SDK_MAX_RETRIES = 0`) kept out of `index.ts`.
Bun smoke (`bun run packages/llm/scripts/ai-sdk-bun-smoke.ts`) passes on Bun 1.2.2. No provider
transport has switched yet.

## Resume Here

Start A2, one provider per commit with all `packages/llm` tests green after each:

1. Anthropic — migrate `providers/anthropic.ts` complete/stream to `generateText`/`streamText`
   via `resolveAiSdkModel('anthropic', …)`; keep throwing `'Unexpected response type from
Anthropic'` when the response yields no text so the A0 fetch-level tests in
   `providers/anthropic.test.ts` pass unmodified. Drop `@anthropic-ai/sdk` when unreferenced.
2. OpenCode — migrate `providers/opencode.ts`; keep the pre-fetch `'OPENCODE_API_KEY is not
configured'` throw and catalog/availability logic outside the transport.
3. LM Studio — replace only the `/chat/completions` call; lifecycle preflight, CLI inspection,
   progress polling stay as-is.

## Phase Log

| Phase                             | State                                                                | Commit      | Verified by                                                                                    |
| --------------------------------- | -------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Setup                             | done — brief and ledger only                                         | 8c580799    | `pnpm run lint:md`; `git diff --check`                                                         |
| A0 characterization tests         | done — 102 tests, 8 files                                            | 94ba1a1     | `pnpm exec vitest run packages/llm` (105 passing); `pnpm typecheck`; `pnpm lint`; `pnpm build` |
| A1 dependencies and boundary      | done — deps, registry, smoke                                         | this commit | `pnpm exec vitest run packages/llm` (109 passing); `pnpm typecheck`; `pnpm build`; Bun smoke   |
| A2 provider migration             | in progress — anthropic 5fe4105, opencode this commit; lmstudio next | this commit | `pnpm exec vitest run packages/llm` (109 passing); `pnpm typecheck`; `pnpm build`              |
| A3 streaming                      | not started                                                          | —           | —                                                                                              |
| A4 cross-cutting behavior         | not started                                                          | —           | —                                                                                              |
| A5 verification and documentation | not started                                                          | —           | —                                                                                              |
| B process-state audit             | blocked until Task A complete                                        | —           | —                                                                                              |

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

## Deferred / Noticed

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
