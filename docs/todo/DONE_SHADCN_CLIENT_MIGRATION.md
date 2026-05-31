# DONE — Client Styling Migration to shadcn/ui

> **Completed:** 2026-06-01 — `apps/client` no longer depends on PandaCSS or `@finografic/design-system`; the UI now uses Tailwind v4 + shadcn/ui with the custom Stone preset.

---

## Why

The old client stack was carrying two costs:

- PandaCSS + generated `styled-system` output added config and build surface to a relatively small app
- `@finografic/design-system` made the client depend on a linked external package for core UI primitives

That setup made simple UI work heavier than it needed to be and kept the client coupled to an
out-of-repo design system.

The new direction is simpler:

- app-local styling primitives
- Tailwind v4
- shadcn/ui components
- a single custom theme preset applied directly in `apps/client`

---

## What Changed

### Styling foundation

- [x] Removed PandaCSS config and generated output from `apps/client`
- [x] Removed `@finografic/design-system` from the client dependency graph
- [x] Added Tailwind v4 via `@tailwindcss/vite`
- [x] Applied shadcn preset `b2oDq0a9Y`
- [x] Rebuilt `app.css` around local semantic CSS variables + shadcn theme tokens

### Client primitives

- [x] Added app-local shadcn config in `apps/client/components.json`
- [x] Added app-local aliases via `@/*`
- [x] Added local UI primitives under `apps/client/src/components/ui/`
- [x] Added local `cn(...)` helper in `apps/client/src/lib/utils.ts`

### Component refactor

- [x] Replaced DS/Panda usage in `IngestForm`
- [x] Replaced DS tags input in `CreateIdeaPanel`
- [x] Rebuilt `NavbarVertical` without DS `TreeView`
- [x] Rebuilt `VaultBrowser` without DS `TreeView` or `@finografic/icons`
- [x] Added local `TagInputField` helper for shared tag-entry UX

### Cleanup

- [x] Removed client references to `@styled-system/*`
- [x] Removed client references to `@finografic/icons`
- [x] Removed stale DS/Panda references from client docs

---

## Files of Interest

### Config

- `apps/client/components.json`
- `apps/client/tsconfig.json`
- `apps/client/astro.config.ts`
- `apps/client/package.json`

### Theme and primitives

- `apps/client/src/styles/app.css`
- `apps/client/src/styles/forms.css`
- `apps/client/src/components/ui/*`
- `apps/client/src/lib/utils.ts`

### Refactored components

- `apps/client/src/components/IngestForm.tsx`
- `apps/client/src/components/CreateIdeaPanel.tsx`
- `apps/client/src/components/NavbarVertical/NavbarVertical.tsx`
- `apps/client/src/components/VaultBrowser.tsx`
- `apps/client/src/components/TagInputField.tsx`

---

## Notes

- The migration intentionally keeps the existing app-level semantic CSS variable contract
  (`--bg`, `--surface`, `--text`, `--accent`, etc.) so route and layout styling did not need a
  full rewrite in the same pass.
- shadcn is installed app-local in `apps/client`; there is no shared `packages/ui` workspace yet.
- This was a client-only migration. Server routes and ingestion architecture were left intact.

---

## Verification

- [x] `pnpm install --filter @llaab/client...`
- [x] `pnpm --filter @llaab/client typecheck`
- [x] `pnpm --filter @llaab/client build`
