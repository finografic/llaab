# TODO — Migrate Tailwind Layouts to `@llaab/ui` Grid

> **Status:** Not started. Large migration — convert page/section Tailwind layout
> (`flex` / `grid` / `grid-cols-*` / responsive column utilities) to
> `Container` / `Row` / `Col` from `components/ui/grid`. Do **not** treat as a blind
> find-and-replace: micro-alignment, shadcn internals, and intentional special layouts stay
> Tailwind/CSS-module based unless a phase explicitly opts them in.

📅 Jul 11, 2026

## Goal

Make multi-column and responsive page layouts consistent across LLAAB by using the shared
12-column flexbox grid in `@llaab/ui`, instead of one-off Tailwind layout classes.

Reference:

- [`docs/components/grid.md`](../components/grid.md)
- [`packages/ui/src/components/grid/grid.md`](../../packages/ui/src/components/grid/grid.md)
- Existing call sites (patterns to copy):
  - [`apps/client/src/routes/registry-search.tsx`](../../apps/client/src/routes/registry-search.tsx)
  - [`apps/client/src/routes/registry-repos-search.tsx`](../../apps/client/src/routes/registry-repos-search.tsx)
  - [`apps/client/src/components/TranscriptsSplitView/components/TranscriptsSidebar.tsx`](../../apps/client/src/components/TranscriptsSplitView/components/TranscriptsSidebar.tsx)
  - [`apps/client/src/components/TranscriptsSplitView/components/TranscriptDetail.tsx`](../../apps/client/src/components/TranscriptsSplitView/components/TranscriptDetail.tsx)

## Non-goals (do not convert)

These are **out of scope** unless a later phase revisits them with an explicit rationale:

| Leave as-is                                                                                    | Why                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| shadcn / `@llaab/ui` primitives (`button`, `dialog`, `sidebar`, `field`, `navigation-menu`, …) | Upstream component chrome; not app page layout                       |
| Icon rows, badge chips, inline label+control pairs (`flex items-center gap-2`)                 | Micro-alignment — Tailwind/`gap-*` is correct                        |
| `AppLayout` / `AppHeader` / `SecondaryActionBar` shell flex                                    | App chrome; not content grid                                         |
| `AppSidebarLayout` / `ResizablePanel*`                                                         | Dedicated resize/collapse layout, not 12-col                         |
| `BalancedGrid`                                                                                 | Intentional even-fill card grid (home dashboard) — different problem |
| CSS Grid for true 2D templates in CSS modules (e.g. `PageLayout` hero/body)                    | Prefer CSS Grid when named areas / unequal tracks matter             |
| Sort header column divs that only mimic table columns                                          | Keep unless a real `Row`/`Col` improves clarity                      |
| Third-party layout (`@pierre/trees`, diffs, Lucide picker iframe)                              | External                                                             |

## Conversion rules

1. **Import:** `import { Row, Col, Container } from 'components/ui/grid';`
2. **When to convert:** two or more sibling regions that share horizontal space and need
   responsive stacking (e.g. `md:grid-cols-2`, `lg:grid-cols-[1fr_2fr]`, side-by-side cards,
   form field columns, toolbar halves).
3. **When not to convert:** single-axis stacks (`flex flex-col gap-*`), tiny inline clusters,
   absolute positioning, or layouts already expressed cleanly in a CSS module with non-12-col math.
4. **Breakpoints:** prefer `xs` / `md` / `lg` spans that match Tailwind (`md` = 768px, etc.).
5. **Gutters:** use grid gutters (`--grid-gutter`) or `gutterWidth` / `nogutter` — avoid stacking
   `gap-*` on the same `Row` unless intentional extra spacing outside the gutter model.
6. **Stretch equal-height cards:** `Row align="stretch"` + full-height children (registry toolbar).
7. **`Container`:** only when an inner max-width band is needed; most pages already use
   `PageLayout` / `PageList` / `PageDetail`.
8. **CSS modules:** keep visual styling in modules; move **structure** to `Row`/`Col`. Prefer
   `className` on `Row`/`Col` for local tweaks (`toolbarRow`, `toolbarCol`).
9. **No Ark/Panda leftovers** — never import design-system grid or `ds-*` classes.
10. **Visual parity** — each converted surface should match previous breakpoints; screenshot or
    manual check at ~375 / 768 / 1024 / 1280.

---

## Progress

- [ ] Phase 0 — Scope lock + inventory
- [ ] Phase 1 — Conventions + agent guidance
- [ ] Phase 2 — High-traffic routes (registry already done; vault detail / home / ingest shells)
- [ ] Phase 3 — Forms and toolbars
- [ ] Phase 4 — Remaining client routes and feature components
- [ ] Phase 5 — Tables / dense UI (selective)
- [ ] Phase 6 — Sweep, lint cues, graduation checklist

---

## Phase 0 — Scope lock + inventory

Produce a living checklist of **candidate** files before rewriting.

- [ ] Re-run a repo search for Tailwind layout patterns in `apps/client/src` (and note hits in
      `packages/ui` that are **app feature** code vs primitives):
  - `grid-cols-`, `md:grid-cols`, `lg:grid-cols`
  - `col-span-`
  - multi-column flex patterns used as layout (`md:flex-row`, `justify-between` wrapping large
    regions — judgment call)
- [ ] Classify each hit: **Convert** / **Keep (micro)** / **Keep (special)** / **Defer**
- [ ] Record baseline counts in this doc (update the table below when Phase 0 finishes)

### Seed inventory (starting points — refresh in Phase 0)

Already on grid (reference):

