# Fable Migration Ledger

Branch: `codex/fable-ai-sdk-migration-setup` · Started: 2026-07-24 · Last updated: 2026-07-24 A0

## Status

A0 complete: 102 new characterization tests across 8 colocated files in `packages/llm/src` pin the
current `routeLlm`/`streamLlm`/`getLlmStatus` contract, cache semantics, routing config
merge/persistence, all four provider transports, and the OpenCode executor. No transport source has
changed. Branch was fast-forwarded onto master (TypeScript 7 pin commits) before starting.

## Resume Here

Start A1: add `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` to `packages/llm` only (one
pinned stable major), create the internal model-registry/result-mapping boundary
(`packages/llm/src/ai-sdk-model-registry.ts` per `TODO_VERCEL_AI_SDK_MIGRATION.md` Phase 1), set
explicit `maxRetries`, and run the relocated Phase 0 spike (TS7 strict-ESM typecheck + Bun smoke
against a mocked OpenAI-compatible endpoint). No provider switched yet; A0 tests stay untouched.

## Phase Log

| Phase                             | State                         | Commit      | Verified by                                                                                    |
| --------------------------------- | ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Setup                             | done — brief and ledger only  | 8c580799    | `pnpm run lint:md`; `git diff --check`                                                         |
| A0 characterization tests         | done — 102 tests, 8 files     | this commit | `pnpm exec vitest run packages/llm` (105 passing); `pnpm typecheck`; `pnpm lint`; `pnpm build` |
| A1 dependencies and boundary      | not started                   | —           | —                                                                                              |
| A2 provider migration             | not started                   | —           | —                                                                                              |
| A3 streaming                      | not started                   | —           | —                                                                                              |
| A4 cross-cutting behavior         | not started                   | —           | —                                                                                              |
| A5 verification and documentation | not started                   | —           | —                                                                                              |
| B process-state audit             | blocked until Task A complete | —           | —                                                                                              |

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
