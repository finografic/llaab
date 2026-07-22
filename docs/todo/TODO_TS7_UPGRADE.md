# TODO — TypeScript 7 Upgrade

> **Status:** Not started.

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
