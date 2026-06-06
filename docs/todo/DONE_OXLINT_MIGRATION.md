# DONE — ESLint → oxlint Migration

> **Completed:** 2026-06-06 — ESLint removed repo-wide; oxlint + oxfmt are the sole TS/JS lint and format pipeline.

## Progress

- [x] Phase 1 — oxlint installed, runs alongside ESLint (2026-04-17)
- [x] Phase 2 — Audit `@finografic/eslint-config` rule coverage; oxlint covers enforced rules
- [x] Phase 3 — ESLint replaced in lint-staged and CI; all `eslint.config.*` removed
- [x] Phase 4 — `@finografic/oxc-config` is the canonical shared config (`oxlintClientConfig` for React, root `oxlint.config.ts` for Node)

---

## Why and why now

oxlint is 50–100× faster than ESLint and integrates cleanly with oxfmt — same toolchain,
same config philosophy, no impedance mismatch. The earlier this happens, the smaller the
migration surface. The longer the ESLint config grows, the more rules need auditing and porting.

---

## Final state

| Location      | Config                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Root          | `oxlint.config.ts`, `oxfmt.config.ts` — Node packages + shared scripts |
| `apps/client` | `oxlint.config.ts`, `oxfmt.config.ts` — Astro + React client           |
| `apps/server` | Uses root `oxlint.config.ts` via relative path                         |
| `packages/ui` | `oxlint.config.ts`, `oxfmt.config.ts` — shadcn React components        |

- Root `package.json`: `lint` / `lint:fix` / `lint:ci` use oxlint; lint-staged runs `oxlint --fix` + `oxfmt`.
- Prettier remains only for `apps/client/**/*.astro` in lint-staged.
- ESLint is disabled in `.vscode/settings.json` (`eslint.enable: false`).

---

## Reference

- oxlint docs: `https://oxc.rs/docs/guide/usage/linter`
- Rule compatibility: `https://oxc.rs/docs/guide/usage/linter/rules`
- Shared config: `@finografic/oxc-config` (`oxlintClientConfig`, `oxfmt` presets)
