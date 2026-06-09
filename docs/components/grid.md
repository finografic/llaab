# Grid System

12-column responsive grid. **No React Context, no provider, no JavaScript at runtime** —
pure CSS classes from a pre-generated static stylesheet (`grid.css`).

## Import

```tsx
import { Row, Col, Container } from 'components/ui/grid';
```

The CSS is automatically included via `packages/ui/src/styles/globals.css` — no manual
import required.

---

## Container

Max-width centred wrapper. Wraps page content areas that need horizontal bounds.

```tsx
<Container>...</Container>
<Container fluid>...</Container>
```

### Props

| Prop      | Type                              | Default | Notes                                                |
| --------- | --------------------------------- | ------- | ---------------------------------------------------- |
| `fluid`   | `boolean`                         | `false` | `false` = max-width constrained; `true` = 100% width |
| `...rest` | `ComponentPropsWithoutRef<'div'>` | —       | All standard div props forwarded via `forwardRef`    |

### CSS behaviour

| State   | `max-width`                               |
| ------- | ----------------------------------------- |
| default | `var(--layout-content-max-width, 1200px)` |
| `fluid` | `100%`                                    |

- Centred via `margin-inline: auto`
- `padding-inline: calc(var(--grid-gutter) / 2)` so content never touches viewport edges
- Override `--layout-content-max-width` on `:root` (or a parent element) to change the cap

---

## Row

Flex row container. Pairs with `Col`. Applies negative margin to offset Col gutters.

```tsx
<Row>...</Row>
<Row justify="space-between" align="center">...</Row>
<Row nogutter>...</Row>
<Row gutterWidth={32}>...</Row>
```

### Props

| Prop          | Type                                                                          | Default                | Notes                                                          |
| ------------- | ----------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `align`       | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch'`                         | —                      | Maps to `align-items`                                          |
| `justify`     | `'flex-start' \| 'center' \| 'flex-end' \| 'space-between' \| 'space-around'` | —                      | Maps to `justify-content`                                      |
| `direction`   | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'`                      | —                      | Maps to `flex-direction`                                       |
| `wrap`        | `'wrap' \| 'nowrap' \| 'wrap-reverse'`                                        | `'wrap'` (CSS default) | Maps to `flex-wrap`                                            |
| `nogutter`    | `boolean`                                                                     | `false`                | Removes gutter margin/padding from row and direct Col children |
| `gutterWidth` | `number`                                                                      | `16`                   | Override gutter in px — sets `--grid-gutter` inline            |
| `...rest`     | `ComponentPropsWithoutRef<'div'>`                                             | —                      | All standard div props forwarded via `forwardRef`              |

> **Note:** `align`, `justify`, `direction`, and `wrap` prop values match CSS values exactly
> — no translation layer. The same as Panda's `<Flex>` from the design-system.

### Gutter

The gutter is controlled by `--grid-gutter` (default `16px`, so `8px` per side).
Row uses negative `margin-inline` to compensate; Col uses `padding-inline` for the gap.

- `nogutter` removes both margin and padding entirely
- `gutterWidth={n}` sets `--grid-gutter: npx` inline, overriding the default for that subtree

---

## Col

Responsive column. Mobile-first: defaults to full width (100%) at all breakpoints unless a
narrower span is specified.

```tsx
<Col xs={12} md={6} lg={4}>...</Col>
<Col md="content">...</Col>  {/* shrinks to content width */}
```

### Props

| Prop      | Type                              | Default | Notes                                   |
| --------- | --------------------------------- | ------- | --------------------------------------- |
| `xs`      | `ColSpan`                         | —       | Span at all sizes (mobile-first base)   |
| `sm`      | `ColSpan`                         | —       | Span at ≥ 640px                         |
| `md`      | `ColSpan`                         | —       | Span at ≥ 768px                         |
| `lg`      | `ColSpan`                         | —       | Span at ≥ 1024px                        |
| `xl`      | `ColSpan`                         | —       | Span at ≥ 1280px                        |
| `xxl`     | `ColSpan`                         | —       | Span at ≥ 1536px (Tailwind `2xl`)       |
| `2xl`     | `ColSpan`                         | —       | Alias of `xxl`; `xxl` takes precedence  |
| `...rest` | `ComponentPropsWithoutRef<'div'>` | —       | All standard div props via `forwardRef` |

