# Grid System

📅 Jul 11, 2026

12-column responsive flexbox grid for LLAAB layouts. **No React Context, no provider, no
runtime JS** — components emit static CSS classes from [`grid.css`](./grid.css).

Lives in `@llaab/ui` (`packages/ui/src/components/grid/`). Ported from the Finografic design
system; Ark UI / PandaCSS are **not** used here. Breakpoints match **Tailwind CSS defaults**.
Pair with shadcn primitives and Tailwind utilities for styling — this package only owns column
structure and gutters.

App-facing docs (keep in sync): [`docs/components/grid.md`](/docs/components/grid.md).

---

## Where it lives

| Piece      | Path                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Components | `packages/ui/src/components/grid/{container,row,col}.tsx`                |
| Styles     | `packages/ui/src/components/grid/grid.css`                               |
| Barrel     | `packages/ui/src/components/grid/index.ts`                               |
| CSS wiring | `@import` in `packages/ui/src/styles/globals.css` (loaded by the client) |

---

## Import

In `@llaab/client`, the `components/ui/*` tsconfig alias resolves to `packages/ui/src/components/*`:

```tsx
import { Row, Col, Container } from 'components/ui/grid';
```

From another workspace package that depends on `@llaab/ui`:

```tsx
import { Row, Col, Container } from '@llaab/ui/components/grid';
```

**CSS:** do not import `grid.css` by hand in routes. It is already pulled in via
`packages/ui/src/styles/globals.css` → client `main.tsx` (globals then `app.css`).

---

## Mental model

```text
Container?          optional max-width wrapper
  └─ Row            flex row + negative margin (gutter compensation)
       └─ Col …     padded columns; span via xs/sm/md/lg/xl/xxl
```

- Mobile-first: omit a breakpoint → inherit the previous span.
- Default `Col` with no span props = full width (`flex: 0 0 100%`).
- Gutters: `--grid-gutter` (default `16px` → `8px` padding each side). `Row` uses negative
  `margin-inline`; each `Col` uses matching `padding-inline`.
- Layout props on `Row` (`align`, `justify`, …) become `data-*` attributes; CSS in `grid.css`
  maps those to flex properties. Values are **literal CSS** strings (no translation layer).

---

## Container

Centred max-width wrapper for page content bands that need a horizontal bound.

```tsx
<Container>…</Container>
<Container fluid>…</Container>
```

### Props

| Prop        | Type                              | Default | Notes                                                |
| ----------- | --------------------------------- | ------- | ---------------------------------------------------- |
| `fluid`     | `boolean`                         | `false` | `false` = max-width constrained; `true` = full width |
| `className` | `string`                          | —       | Merged via `cn()`                                    |
| `…rest`     | `ComponentPropsWithoutRef<'div'>` | —       | Forwarded; `forwardRef` supported                    |

### CSS behaviour

| State   | `max-width`                               |
| ------- | ----------------------------------------- |
| default | `var(--layout-content-max-width, 1200px)` |
| `fluid` | `100%`                                    |

- Centred with `margin-inline: auto`
- Horizontal padding: `calc(var(--grid-gutter) / 2)`
- Emitted class: `grid-container` (+ `data-fluid` when `fluid`)

LLAAB pages often use `PageLayout` / `PageList` for page chrome instead of `Container`. Use
`Container` when you need an inner max-width band inside a wider shell.

---

## Row

Flex row that houses `Col` children.

```tsx
<Row>…</Row>
<Row justify="space-between" align="center">…</Row>
<Row nogutter>…</Row>
<Row gutterWidth={32}>…</Row>
```

### Props

