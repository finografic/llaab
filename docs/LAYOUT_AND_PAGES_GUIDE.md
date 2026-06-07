# Layout & Pages Guide

Architecture reference for LLAAB's layout system, landmark components, and the Finder-style
page template. All components live in `apps/client/src/`.

---

## Layout hierarchy

```
BaseLayout          ← <html> / <head> / CSS imports
  AppLayout         ← app shell (header + main + footer)
    AppHeader       ← brand + NavMenu + page title
    [page slot]
      PageLayout    ← finder-style inner-page template  ← YOU ARE HERE
        PageHero    ← page title / actions bar
        [aside]     ← filter sidebar (optional)
        [main]      ← FileList or any content
```

---

## AppLayout

`layouts/AppLayout.astro` — shell for every main route. Horizontal header with megamenu nav; no sidebar.

```astro
<AppLayout title="Transcripts">
  <!-- page content here — AppHeader + AppFooter rendered automatically -->
  <PageLayout>...</PageLayout>
</AppLayout>
```

`page-content` div inside AppLayout has `padding: 1.5rem`. Remove it for full-bleed Finder
pages by wrapping with a negative-margin reset or passing the PageLayout as a direct child.

---

## NavMenu

`components/NavMenu/NavMenu.tsx` — horizontal shadcn `NavigationMenu` in `AppHeader`. Structure lives in
`lib/nav-menu.config.ts`; route-prefix active matching in `lib/nav-menu.utils.ts`.

- **Desktop (`md+`):** five megamenus (Vault, Pipeline, Execute, Models, System) with label + description
  list items; two-column panel when a section has 4+ items.
- **Mobile:** hamburger opens a `Sheet` with the same sections in an `Accordion`.
- **Future routes:** rendered disabled with reduced opacity and a lock icon — set `live: true` in config
  when the route ships.
- **CSS rule:** responsive show/hide uses Tailwind only (`hidden md:flex`, `md:hidden`). Do not set
  `display` on NavMenu CSS-module wrappers — it overrides Tailwind `hidden` after hydration.

**Adding or enabling a nav item:** edit `NAV_MENU_SECTIONS` in `nav-menu.config.ts`. See
[`docs/NAV_MENU_DESIGN.md`](../NAV_MENU_DESIGN.md) for the full route map.

---

## PageLayout

`layouts/PageLayout.astro` — Finder-style inner-page template. Three named slots.

```astro
---
import PageLayout from '../layouts/PageLayout.astro';
import PageHero from '../components/PageHero/PageHero.astro';
---

<PageLayout>
  <!-- Hero zone (optional but typical) -->
  <PageHero slot="hero" title="Transcripts" eyebrow="Vault">
    <button slot="actions">+ Ingest</button>
    <Fragment slot="description">All ingested YouTube transcripts.</Fragment>
    <Fragment slot="meta">
      <span>{count} transcripts</span>
    </Fragment>
  </PageHero>

  <!-- Aside: filter panel, secondary tree nav, etc. (optional) -->
  <aside slot="aside">
    <!-- filter controls, tag list, date range, etc. -->
  </aside>

  <!-- Main: the content — usually a FileList -->
  <TranscriptsFileList client:load data={transcripts} />
</PageLayout>
```

**Props:**

| Prop         | Type     | Default   | Notes                       |
| ------------ | -------- | --------- | --------------------------- |
| `asideWidth` | `string` | `"200px"` | CSS width of the aside pane |

The aside column only appears when the `aside` slot is filled — no empty column left behind.

---

## PageHero

`components/PageHero/PageHero.astro` — page-level header.

**Slots:**

| Slot          | Notes                                     |
| ------------- | ----------------------------------------- |
| `actions`     | Right-side button group                   |
| `description` | Subtitle paragraph below title row        |
| `meta`        | Stat/badge bar below description (darker) |

**Props:**