- [x] `routes/registry-search.tsx` — Add/Search toolbar `Row`/`Col md={6}`
- [x] `routes/registry-repos-search.tsx` — same
- [x] `TranscriptsSidebar.tsx` / `TranscriptDetail.tsx` — partial grid usage

Likely convert candidates (page/section layout):

- [ ] `routes/crons.tsx` — many `grid` / `md:grid-cols-[1fr_2fr]` form and card layouts
- [ ] `routes/login.tsx` — form field stacks (only convert if multi-column; else keep)
- [ ] `routes/root.tsx` + `BalancedGrid` — **keep BalancedGrid**; only convert surrounding chrome if needed
- [ ] `routes/llm.tsx` / `LlmModelInfoList` / `LlmRoutingEditor` — card grids
- [ ] `routes/hermes.tsx`, `routes/inbox*.tsx`, `InboxCaptureDetail*`
- [ ] `routes/ingest.tsx` + `IngestForm` outer layout (not the pipeline step chrome)
- [ ] `routes/source-detail.tsx`, `node-detail.tsx`, `run-detail.tsx`
- [ ] `components/VaultBrowser/*` content panes (not pierre tree internals)
- [ ] `components/TerminalPanel.tsx` — only major pane splits, not every flex row

Likely keep (micro / special):

- [ ] `NavMenu*`, `AppHeader`, `ExtractionModelCard` compact bars, `IconHeading`
- [ ] `packages/ui/src/components/{sidebar,dialog,field,button-group,…}.tsx`
- [ ] CSS module layouts in `layouts/PageLayout`, `AppLayout`

---

## Phase 1 — Conventions + agent guidance

Codify rules so later phases stay consistent.

- [ ] Confirm [`docs/components/grid.md`](../components/grid.md) matches implementation (already
      rewritten 2026-07-11); fix gaps found during Phase 0
- [ ] Add a short “when to use `components/ui/grid`” bullet to
      [`.github/instructions/project/components-shadcn.instructions.md`](../../.github/instructions/project/components-shadcn.instructions.md)
      (or a dedicated project instruction if that file is the wrong home)
- [ ] Optional: one AGENTS.md / handoff line pointing at the grid docs + this TODO
- [ ] Define a PR checklist snippet (breakpoint widths, no double gutters, no `ds-*` classes)

---

## Phase 2 — High-traffic routes

Convert the most visible multi-column page shells first.

- [ ] Home / dashboard surrounds (without replacing `BalancedGrid`)
- [ ] `/ingest` page shell + form outer columns (if any)
- [ ] Vault list/detail shells that use Tailwind multi-column (sources, nodes, runs as needed)
- [ ] `/llm` card/layout regions that are true columns
- [ ] `/hermes` and inbox list/detail shells
- [ ] Manual visual check of each converted route at mobile + desktop

---

## Phase 3 — Forms and toolbars

Match the registry Add/Search toolbar pattern elsewhere.

- [ ] Audit `apps/client/src/forms/**` for side-by-side fields (`md:grid-cols-*`, dual columns)
- [ ] Convert eligible form layouts to `Row`/`Col` (e.g. label/control pairs that are truly
      columnar — not every `flex items-center gap-2`)
- [ ] Shared toolbar patterns (search + actions) prefer `Row align="stretch"` where cards sit
      side by side
- [ ] Keep RHF / shadcn `Field` internals unchanged

---

## Phase 4 — Remaining client routes and feature components

Sweep everything Phase 0 marked **Convert** that Phases 2–3 skipped.

- [ ] Remaining `apps/client/src/routes/**`
- [ ] Remaining `apps/client/src/components/**` feature layouts
- [ ] Remaining `apps/client/src/dialogs/**` only if the dialog body is a multi-column layout
      (most dialogs stay flex stacks)
- [ ] Update Phase 0 inventory checkboxes as files land

---

## Phase 5 — Tables / dense UI (selective)

Tables are mostly column definitions, not page grids. Convert only clear layout wrappers.

- [ ] Review `apps/client/src/tables/**` for outer toolbar/header layouts that are multi-column
- [ ] Do **not** replace DataTable column cells with `Col`
- [ ] Sort headers that are pure CSS grid mimicking table columns: convert only if `Row`/`Col`
      improves maintainability without breaking alignment

---

## Phase 6 — Sweep, verification, graduation

- [ ] Final ripgrep: no remaining **Convert**-class `md:grid-cols-*` / multi-column layout
      patterns in app feature code (allowlist documented exceptions)
- [ ] Confirm registry + transcript reference call sites still correct
- [ ] Spot-check: `/`, `/ingest`, `/registry`, `/registry/repos`, `/vault/transcripts`, `/llm`,
      `/crons`, `/hermes`, `/vault/inbox`
- [ ] Rename this file `TODO_` → `DONE_` when all phase checkboxes are complete; move ROADMAP
      item to Done

---

## Suggested execution order (per PR)

Prefer small PRs:

1. One route family or one form surface per PR
2. Include before/after notes for breakpoints
3. No drive-by restyles — structure only unless a gutter fix is required for parity

---

## Open questions

- Should `llm-card-grid.module.css` (`minmax(min(100%, 700px), 1fr)`) stay CSS Grid (likely
  **yes** — auto-fit track sizing is not a 12-col problem)?
- Should any `PageLayout` aside+main CSS Grid move to `Row`/`Col`, or stay CSS Grid for sticky
  aside semantics?
- Do we want an oxlint custom restriction later (warn on `md:grid-cols-` in `apps/client/src/routes`)?
  Defer until after Phase 4 so the allowlist is real.