| Prop          | Type                                                                          | Default                | Notes                                             |
| ------------- | ----------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `align`       | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch'`                         | —                      | → `align-items`                                   |
| `justify`     | `'flex-start' \| 'center' \| 'flex-end' \| 'space-between' \| 'space-around'` | —                      | → `justify-content`                               |
| `direction`   | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'`                      | —                      | → `flex-direction`                                |
| `wrap`        | `'wrap' \| 'nowrap' \| 'wrap-reverse'`                                        | `'wrap'` (CSS default) | → `flex-wrap`                                     |
| `nogutter`    | `boolean`                                                                     | `false`                | Clears row margin and direct `Col` padding        |
| `gutterWidth` | `number`                                                                      | `16` (via CSS var)     | Sets `--grid-gutter: Npx` inline for this subtree |
| `className`   | `string`                                                                      | —                      | Merged via `cn()`                                 |
| `…rest`       | `ComponentPropsWithoutRef<'div'>`                                             | —                      | Forwarded; `forwardRef` supported                 |

### Gutter

Controlled by `--grid-gutter` (default `16px`).

- `nogutter` — zero margin on the row and zero padding on direct `.grid-col` children
- `gutterWidth={n}` — `--grid-gutter: ${n}px` on that row only

### Emitted markup

Class `grid-row`, plus optional `data-align`, `data-justify`, `data-direction`, `data-wrap`,
`data-nogutter`.

---

## Col

Responsive column inside a `Row`.

```tsx
<Col xs={12} md={6} lg={4}>…</Col>
<Col md="content">…</Col>
```

### Props

| Prop        | Type                              | Default | Notes                                  |
| ----------- | --------------------------------- | ------- | -------------------------------------- |
| `xs`        | `ColSpan`                         | —       | All sizes (mobile-first base)          |
| `sm`        | `ColSpan`                         | —       | ≥ 640px                                |
| `md`        | `ColSpan`                         | —       | ≥ 768px                                |
| `lg`        | `ColSpan`                         | —       | ≥ 1024px                               |
| `xl`        | `ColSpan`                         | —       | ≥ 1280px                               |
| `xxl`       | `ColSpan`                         | —       | ≥ 1536px (Tailwind `2xl`)              |
| `2xl`       | `ColSpan`                         | —       | Alias of `xxl`; `xxl` wins if both set |
| `className` | `string`                          | —       | Merged via `cn()`                      |
| `…rest`     | `ComponentPropsWithoutRef<'div'>` | —       | Forwarded; `forwardRef` supported      |

`ColSpan = number | 'content'`

### Width values

- **`1`–`12`** — fraction of 12 columns (`6` = 50%, `4` ≈ 33%, `3` = 25%, …)
- **`'content'`** — `flex: 0 0 auto; width: auto` (shrink to content)
- **omitted** — inherit previous breakpoint (mobile-first)

TypeScript does not clamp to 1–12. Invalid spans (e.g. `0`, `13`) emit a class that is not in
`grid.css` and have no effect.

### Breakpoints (Tailwind-aligned)

| Prop          | Min-width   | Tailwind prefix |
| ------------- | ----------- | --------------- |
| `xs`          | none (base) | (none)          |
| `sm`          | 640px       | `sm:`           |
| `md`          | 768px       | `md:`           |
| `lg`          | 1024px      | `lg:`           |
| `xl`          | 1280px      | `xl:`           |
| `xxl` / `2xl` | 1536px      | `2xl:`          |

`2xl` is not a valid bare JSX identifier for the primary prop name, so the grid uses `xxl` and
accepts `2xl` as an alias.

### Emitted classes

`grid-col` plus one class per set breakpoint, e.g. `grid-col-xs-12 grid-col-md-6`.

---

## CSS custom properties

Defined on `:root` in `grid.css` (override globally or on an ancestor).

| Property                     | Default             | Notes                                 |
| ---------------------------- | ------------------- | ------------------------------------- |
| `--grid-columns`             | `12`                | Informational; not used in width math |
| `--grid-gutter`              | `16px`              | Total gutter; each side gets half     |
| `--layout-content-max-width` | `1200px` (fallback) | `Container` max-width                 |

Class prefix is `grid-*` (not the old design-system `ds-*`).

---

## Agent rule — grid first (mandatory)

