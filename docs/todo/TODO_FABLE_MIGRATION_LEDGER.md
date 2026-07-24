# Fable Migration Ledger

Branch: `codex/fable-ai-sdk-migration-setup` · Started: 2026-07-24 · Last updated: 2026-07-24 setup

## Status

Setup only. The Fable session brief exists, the roadmap validation checks are explicitly deferred
for this run, and no source migration work has started.

## Resume Here

Start Task A0 from [`docs/PROMPT_FABLE_SESSION.md`](../PROMPT_FABLE_SESSION.md): add
characterization tests for the current `@llaab/llm` router, cache, routing overrides, streaming,
errors, and RunNode telemetry before changing transport code.

## Phase Log

| Phase                             | State                         | Commit            | Verified by                            |
| --------------------------------- | ----------------------------- | ----------------- | -------------------------------------- |
| Setup                             | done — brief and ledger only  | this setup commit | `pnpm run lint:md`; `git diff --check` |
| A0 characterization tests         | not started                   | —                 | —                                      |
| A1 dependencies and boundary      | not started                   | —                 | —                                      |
| A2 provider migration             | not started                   | —                 | —                                      |
| A3 streaming                      | not started                   | —                 | —                                      |
| A4 cross-cutting behavior         | not started                   | —                 | —                                      |
| A5 verification and documentation | not started                   | —                 | —                                      |
| B process-state audit             | blocked until Task A complete | —                 | —                                      |

## Decisions

- Deferred podcast ingest and vault/knowledge split validation checks for this run because the AI
  SDK migration branch needs to start from a clean setup state and those checks require Mac Studio
  operator validation.

## Deferred / Noticed

- Podcast ingest fixture/live validation remains in `ROADMAP.md#next`.
- Vault/knowledge split manual validation remains in `ROADMAP.md#next`.

## Risks & Landmines

- Do not update `ROADMAP.md` until Task A is fully complete and verified; the session brief
  authorizes only the final completion roadmap edit.
- Do not edit consumer package source to fit the migration unless the brief's stop conditions are
  handled in this ledger first.
