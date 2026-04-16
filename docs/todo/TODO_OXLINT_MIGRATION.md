# TODO — ESLint → oxlint Migration

> **Status:** Phase 1 — `oxlint` + root `oxlint.config.ts` added; run `pnpm lint:oxlint` alongside `pnpm lint` (ESLint + turbo) until coverage is audited.
> `oxfmt` is already installed with custom config. This migration pairs it with oxlint
> for a unified Rust-based lint + format pipeline.

---

## Why and why now

oxlint is 50–100× faster than ESLint and integrates cleanly with oxfmt — same toolchain,
same config philosophy, no impedance mismatch. The earlier this happens, the smaller the
migration surface. The longer the ESLint config grows, the more rules need auditing and porting.

Current state: `@finografic/eslint-config` is the shared config, used across all packages.
oxlint has coverage for the most common rule sets (no-unused-vars, no-console, typescript
rules, import rules). Rules ESLint has that oxlint doesn't yet cover can be dropped or
kept in a minimal ESLint pass during transition.

---

## Migration strategy

### Phase 1 — Run oxlint alongside ESLint (zero risk)

Install oxlint, add an `oxlint` script to the root, run it in CI alongside the existing
`eslint` script. This surfaces which rules fire and which don't, without breaking anything.

```bash
pnpm add -D oxlint         # or @oxc-project/oxlint if that's the package name
```

```json
// package.json scripts
"lint:oxlint": "oxlint .",
"lint": "pnpm lint:oxlint && pnpm lint:eslint"
```

### Phase 2 — Audit rule coverage

Go through `@finografic/eslint-config` rule by rule:

- Rule has an oxlint equivalent → mark for migration
- Rule has no equivalent → keep in residual ESLint pass
- Rule is typescript-eslint only → check oxlint TS support

Target: identify if a residual ESLint pass is even needed, or if oxlint covers 100%.

### Phase 3 — Replace ESLint in lint-staged and CI

Once oxlint covers all enforced rules, swap the lint-staged hook:

```json
// .lintstagedrc (or equivalent)
"*.{ts,tsx,js,jsx}": ["oxlint --fix", "oxfmt"]
```

Remove ESLint from `devDependencies` across all packages. Delete `eslint.config.ts`.

### Phase 4 — Update `@finografic/eslint-config`

If the shared config lives in the finografic monorepo, either:

- Archive it (if all consumers have migrated to oxlint)
- Or add an `oxlint.json` alongside it as the new canonical config

---

## Risks / unknowns

- **`@finografic/eslint-config` is shared.** Check if other finografic repos still depend
  on it before removing ESLint. This repo can migrate independently using `oxlint.json`
  directly, even if the shared config package persists elsewhere.

- **typescript-eslint rules.** oxlint's TS rule coverage is improving rapidly but not
  complete. The most important TS rules (no-explicit-any, consistent-type-imports, etc.)
  are covered. Audit which are actually enabled in this repo vs. the shared config.

- **Import rules.** `eslint-plugin-import` / `eslint-import-resolver-*` are common
  sources of slowness. oxlint's import rules cover most of what this plugin does.

---

## Reference

- oxlint docs: `https://oxc.rs/docs/guide/usage/linter`
- Rule compatibility: `https://oxc.rs/docs/guide/usage/linter/rules`
- `oxfmt` is already configured at: (check finografic DS package for oxfmt config location)
