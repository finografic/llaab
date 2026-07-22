# TODO — TypeScript 7 Upgrade

> **Status:** Phase 1–2 complete (2026-07-22). Baseline captured; upgrade not yet applied.

## Objectives

- Upgrade the repository's effective TypeScript compiler from 6.0.3 to the latest stable TypeScript 7.x.
- Preserve runtime behaviour, public APIs, strictness, module format, and build outputs.
- Smallest necessary change; no error suppression to force a pass.

---

## Baseline (recorded 2026-07-22)

- **Current version:** `typescript@6.0.3`, pinned via `pnpm-workspace.yaml` → `overrides: { typescript: 6.0.3 }`.
- **Workspace:** pnpm workspace (`packages/*`, `apps/*`) — 8 packages (`cli`, `control`, `core`, `icons`,
  `ingestion`, `llm`, `schemas`, `ui`) + 2 apps (`client`, `server`).
- **Direct `typescript` devDependency declarations:** only root `package.json` (line 83 + the
  `pnpm.overrides` block at line 89) and `packages/ui/package.json` (line 57). Every other package
  resolves `typescript` through the workspace override — small surface for the version bump itself.
- **Compiler API usage:** none found repo-wide (`ts-morph`, `createProgram`, `createSourceFile`,
  custom transformers, `from 'typescript'` imports) — step 6 of the task (side-by-side TS6 compat
  package) is likely **not needed**, but re-confirm after the bump in case anything surfaces
  transitively through a build tool.
- **`better-sqlite3`:** not used anywhere in this repo — step 7 of the task is **N/A**. Note this in
  the final report rather than silently skipping it.
- **Canonical commands:** `pnpm typecheck` (`turbo typecheck`), `pnpm test` (`vitest test`),
  `pnpm lint` (`oxlint -c oxlint.config.ts`), `pnpm build` (`turbo build`).
- **Note:** `packages/ui` build script uses `tsc` directly (see `DONE_OXLINT_MIGRATION.md` for the
  lint side of this workspace's tooling split) — confirm during Phase 2 whether any package's build
  step depends on `tsc`-specific CLI flags that changed in TS7.
- **Latest stable TS 7.x (npm, checked 2026-07-22):** `typescript@7.0.2` (`latest` dist-tag).
  `7.0.1-rc` and dev snapshots also exist; `7.0.2` is the one to install.

### Baseline validation results (2026-07-22, on TypeScript 6.0.3)

| Command          | Result                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` | ✅ pass                                                | 10/10 tasks, no errors                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm lint`      | ✅ pass                                                | 6 pre-existing `oxlint` warnings (not errors) in `packages/ui/src/components/chart.tsx`, `packages/ingestion/src/fetch/youtube-data-api.ts`, `youtube-subscription.ts`, and one server test file — unrelated to TS version, left untouched                                                                                                                                                   |
| `pnpm build`     | ✅ pass                                                | 8/8 tasks                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test`      | ❌ **4 pre-existing failures**, unrelated to this task | `packages/schemas/src/wiki.schema.test.ts` (1) and `apps/server/src/routes/vault/vault-wiki-drafts.routes.test.ts` (3) — all wiki-draft/schema logic failures (assertion mismatches on `verification_status`/tag validation and mock call counts), nothing TypeScript-related. **Recorded as baseline so post-upgrade test runs can be compared against this, not against a clean 239/239.** |

---

## Progress

- [ ] Phase 1 — Confirm latest stable TS 7.x release tag on npm; re-run the compiler-API and
      `better-sqlite3` searches once more immediately before upgrading (repo state may have moved).
- [ ] Phase 2 — Capture full baseline: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` output
      and timing, saved for comparison.
- [ ] Phase 3 — Bump `typescript` to the resolved 7.x version in root `package.json`
      (`devDependencies` + `pnpm.overrides`) and `packages/ui/package.json`; `pnpm install`.
- [ ] Phase 4 — Run full validation suite (typecheck → test → lint → build) and record failures
      per package.
- [ ] Phase 5 — Resolve failures at the root cause, package by package. No `any`, `@ts-ignore`,
      `skipLibCheck`, or strictness relaxation unless already present and independently justified.
      Diff any changed `.d.ts` output and classify each change as semantic vs. ordering-only.
- [ ] Phase 6 — Re-run full validation suite until clean.
- [ ] Phase 7 — Write completion report (see template below) and graduate this file to
      `DONE_TS7_UPGRADE.md`.

---

## Constraints

- Preserve strict TypeScript settings, ESM behaviour, package exports, pnpm/Turbo conventions.
- No unrelated refactors; no Node upgrade as part of this task.
- No npm/yarn commands — pnpm only.
- Do not touch unrelated dependencies unless TS7 compatibility requires it.

---

## Completion report template

1. Previous vs. final TypeScript version.
2. Files changed.
3. Compatibility issues found.
4. Code/config changes made.
5. typecheck / lint / test / build results.
6. Any dependency still requiring the TS6 compiler API (expected: none, per baseline).
7. `better-sqlite3` runtime smoke test result (expected: N/A, not used in this repo).
