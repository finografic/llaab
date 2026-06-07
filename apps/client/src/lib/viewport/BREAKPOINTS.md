# Breakpoints

Canonical values live in `@llaab/ui/lib/breakpoints` (`packages/ui/src/lib/breakpoints.ts`).
`apps/client/src/lib/viewport/` re-exports them for client code.

## Active Scale

We use the **Panda CSS / Tailwind CSS default breakpoint scale**, which is also
the scale used by Park UI (the official Ark UI + Panda CSS design system).

| Key   | px     | rem  | Notes                       |
| ----- | ------ | ---- | --------------------------- |
| `xs`  | `0`    | `0`  | Base / mobile-first default |
| `sm`  | `640`  | `40` |                             |
| `md`  | `768`  | `48` |                             |
| `lg`  | `1024` | `64` |                             |
| `xl`  | `1280` | `80` |                             |
| `2xl` | `1536` | `96` |                             |

`xs: 0` is included for completeness and type completeness but is rarely queried
directly — mobile-first design starts from zero by default.

---

## Reference: Other Scales

### Tailwind CSS / Panda CSS defaults ← active

```
xs:    0   sm: 640   md: 768   lg: 1024   xl: 1280   2xl: 1536
```

- Panda CSS ships these as its default theme breakpoints (`@pandacss/preset-panda`)
- Park UI uses these values directly
- `xs` is not included in Panda defaults; we add it at `0`

### Radix UI Themes

```
xs:    0   sm: 520   md: 768   lg: 1024   xl: 1280   2xl: 1640
```

- Used by `@radix-ui/themes`
- **V1 client (`apps/client/src/styles/`) was built on this scale**
- Key differences vs active: `sm` is 120px narrower (520 vs 640), `2xl` is 104px wider (1640 vs 1536)

### Previous design-system values (before this change)

```
xs:    0   sm: 520   md: 768   lg: 1024   xl: 1280   2xl: 1640
```

Matched the Radix UI scale. Changed to Panda/TW defaults for alignment with
Panda CSS tooling and Park UI documentation.

---

## Why Panda CSS defaults?

- **Ark UI is fully headless** — `@ark-ui/react` defines zero breakpoints.
  It provides state machines and accessibility behaviour only; all styling
  (including breakpoints) is the responsibility of the styling layer.
- **Panda CSS defers to the preset** — our `designSystemPreset` sets
  `extend.breakpoints: BREAKPOINTS_PX`, which overrides Panda's defaults.
  There is no mismatch risk.
- **Park UI alignment** — Park UI (the reference Ark UI + Panda design system,
  not installed but used as a patterns reference) uses Panda defaults. Using
  the same scale means code examples and recipes from Park UI docs transfer
  directly without mental translation.
- **`sm: 640` vs `sm: 520`** — the 120px gap matters during V1 → V2 migration.
  Any V1 styles that relied on `sm: 520` targeting phone-landscape / small-tablet
  will need to be reviewed. This is expected breakage; document in the migration guide.

---

## Where breakpoints are consumed

Breakpoints surface in three ways in this system:

### 1. Panda CSS responsive utilities

Any token or utility value can be made responsive using object or array syntax:

```ts
// Object syntax — key names must match BREAKPOINTS keys
css({ fontSize: { base: 'sm', md: 'lg', xl: 'xl' } });

// Array syntax — maps left-to-right to [base, sm, md, lg, xl, 2xl]
css({ display: ['flex', null, 'grid'] });
```

### 2. Component recipes (responsive size props)

Ark UI wrappers accept responsive Panda values for `size`, `variant`, etc.:

```tsx
<Button size={{ base: 'sm', md: 'md' }}>Submit</Button>
```

Prominent components where this is relevant:

- **Button** — `size` prop (sm/md/lg) typically shifts at `md`
- **Dialog / Drawer** — width and placement flip at `md`
- **Select / Menu** _(planned)_ — dropdown anchoring changes at `md`
- **Tabs** _(planned)_ — horizontal vs stacked layout at `sm`
- **Typography recipes** _(planned)_ — fluid heading sizes at `md`, `lg`
- **Layout tokens** _(planned)_ — sidebar collapse at `lg`, nav at `md`

### 3. DataTable responsive columns

Set `minVisible` on a `DataTableColumns` entry to hide that column below a breakpoint
(Tailwind `hidden` + `{bp}:table-cell`). See `packages/ui/src/components/data-table.README.md`.

---

## Exports from this module

```ts
import {
  BREAKPOINTS, // Record<ScreenClass, number> — numeric px (Tailwind defaults)
  BREAKPOINTS_PX, // Record<ScreenClass, string> — '640px' etc.
  BREAKPOINT_VALUES, // number[] — values excluding xs:0
  QUERIES_MIN, // Record<ScreenClass, string> — '(min-width: Xpx)'
  QUERIES_MAX, // Omit<Record<ScreenClass, string>, 'xs'>
  MEDIA_QUERIES, // { min, max }
  minVisibleTableCellClass, // (minVisible?) => Tailwind class string
} from 'lib/viewport';
```