`ColSpan = number | 'content'`

### Width values

- **`1–12`** — fraction of 12 columns (`6` = 50%, `4` = 33.3%, `3` = 25%, etc.)
- **`'content'`** — `flex: 0 0 auto; width: auto` — shrinks to fit content
- **omitted** — inherits the previous breakpoint's width (mobile-first cascade)

### Breakpoints

These match Tailwind CSS defaults exactly.

| Prop        | Min-width   | Tailwind equivalent |
| ----------- | ----------- | ------------------- |
| `xs`        | none (base) | (no prefix)         |
| `sm`        | 640px       | `sm:`               |
| `md`        | 768px       | `md:`               |
| `lg`        | 1024px      | `lg:`               |
| `xl`        | 1280px      | `xl:`               |
| `xxl`/`2xl` | 1536px      | `2xl:`              |

> **`xxl` vs `2xl`**: `2xl` is not a valid JSX prop identifier, so `xxl` is the primary name.
> The `2xl` alias is accepted for parity with Tailwind naming. `xxl` wins if both are set.

---

## CSS Custom Properties

Defined on `:root` in `grid.css`. Can be overridden globally or scoped to any element.

| Property                     | Default  | Notes                                              |
| ---------------------------- | -------- | -------------------------------------------------- |
| `--grid-columns`             | `12`     | Read-only reference; informational only            |
| `--grid-gutter`              | `16px`   | Total gutter; each side gets `gutter / 2`          |
| `--layout-content-max-width` | `1200px` | Container max-width; override on `:root` or parent |

---

## CSS Classes (emitted)

Useful for debugging in DevTools.

| Element     | Classes emitted                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `Container` | `grid-container` (+ `data-fluid` attribute when fluid)                                                        |
| `Row`       | `grid-row` (+ `data-align`, `data-justify`, `data-direction`, `data-wrap`, `data-nogutter` attributes as set) |
| `Col`       | `grid-col grid-col-xs-6 grid-col-md-3 …` (one class per breakpoint prop passed)                               |

---

## Examples

### Basic responsive layout

```tsx
<Row>
  <Col xs={12} md={6}>Left</Col>
  <Col xs={12} md={6}>Right</Col>
</Row>
```

### Three-column with sidebar

```tsx
<Row>
  <Col xs={12} lg={3}>Sidebar</Col>
  <Col xs={12} lg={9}>Main content</Col>
</Row>
```

### Row with alignment

```tsx
<Row justify="space-between" align="center">
  <Col xs="content">Logo</Col>
  <Col xs="content">Nav</Col>
</Row>
```

### No gutter

```tsx
<Row nogutter>
  <Col xs={6}>A</Col>
  <Col xs={6}>B</Col>
</Row>
```

### Custom gutter

```tsx
<Row gutterWidth={32}>
  <Col xs={6}>A</Col>
  <Col xs={6}>B</Col>
</Row>
```

### Inside a Container

```tsx
<Container>
  <Row>
    <Col xs={12} md={8}>Content</Col>
    <Col xs={12} md={4}>Aside</Col>
  </Row>
</Container>
```

### Content-width columns

```tsx
<Row justify="space-between">
  <Col xs="content">Logo</Col>
  <Col xs="content">Actions</Col>
</Row>
```

---

## What this is NOT

- **Not a flex utility** — for simple flex grouping without column structure, use Tailwind
  flex utilities (`flex`, `items-center`, `gap-*`, etc.) directly
- **Not CSS Grid** — this is a flexbox-based column grid (Bootstrap-style); for CSS Grid
  layouts use Tailwind's `grid grid-cols-*` utilities
- **Not context-based** — no provider, no hooks, no `useScreenClass`
- **Not Tailwind-generated** — `grid.css` is a static pre-generated file; the classes live
  outside the Tailwind purge graph and are always available
