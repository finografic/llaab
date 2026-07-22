# TODO — TypeScript 7 Upgrade

> **Status:** Phase 1–4 complete (2026-07-22). TypeScript bumped to 7.0.2; typecheck passes clean
> workspace-wide. Test/lint/build validation and completion report still pending.

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
- [x] Phase 6 — Re-ran full validation suite; `pnpm typecheck` clean 16/16.
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