**All agents must use this grid for structural layout blocks** — page sections, card bodies, form
rows, toolbars, and multi-column splits. Do **not** substitute Tailwind layout utilities for column
structure.

| Use grid for                                | Do not use Tailwind for                             |
| ------------------------------------------- | --------------------------------------------------- |
| Page sections, card rows, form rows         | `flex` / `grid` / `grid-cols-*` / `md:flex` layout  |
| Main + sidebar splits (`Col` spans)         | Hand-rolled fraction widths between siblings        |
| Responsive column stacks across breakpoints | `space-x-*` / `gap-*` as a column gutter substitute |

**Inside `Col` cells:** style with shadcn + Tailwind — grid owns structure only.

**Narrow exceptions:** micro inline flex inside one control; app chrome; `BalancedGrid`, `llm-card-grid`,
`PageLayout` outer shell; shadcn internals; third-party layouts.

Grid classes are **static** in `grid.css` — always available.

Canonical copy for agents: [`docs/components/grid.md`](../../../../docs/components/grid.md).
Migration: [`docs/todo/DONE_GRID_LAYOUT_MIGRATION.md`](../../../../docs/todo/DONE_GRID_LAYOUT_MIGRATION.md).

---

## Examples

### Basic responsive split

```tsx
import { Row, Col } from 'components/ui/grid';

<Row>
  <Col xs={12} md={6}>
    Left
  </Col>
  <Col xs={12} md={6}>
    Right
  </Col>
</Row>
```

### Registry toolbar (real LLAAB usage)

Packages / Repositories list pages place Add + Search cards in equal columns from `md` up,
stacked on small screens. `align="stretch"` keeps both cards equal height.

```tsx
import { Col, Row } from 'components/ui/grid';

<Row className={styles.toolbarRow} align="stretch">
  <Col xs={12} md={6} className={styles.toolbarCol}>
    <RegistrySearchCard … />
  </Col>
  <Col xs={12} md={6} className={styles.toolbarCol}>
    <RegistryAddPinForm />
  </Col>
</Row>
```

See `apps/client/src/routes/registry-search.tsx` and `registry-repos-search.tsx`.

### Sidebar + main

```tsx
<Row>
  <Col xs={12} lg={3}>
    Sidebar
  </Col>
  <Col xs={12} lg={9}>
    Main
  </Col>
</Row>
```

### Content-width columns

```tsx
<Row justify="space-between" align="center">
  <Col xs="content">Logo</Col>
  <Col xs="content">Actions</Col>
</Row>
```

### No gutter / custom gutter

```tsx
<Row nogutter>
  <Col xs={6}>A</Col>
  <Col xs={6}>B</Col>
</Row>

<Row gutterWidth={32}>
  <Col xs={6}>A</Col>
  <Col xs={6}>B</Col>
</Row>
```

### Inside a Container

```tsx
<Container>
  <Row>
    <Col xs={12} md={8}>
      Content
    </Col>
    <Col xs={12} md={4}>
      Aside
    </Col>
  </Row>
</Container>
```

---

## What this is NOT

- **Not Ark UI / PandaCSS** — no `styled-system/jsx`, no Panda `<Flex>`, no recipe system
- **Not a general flex utility** — prefer Tailwind `flex` / `gap-*` for simple grouping
- **Not CSS Grid** — flexbox column grid; for CSS Grid use Tailwind `grid` / `grid-cols-*`
- **Not context-based** — no provider, no `useScreenClass`, no runtime breakpoint hook
- **Not Tailwind-generated** — `grid.css` is hand-maintained static CSS

---

## Debugging

In DevTools, look for:

| Element     | What you should see                             |
| ----------- | ----------------------------------------------- |
| `Container` | `.grid-container` (± `data-fluid`)              |
| `Row`       | `.grid-row` ± `data-align` / `data-justify` / … |
| `Col`       | `.grid-col` + `.grid-col-{bp}-{n\|content}`     |

If a column ignores a span, confirm the class exists in `grid.css` and that a larger breakpoint
is not overriding it.
