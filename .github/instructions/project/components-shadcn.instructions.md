# Component Rules — shadcn/ui First

These rules apply whenever UI components, icons, or layout primitives are added or
modified in LLAAB. They are non-negotiable.

## Always prefer shadcn over hand-coded components

Before writing a custom component, icon, or layout primitive, check whether shadcn
already provides it. If it does, use it. Do not hand-roll what shadcn gives for free.

This applies to:

- **UI primitives** — buttons, inputs, cards, badges, dialogs, tooltips, tables,
  separators, breadcrumbs, scroll areas, dropdowns, tabs, etc.
- **Icons** — always use `lucide-react`. Never write raw inline `<svg>` for icons that
  Lucide covers. Check `lucide-react` exports before reaching for a custom SVG.
- **Layout** — use shadcn layout patterns and Tailwind utilities. Avoid custom layout
  components when Tailwind grid/flex classes suffice.

**Why:** Hand-coded primitives duplicate work, diverge from the design system, and
accumulate maintenance debt. shadcn + Lucide give consistent tokens, accessibility,
and dark-mode behaviour for free.

## Canonical component location

All shadcn primitives and shadcn-patterned custom components live in:

```
packages/ui/src/components/
```

**Never** place new shadcn components in `apps/client/src/components/ui/`. That
directory no longer exists. The `components/ui/*` tsconfig alias in `apps/client`
resolves to `packages/ui/src/components/` automatically.

### Import paths

From any file in `apps/client`:

```ts
import { Button } from 'components/ui/button';
import { Card, CardContent } from 'components/ui/card';
import { Badge } from 'components/ui/badge';
```

From any file in `packages/ui` itself (e.g. a component importing another):

```ts
import { cn } from '@llaab/ui/lib/utils';
```

## Installing new shadcn components

Run from `apps/client` — the `components.json` there controls the registry and
install target:

```bash
cd apps/client
pnpm dlx shadcn@latest add <component-name>
```

This writes the component to `packages/ui/src/components/` and may update
`packages/ui/src/styles/globals.css`. After installing, **restart the dev server**
so Vite picks up the new file.

To browse what is available:

```bash
pnpm dlx shadcn@latest view @shadcn
```

## Custom components that follow shadcn patterns

Components that do not exist in the shadcn registry but follow its conventions
(e.g. `Spinner`) also live in `packages/ui/src/components/`. They must:

- use `cn()` from `@llaab/ui/lib/utils` for class merging
- accept and forward a `className` prop
- use shadcn CSS tokens (`--primary`, `--muted-foreground`, etc.) rather than
  hard-coded colour values

## Tabs (LLAAB defaults)

Canonical primitive: `packages/ui/src/components/tabs.tsx` (`components/ui/tabs`).

- **Default list variant:** `line` (underline). Use `variant="default"` only for pill/segmented tabs.
- **Default trigger size:** `text-base` and `px-2.5` (shadcn `px-1.5` + `0.25rem` each side).
- Prefer these defaults; override with `className` or a future `size` variant only when a denser control is required.
- Do not re-declare line/size styles in page CSS modules — change the shared primitive instead.

## CSS tokens vs hard-coded values

Never hard-code hex or rgb colours in component files or Astro pages. Instead use:

- shadcn tokens: `var(--primary)`, `var(--muted-foreground)`, `var(--border)`, etc.
- LLAAB app tokens: `var(--accent)`, `var(--surface)`, `var(--text-muted)`, etc.
- `oklch()` with alpha only for one-off semantic colours (e.g. status badges) that
  have no matching token — and only in page-scoped `<style>` blocks, never inline.

## What still lives in `apps/client/src/components/`

Only LLAAB-specific application components that are not shadcn primitives:

- `AppHeader/`, `AppFooter/`, `NavMenu/`, `PageHero/` — shell/layout
- `VaultBrowser.tsx`, `CleanVaultDialog/`, `DeleteRunAction/` — feature UI

**Forms** (`apps/client/src/forms/`): `IngestForm`, `CreateIdeaPanel`, `TagInputField`.

**Tables** (`apps/client/src/tables/`): `RunsTable`, `SourcesTable`, `TranscriptsTable`,
`FileList/`, `NodesFileList/`.

These import shadcn primitives from `components/ui/*`.

## Sidebars and the sticky app header

`AppHeader` is **sticky** (`top: 0`, `z-index: 50`) on every `AppLayout` page. Layout tokens:

- `--header-h` — app header height (52px)
- `--footer-h` — app footer height (40px)
- `--content-area-h` — `calc(100dvh - var(--header-h) - var(--footer-h))` for full-height panes

**Do not** use shadcn's default fixed sidebar (`position: fixed; inset-y: 0`) under the app header — it spans the full viewport and overlaps the nav.

For split views (list + detail), use `AppSidebarLayout` from `components/ui/app-sidebar-right-layout`:

- `position="inline"` (default) — sidebar in flex flow; top edge starts below the layout header row (sidebar-16 pattern)
- `position="fixed"` — only when there is no global sticky header above
- `resizable` — wraps columns in `ResizablePanelGroup`
- `header` — full-width row above sidebar + main (breadcrumb, toolbar, etc.)
- Full-height routes: `AppLayout` with `fullBleed` and a root `h-(--content-area-h)` wrapper

**Size props (`minWidth`, `maxWidth`, `defaultWidth`)** — pass CSS unit strings. Bare numbers are treated as **pixels** by `react-resizable-panels` v4 (not percentages). Defaults are already `"18%"` / `"45%"` / `"28%"`. Use strings for any override: `minWidth="200px"`, `maxWidth="40%"`.

**Collapsible sidebar** — add `collapsible` (+ optional `collapsedSize`, `onCollapse`, `onExpand`):

```tsx
<AppSidebarLayout resizable collapsible collapsedSize="0%" onCollapse={handleCollapse} ...>
```

**Persistent layout** — import `useDefaultLayout` from `components/ui/resizable` and pass results through. Panel ids must be stable across renders:

```tsx
import { useDefaultLayout } from 'components/ui/resizable';

const { defaultLayout, onLayoutChanged } = useDefaultLayout({
  id: "transcripts-split",        // unique storage key
  storage: localStorage,
});
<AppSidebarLayout
  resizable
  sidebarPanelId="transcripts-sidebar"   // must match across renders
  mainPanelId="transcripts-main"
  defaultLayout={defaultLayout}
  onLayoutChanged={onLayoutChanged}
  ...
/>
```

Install new shadcn sidebar **blocks** with `pnpm dlx shadcn@latest add sidebar-XX` from `apps/client`, then adapt imports and wire through `AppSidebarLayout` — do not copy fixed-sidebar positioning verbatim.