| Prop       | Type      | Default | Notes                   |
| ---------- | --------- | ------- | ----------------------- |
| `title`    | `string`  | —       | `<h1>` text             |
| `eyebrow`  | `string?` | —       | Small label above title |
| `bordered` | `boolean` | `true`  | Bottom border separator |

---

## FileList

`tables/FileList/FileList.tsx` — TanStack table rendered as a Finder list view.
No grid lines. 32px rows, 28px header. Column size `150` (TanStack default) = `flex: 1`.

```tsx
import { FileList, FileCell } from 'tables/FileList/FileList';
import type { ColumnDef } from '@tanstack/react-table';

const columns: ColumnDef<Transcript>[] = [
  {
    accessorKey: 'title',
    header: 'Name',
    // size omitted → defaults to 150 → flex: 1 (fills remaining width)
    cell: ({ row }) => (
      <FileCell
        icon={<TranscriptIcon />}
        name={row.original.title}
        meta={row.original.source_type}
      />
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    size: 120,
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      }),
  },
  {
    accessorKey: 'clean_length',
    header: 'Size',
    size: 80,
    enableSorting: false,
    cell: ({ getValue }) => `${((getValue() as number) / 1000).toFixed(1)}k`,
  },
];

// In the component:
<FileList
  data={transcripts}
  columns={columns}
  selectedId={selectedId}
  getRowId={(row) => row.id}
  onRowClick={(row) => navigate(`/vault/transcripts/${row.id}`)}
  emptyMessage="No transcripts yet."
  loading={isLoading}
/>
```

**`FileCell` props:**

| Prop   | Type        | Notes                                      |
| ------ | ----------- | ------------------------------------------ |
| `name` | `string`    | Primary label (truncated, fills flex 1)    |
| `icon` | `ReactNode` | File-type icon (14×14, left of name)       |
| `meta` | `string?`   | Secondary label, right of name, mono/faint |

**Sorting:** Built-in via TanStack `getSortedRowModel`. Column header click toggles
`asc → desc → none`. Add `enableSorting: false` to any column to suppress.

**Loading:** Pass `loading={true}` to show 8 animated skeleton rows instead of data.

---

## CSS system

| Layer              | Location                                      | Owns                                       |
| ------------------ | --------------------------------------------- | ------------------------------------------ |
| Panda tokens       | `styled-system/styles.css` (generated)        | DS semantic CSS vars                       |
| DS global          | `@finografic/design-system/styles/global.css` | Reset, keyframes, @layer order             |
| App tokens         | `styles/app.css`                              | `--bg`, `--text`, `--accent`, space scale  |
| Component styles   | `*.module.css` (unlayered)                    | Wins over all `@layer utilities` / recipes |
| Page-scoped styles | `<style>` in `*.astro`                        | Scoped, auto-namespaced by Astro           |

**Key rule:** CSS modules are unlayered → they beat Panda recipe classes.
Use `!important` only when the recipe applies the same property at the same specificity.

**App token aliases** (in `styles/app.css`):

```css
--bg           → dark background
--bg-subtle    → slightly lighter surface
--surface      → card/hover surface
--text         → primary text
--text-muted   → secondary text
--text-faint   → tertiary / metadata
--accent       → primary accent color
--accent-subtle → tinted accent bg
--border       → default border
--border-subtle → subtle separator
--border-focus → focus ring
```

---

## Adding a new Finder-style page (checklist)

1. Create the Astro page file, e.g. `pages/vault/runs/index.astro`
2. Import `AppLayout`, `PageLayout`, `PageHero`, and your `*FileList` React component
3. Fetch data in the frontmatter
4. Wrap with `AppLayout > PageLayout`
5. Fill `PageHero` in the `hero` slot with title + optional actions
6. Put the `FileList` in the default slot
7. Add an `aside` slot only if you need filter controls

Reference: `pages/vault/transcripts/index.astro` (card layout, pre-Finder) for data
fetching patterns and auth gate pattern.
