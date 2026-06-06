# TODO — UI Refactor: shadcn Expansion + Typography System

> **Status:** Phase 1 in progress (2026-06-06). Phases 2–3 not started.

Refactor the client UI to eliminate hand-rolled CSS components in favour of shadcn primitives,
and replace all hard `px` font-size declarations with a `rem`-based type scale so the root
`html { font-size }` actually controls the entire UI.

---

## Background

The initial client build accumulated a large amount of inline CSS — acceptable for rapid
prototyping but now creating friction:

- ~85% of `font-size` declarations use hard `px` values, bypassing the root `html` size entirely.
  Changing `html { font-size }` has almost no effect on the rendered UI.
- `forms.css` contains hand-rolled `.btn`, `.field`, `.tag`, `.badge`, `.status` components that
  duplicate functionality shadcn already provides — with better accessibility and consistent sizing.
- Inline `<style>` blocks in every `.astro` page re-declare the same sizing patterns.
- shadcn is installed and working but has zero components in `packages/ui/src/components/ui`.
  All 56 components now copied from `@finografic-lucide-manager` (same `radix-nova` / stone theme).

---

## Type Scale

Add to `apps/client/src/styles/app.css` `:root` block and use everywhere instead of raw `px`:

| Token         | rem       | px   | Usage                                   |
| ------------- | --------- | ---- | --------------------------------------- |
| `--text-2xs`  | 0.5625rem | 9px  | Sort icons, tiny indicators             |
| `--text-xs`   | 0.625rem  | 10px | Counts, small badges                    |
| `--text-sm`   | 0.6875rem | 11px | Labels, eyebrows, metadata              |
| `--text-md`   | 0.75rem   | 12px | Captions, hints, secondary text         |
| `--text-base` | 0.8125rem | 13px | Primary body (this app's de-facto base) |
| `--text-ui`   | 0.875rem  | 14px | Nav links, input text                   |
| `--text-lg`   | 1.25rem   | 20px | Detail page headings                    |
| `--text-xl`   | 1.375rem  | 22px | List page headings                      |
| `--text-2xl`  | 1.5rem    | 24px | Section headings                        |
| `--text-4xl`  | 2.25rem   | 36px | Homepage hero heading                   |

---

## Progress

### Phase 1 — shadcn component copy + adopt in high-traffic components

- [x] Copy all 56 components from `@finografic-lucide-manager` to `packages/ui/src/components/ui`
- [ ] Replace `.btn` / `.btn--sm` / `.btn--lg` in `forms.css` → shadcn `Button`
- [ ] Replace `.field`, `.field label`, `.field__hint`, `.field__error` → shadcn `Form` + `Label`
- [ ] Replace `input[type="text"]` raw styles → shadcn `Input`
- [ ] Replace `.tag`, `.tag--sm`, `.badge` across pages → shadcn `Badge`
- [ ] Replace `.status`, `.status-card` blocks → shadcn `Alert`
- [ ] Replace `FileList` raw `<table>` → shadcn `Table`
- [ ] Replace breadcrumb markup in transcript / source pages → shadcn `Breadcrumb`
- [ ] Identify tab-like patterns → shadcn `Tabs`

### Phase 2 — Type scale tokens + px → rem conversion

- [ ] Add type-scale tokens to `app.css` `:root`
- [ ] Convert `forms.css` remaining font-size declarations to tokens
- [ ] Convert `VaultBrowser.module.css` to tokens
- [ ] Convert `NavbarVertical.module.css` to tokens
- [ ] Convert `FileList.module.css` to tokens
- [ ] Convert `NodesFileList.module.css` to tokens
- [ ] Convert `AppHeader`, `AppHeaderV2`, `AppFooter` inline styles to tokens
- [ ] Convert `PageHero` (already rem — verify alignment with token scale)
- [ ] Convert all vault page `<style>` blocks (transcripts, sources, nodes, runs) to tokens
- [ ] Convert `index.astro` and `ingest.astro` page styles to tokens

### Phase 3 — Consolidate globals + cleanup

- [ ] Remove `html { font-size }` from `packages/ui/src/styles/globals.css` — `app.css` owns it
- [ ] Remove the `!important` flag once all competing declarations are gone
- [ ] Audit remaining inline `style=` attributes on HTML elements in `.astro` files
- [ ] Delete `forms.css` sections fully replaced by shadcn components
- [ ] Verify end-to-end: change `html { font-size }` in `app.css` → entire UI scales uniformly

---

## Files Affected

| File                                                     | Action                                            |
| -------------------------------------------------------- | ------------------------------------------------- |
| `apps/client/src/styles/app.css`                         | Add type-scale tokens; own the root font-size     |
| `apps/client/src/styles/forms.css`                       | Replace hand-rolled components; delete when empty |
| `packages/ui/src/styles/globals.css`                     | Remove duplicate `html { font-size }`             |
| `packages/ui/src/components/ui/`                         | Populate with 56 shadcn components                |
| `apps/client/src/components/VaultBrowser.module.css`     | px → token                                        |
| `apps/client/src/components/NavbarVertical/*.module.css` | px → token                                        |
| `apps/client/src/components/FileList/*.module.css`       | px → token; replace with shadcn Table             |
| `apps/client/src/components/NodesFileList/*.module.css`  | px → token; Badge for tags/counts                 |
| `apps/client/src/components/AppHeader/*.astro`           | px → token                                        |
| `apps/client/src/components/AppFooter/*.astro`           | px → token                                        |
| `apps/client/src/components/PageHero/*.astro`            | Verify rem alignment                              |
| `apps/client/src/pages/**/*.astro`                       | shadcn components; px → token in `<style>` blocks |
