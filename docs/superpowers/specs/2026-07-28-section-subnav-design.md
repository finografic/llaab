# Section Subnav — Design

Date: 2026-07-28  
Status: approved (conversation); awaiting user review of this written spec

## Problem

The primary sticky header exposes section dropdowns (Vault, Registry, Knowledge, …). After choosing a destination, sibling pages in that section are only reachable by reopening the dropdown. Users want always-visible section links under the main nav.

## Goals

- Show the current parent section’s sub-items as a horizontal secondary navbar.
- Links navigate via React Router to the same `href`s as the megamenu.
- Active item uses accent green.
- No layout jump when navigating between pages with and without a matching section.
- Leave the existing `SecondaryActionBar` (sidebar toggle / vault git / run monitor) unchanged as a tools bar.

## Non-goals

- Replacing or removing the megamenu dropdowns.
- Mobile redesign (desktop-first horizontal strip; mobile can share the same strip or wrap later if needed).
- Changing route handles, page heroes, or left-sidebar transcript chrome.

## Placement

Stack order (top → bottom):

1. Sticky `AppHeader` (brand + section triggers + icon shortcuts)
2. Sticky `SectionSubnav` (this feature)
3. Existing `SecondaryActionBar` (tools)
4. Page content (`AppSidebarLayout` main)

## Behavior

### Active section

Reuse `getActiveNavSectionId(pathname)` from `lib/nav-menu.utils.ts`.

**Fix required:** add matchers for Registry (`/registry`) and Knowledge (`/knowledge`) so those parents resolve. Preserve existing precedence (e.g. Execute wins over Vault for `/vault/runs`).

### Items

Source of truth remains `NAV_MENU_SECTIONS` in `lib/nav-menu.config.ts`. No duplicated menu data.

For the resolved section:

| Item state    | Presentation                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `live: true`  | `Link` to `href`; active when `isNavItemActive(pathname, href)` — accent green + `aria-current="page"` |
| `live: false` | Non-interactive, muted, `LockIcon` + sr-only “coming soon” (same semantics as megamenu)                |

When no section matches (e.g. `/`): render an empty reserved strip of the same height (no links). Do not unmount the bar.

Labels only in the strip (no descriptions) — descriptions stay in the megamenu.

### Height stability

Introduce `--section-subnav-h` (≈36–40px) in `apps/client/src/styles/app.css`.

Always apply that height to `SectionSubnav` (content or empty).

Update `--content-area-h` to subtract `--section-subnav-h` so fill-height pages stay correct:

```css
--content-area-h: calc(
  100dvh - var(--header-h) - var(--section-subnav-h) - var(--secondary-actions-h) - var(--footer-h)
);
```

Sticky: `top: var(--header-h)`; z-index below or equal to header stacking so megamenus still overlay correctly.

## Architecture

### New files

- `apps/client/src/components/SectionSubnav/SectionSubnav.tsx`
- `apps/client/src/components/SectionSubnav/SectionSubnav.module.css`

### Modified files

- `apps/client/src/layouts/AppLayout/AppLayout.tsx` — mount `<SectionSubnav />` between `<AppHeader />` and the sidebar layout / `SecondaryActionBar`
- `apps/client/src/lib/nav-menu.utils.ts` — Registry + Knowledge matchers
- `apps/client/src/styles/app.css` — `--section-subnav-h` + `--content-area-h` update

### Unchanged

- `SecondaryActionBar` / `SecondaryActionBarContext` — tools only
- `NavMenu` megamenu — remains primary discovery for descriptions and two-column panels
- `nav-menu.config.ts` item list (unless a bug is found while wiring)

### Data flow

```text
useLocation().pathname
  → getActiveNavSectionId
  → NAV_MENU_SECTIONS.find
  → map items → Link | disabled lock row
```

## Visual notes

- Horizontal row of compact text links; horizontal scroll if overflow (Vault has many items) rather than wrapping into a second row that changes height.
- Align horizontal padding with `AppHeader` / `SecondaryActionBar` (`var(--space-6)`).
- Active: accent / accent-green text (match app accent tokens — not hard-coded hex).
- Inactive live: muted foreground; hover slightly brighter.
- Disabled: opacity muted + lock icon, `pointer-events-none`, `aria-disabled`.

Structural layout: prefer project `Row`/`Col` only if the strip needs multi-column structure; a single horizontal nav list is a micro inline cluster — flex on one element group is acceptable per grid-layout exceptions.

## Testing / verification

- Manual: open Vault, Registry, Knowledge, Pipeline, Execute, Models, System — strip shows correct siblings; active link is green.
- `/` home: empty strip, same height; no content jump vs Vault.
- `/vault/runs`: Execute section (not Vault), Runs active.
- Stub items (e.g. Ingest Article): visible, locked, not navigable.
- Megamenu still opens and overlays above the strip.
- Fill-height routes (`/terminal`, transcripts) still fit within viewport after `--content-area-h` change.

## Out of scope follow-ups

- Collapsing megamenu once subnav exists
- Highlighting parent trigger in green (beyond current muted bg)
- Persisting last-used section when on home
