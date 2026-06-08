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
