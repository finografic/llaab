# DONE — TypeScript 7 Upgrade

> **Completed:** 2026-07-22 — TypeScript upgraded 6.0.3 → 7.0.2 workspace-wide; one real
> compatibility break found and fixed at the root cause (see completion report below).

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

- [x] Phase 1 — Confirmed latest stable TS 7.x release tag on npm (`7.0.2`); re-confirmed no
      compiler-API or `better-sqlite3` usage (2026-07-22).
- [x] Phase 2 — Captured full baseline (2026-07-22): see table above.
- [x] Phase 3 — Bumped `typescript` to `7.0.2` in root `package.json` (`devDependencies` +
      `pnpm.overrides`), `pnpm-workspace.yaml` `overrides`, and `packages/ui/package.json`;
      `pnpm install` clean (only unrelated pre-existing Vite peer-dependency warning).
- [x] Phase 4 — Ran full validation suite. `pnpm typecheck` initially failed in `apps/server`
      with 3× new TS7 diagnostic `TS2883` ("inferred type ... cannot be named without a reference
      to 'CloudModelProvider' ... likely not portable"). Root-caused and fixed (see below);
      typecheck now passes 16/16 tasks workspace-wide.
- [x] Phase 5 — Root-caused and fixed the `TS2883` failures: 1. `CloudModelProvider` was used structurally in `CloudCatalogModel.provider` but never
      re-exported from `packages/llm/src/index.ts` — added it to the type-only re-export list
      (along with a new named `RemoteModelDetail` interface, see next point). 2. `cloudCatalogModelToRemoteDetail()` in `packages/llm/src/cloud-model-catalog.ts` had no
      explicit return type — added an explicit `RemoteModelDetail` interface + return
      annotation so the type doesn't need to be auto-inferred/named across the package boundary. 3. Even after both fixes, `apps/server/src/routes/llm/llm.routes.ts` still failed with
      `TS2305: Module "@llaab/llm" has no exported member 'RemoteModelDetail'` when directly
      importing the new type — traced to **`packages/llm/dist` being stale** relative to
      `src` (last built 2026-07-13 vs. source edited 2026-07-22). TS7 treats a `composite: true`
      package's built declaration output as canonical for cross-package symbol resolution
      _even without an explicit tsconfig project reference_ — a stricter/changed behavior vs.
      TS6, where this had never surfaced because no code previously imported a _type_ (only
      _values_, which resolved fine via the plain `paths` source mapping) directly from
      `@llaab/llm` into `apps/server`. Rebuilt `packages/llm` (`pnpm --filter @llaab/llm build`)
      to resolve it, and added an explicit `import type { RemoteModelDetail }` + annotation on
      `remoteModelDetails` in `llm.routes.ts` so the compiler never needs to auto-synthesize the
      reference. 4. To prevent this class of staleness recurring, updated `turbo.json`'s `typecheck` task to
      `dependsOn: ["^build", "^typecheck"]` (was `["^typecheck"]` only) — composite packages'
      `dist` output is now guaranteed fresh before any dependent package typechecks.
      No `any`, `@ts-ignore`, `skipLibCheck`, or strictness relaxations were used — every fix was
      either a genuine missing type export or an explicit annotation the compiler asked for.
- [x] Phase 6 — Re-ran full validation suite on TypeScript 7.0.2: `pnpm lint` identical to
      baseline (same 6 pre-existing warnings, exit 0); `pnpm build` 8/8 pass; `pnpm test`
      identical to baseline (235/239, same 4 pre-existing failures, same assertions/line numbers —
      no TS7-induced regressions).
- [x] Phase 7 — Completion report below; graduating to `DONE_TS7_UPGRADE.md`.

---

## Completion report

1. **Version:** `typescript@6.0.3` → `typescript@7.0.2` (latest stable on npm as of 2026-07-22).
2. **Files changed:**
   - `package.json`, `pnpm-workspace.yaml`, `packages/ui/package.json` — version bump (3 declaration
     sites, all found during baseline orientation).
   - `pnpm-lock.yaml` — regenerated via `pnpm install`.
   - `packages/llm/src/cloud-model-catalog.ts` — added explicit `RemoteModelDetail` interface +
     return type on `cloudCatalogModelToRemoteDetail()`.
   - `packages/llm/src/index.ts` — re-exported `CloudModelProvider` and the new `RemoteModelDetail`.
   - `apps/server/src/routes/llm/llm.routes.ts` — explicit `RemoteModelDetail[]` annotation on
     `remoteModelDetails`.
   - `turbo.json` — `typecheck` task now `dependsOn: ["^build", "^typecheck"]` (was `["^typecheck"]`).
   - `packages/llm/dist/**` — rebuilt (was stale from 2026-07-13).
3. **Compatibility issues found:** one — TS7's new `TS2883` portability diagnostic, triggered by an
   inferred type (`CloudModelProvider`) not reachable through `@llaab/llm`'s declared public exports,
   surfacing through Hono's route-chain type inference in `apps/server`. Investigating the fix
   uncovered a second, previously-latent issue: TS7 resolves cross-package types through a composite
   package's built `dist` declarations rather than its `paths`-mapped source, even with no explicit
   project reference — meaning any composite package's stale `dist` can silently hide type changes.
   This had never surfaced under TS6 because no existing code imported a _type_ (only _values_, which
   resolve via source regardless) from `@llaab/llm` into `apps/server`.
4. **Code/config changes:** all additive — a missing type re-export, an explicit return-type
   annotation, an explicit local-variable annotation, and a build-graph correctness fix
   (`turbo.json`). No casts, `any`, `@ts-ignore`, `skipLibCheck`, or strictness relaxation.
5. **Results (TypeScript 7.0.2):** typecheck 16/16 ✅ · lint ✅ (6 pre-existing warnings, unchanged)
   · build 8/8 ✅ · test 235/239 (4 pre-existing failures, unchanged from baseline — see baseline
   table above for detail).
6. **TS6 compiler-API dependency:** none. No package in this repo uses `ts-morph`, `createProgram`,
   `createSourceFile`, or imports the `typescript` package programmatically — confirmed both before
   and after the upgrade. The `@typescript/typescript6` side-by-side fallback was not needed.
7. **`better-sqlite3`:** not used anywhere in this repository — N/A, no smoke test applicable.

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
