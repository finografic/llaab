# SVA components — slot recipes & Ark compounds

Authoring guide for **`sva`** (slot recipes) + **`createStyleContext`** in
`packages/design-system/src/components/` and `src/forms/`. Use this to align new work
and refactors with **Checkbox**, **Switch**, **Select**, **Dialog**, etc.

**Pair doc:** [CVA components](cva-components.instructions.md) for single-element
recipes.

---

## Shared conventions (all Panda component work)

These apply to **both** `sva` and `cva` exports in this design system:

| Topic                             | Rule                                                                                                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`cx`**                          | Import only from `@styled-system/css`. **Inline** `cx(...)` in JSX when the result is used **once**; use a `const` only if reused, very long, or clarity needs a name.                                                                       |
| **Deprecated API**                | Do **not** add `@deprecated` props or backward-compat aliases. Prefer a clean break while the API is still settling.                                                                                                                         |
| **`onChange` at the DS boundary** | Where Ark uses awkward names (`onCheckedChange`, detail objects), **field-style wrappers** may expose a simpler **`onChange`** (e.g. boolean or value only) and forward internally. Bare **compound roots** stay faithful to Ark prop names. |
| **Types**                         | Export explicit variant unions where `RecipeProps<>` is insufficient (e.g. `ButtonVariant`, `ButtonPalette`). Do not index `RecipeProps` for keys that are not exposed.                                                                      |
| **Tokens**                        | Prefer semantic tokens in recipes (`fg`, `bg.muted`, `accent.solid`, `border.subtle`). Port Ark demo CSS by **mapping** demo variables to tokens, not by shipping demo CSS variables.                                                        |
| **Ark example CSS**               | Treat Ark docs stylesheets as a **spec** → implement as Panda **`sva`/`cva`** + tokens. Avoid shipping parallel **CSS modules** for the same UI long term.                                                                                   |
| **Recipe binding name**           | The variable holding a recipe's return value is always **`styles`** (not `cls`, `recipeClass`, `classNames`, etc.). See **Recipe return variable** below.                                                                                    |
| **No inline `style` in wrappers** | Never use the `style` attribute for layout in DS wrappers — use Panda `css()` instead. Module-level `const` for static values; `css()` inline for one-offs. Keeps all styling in the Panda layer (cascade, tokens, extraction).              |

---

## `colorPalette` in slot recipes — the explicit-slot rule

### How `colorPalette` works

Panda's `colorPalette` property emits a `color-palette_{name}` atomic class on the
element, which sets `--colors-color-palette-*` CSS custom properties. Any style referencing
`colorPalette.*` tokens (e.g. `colorPalette.base`, `colorPalette.xlight`) resolves through
those variables.

### The inheritance trap

In a single-element `cva`, setting `colorPalette` once is enough — all conditions
(`_checked`, `_hover`, etc.) on the same element see the variables.

In an **`sva`**, slots are **different DOM elements**. Setting `colorPalette` only on
**root** and expecting child slots to inherit the CSS variables works for **unconditional**
styles (e.g. a thumb's base `bg`), but **fails for conditional states** like `_checked` on
a child slot. Panda's atomic extraction may not emit the conditional `colorPalette.*` rule
for an element that doesn't itself carry the `color-palette_*` class.

### The rule

> **Set `colorPalette` explicitly on every slot that references `colorPalette.*` tokens in
> conditional states** (`_checked`, `_hover`, `_expanded`, etc.).

In practice, this means the `palette` variant sets `colorPalette` on **multiple slots**:

```ts
// ✅ Correct — control gets its own colorPalette so _checked bg resolves
palette: {
  primary:   { root: { colorPalette: 'primary' },   control: { colorPalette: 'primary' } },
  danger:    { root: { colorPalette: 'danger' },     control: { colorPalette: 'danger' } },
  success:   { root: { colorPalette: 'success' },    control: { colorPalette: 'success' } },
  // ...
},

// ❌ Broken — control inherits from root, but _checked bg never gets generated
palette: {
  primary: { root: { colorPalette: 'primary' } },
  // ...
},
```

Slots that only use `colorPalette.*` in **unconditional** base styles (e.g. thumb's
`bg: 'colorPalette.base'`) can rely on inheritance from root — they don't need their own
`colorPalette` entry.

### Shade availability

Panda only generates `--colors-color-palette-{shade}` variables for shades it has
**seen referenced** somewhere in a recipe or `css()` call. If your shade scale has
11 stops but only `colorPalette.base` and `colorPalette.xlight` appear in any recipe,
only those two will be available — `colorPalette.dark`, `colorPalette.lighter`, etc.
will silently resolve to nothing.

To unlock a new shade: use it in at least one recipe or `css()` call inside the DS
`include` glob, then restart the consumer Vite dev server (see below).

### Debugging checklist

If a `colorPalette.*` token isn't applying in a conditional state:

1. **Restart the consumer Vite dev server.** This is the most common cause. When the
   DS adds new `colorPalette.*` references or new `colorPalette` entries on slots,
   Vite's HMR alone won't pick up the new atomic classes from linked packages — it
   needs a cold start to re-scan the dependency graph.
2. **Inspect the element in DevTools.** Does it have a `color-palette_{name}` class? If
   not, add `colorPalette` to that slot in the palette variant.
3. **Check whether the conditional CSS rule exists.** Look for a rule like
   `.checked\}:bg_colorPalette\.xlight` in the Styles panel. If missing, Panda didn't
   extract it — the slot likely needs its own `colorPalette` class to trigger extraction.
4. **Check the shade is in use.** If the specific `colorPalette.*` shade resolves to
   nothing (grey/transparent), Panda may not have generated it yet. See **Shade
   availability** above.
5. **Test with at least two non-default palettes** (e.g. `danger` + `success`) to confirm
   the slot visually changes.

### When to use a fixed token instead

Some properties are intentionally **not** palette-aware:

- **Focus ring** (`outlineColor: 'accent.focusRing'`) — consistent across all palettes.
- **Disabled overlay** — typically a fixed opacity/grayscale filter.
- **Error text** (`color: 'fg.error'`) — always red, regardless of palette.
- **Unchecked track** (`bg: 'bg.muted'`) — neutral baseline, not palette-scoped.

---

## Recipe return variable (`styles`)

When you call a slot recipe in TSX, bind the result to a name that signals "generated
classes from Panda":

| Situation                                    | Name                                         | Usage                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **One** `sva` recipe in the component/module | **`styles`**                                 | `const styles = switchRecipe({ size, palette })` → `styles.root`, `styles.control`, …                                                         |
| **Two or more** recipes in the same scope    | **`styles` + component suffix (PascalCase)** | `const stylesSwitch = switchRecipe({ … })`, `const stylesDialog = dialogRecipe({ … })` — suffix matches the recipe/component you are styling. |

Apply the same idea in **`SwitchDS`**, **`CheckboxDS`**, and any wrapper that calls
`checkboxRecipe` / `switchRecipe` directly: use **`styles`** / **`stylesCheckbox`**, not
**`cls`**.

---

## When to use `sva` instead of `cva`

| Use **`sva`**                                                                                 | Use **`cva`**                                                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Two or more** Ark sub-elements each need distinct styles (Root, Control, Thumb, Label, …).  | **One** rendered element gets variants (e.g. **Button**, **Badge**, **Text**, **Spinner**).                       |
| You use **`createStyleContext(recipe)`** and export a **compound object** (`Switch.Root`, …). | You call **`recipe({ variants })`** and pass the string to **`className`** (often with **`cx(..., className)`**). |

**Rule of thumb:** almost every **Ark compound** in `components/` or `forms/` should be **`sva` + `createStyleContext`**, not a lone `cva` on one slot only.

---

## File layout (per component)

| File               | Role                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `{name}.recipe.ts` | `sva({ className, slots, base, variants, defaultVariants, compoundVariants? })` + `*RecipeProps` type |
| `{name}.tsx`       | Compound export + optional `*DS` wrapper                                                              |
| `index.ts`         | Barrel re-exports                                                                                     |

**No separate `{name}.types.ts`** — the `*RecipeProps` type lives at the **bottom of `{name}.recipe.ts`**, co-located with the recipe it describes.

```ts
// bottom of accordion.recipe.ts
import type { RecipeProps } from '../../types/recipes.types';

export type AccordionRecipeProps = RecipeProps<typeof accordionRecipe>;
```

> **Naming convention:** `sva` recipes export `*RecipeProps`; `cva` recipes export `*Variants`.
> This distinguishes multi-slot compounds from single-element atomics at a glance.
> Some older recipes (Switch, Dialog, RadioGroup, etc.) still use `*Variants` — align to
> `*RecipeProps` when touching those files.

---

## Slot recipe (`sva`) checklist

- **`className`:** short kebab name matching the component (e.g. `'switch'`, `'checkbox'`).
- **`slots`:** list every styled part; include **`description`** / **`errorText`** (or equivalent) on field-style recipes when copy is styled.
- **`base`:** per-slot objects; use Panda conditions (`_focusVisible`, `_checked`, `_disabled`, …) aligned with Ark **`data-*`** behavior.
- **`variants`:** size, palette, layout, etc.; use **`defaultVariants`** so consumers omit props safely.
- **`colorPalette` on conditional slots:** if a slot uses `colorPalette.*` in `_checked` / `_hover` / `_expanded` / etc., that slot **must** have `colorPalette` set directly in the palette variant — do not rely on inheritance from root. See **`colorPalette` in slot recipes** above.
- **Recipe JSDoc:** first line = name; list **slots** and **variant groups**; document the color mechanism.

---

## `createStyleContext` compound export

```ts
const { withProvider, withContext } = createStyleContext(switchRecipe);

export const Switch = {
  Root: withProvider(ArkSwitch.Root, 'root'),
  Control: withContext(ArkSwitch.Control, 'control'),
  Thumb: withContext(ArkSwitch.Thumb, 'thumb'),
  Label: withContext(ArkSwitch.Label, 'label'),
  HiddenInput: ArkSwitch.HiddenInput, // pass-through, no slot
};
```

- **`withProvider`:** the slot that owns **recipe variant props** (`size`, `palette`, …) — usually Ark **`Root`**.
- **`withContext`:** every other styled sub-part.
- **Unstyled pass-throughs** (`HiddenInput`, portal-only parts): attach Ark primitive **without** `withContext` when there is no recipe slot.

---

## JSDoc — compound object

1. **Block above `export const Switch`** (or equivalent):
   - What the compound is (styled Ark X, wired to `switchRecipe`).
   - **Where props go** (e.g. control state on **`Root`**).
   - **`@example`** with full **anatomy** — the snippet a consumer can copy and trim.

2. **One-line `/** ... \*/` immediately above each property\*\* in the object:
   - **`Root`:** state, handlers, variant props.
   - **`Control` / `Thumb` / …:** role + that slot classes come from context.

This improves hover text in the IDE for **`Switch`**, **`Switch.Root`**, etc.

---

## Convenience wrappers (`SwitchDS`, `CheckboxDS`, …)

- Call **`switchRecipe({ size, palette })`** (or equivalent), assign to **`styles`** (or **`stylesSwitch`** if multiple recipes share the scope), then apply **`styles.root`**, **`styles.control`**, … on the matching Ark elements (same pattern as **CheckboxDS**).
- Prefer a **`classNames?: { root?, control?, … }`** object for overrides instead of many one-off `*ClassName` props.
- **Naming:** **`{Component}DS`** is the canonical name for opinionated DS wrappers; bare **`{Component}`** is the styled compound (e.g. **`Switch`** + **`SwitchDS`**). No `*Field` aliases.
- **Simpler handlers:** e.g. **`onChange(checked: boolean)`** on **`SwitchDS`**, forwarding to Ark **`onCheckedChange`** internally — **do not** expose Ark's detail object on the wrapper unless you intentionally mirror Ark.
- **No inline `style`:** use Panda `css()` for any layout wrappers inside DS components. Extract to a module-level `const` when the value is static (see `textColumnStyle` in `SwitchDS`).

---

## After you change a recipe

1. **Run `panda codegen`** in `packages/design-system` (or let the watcher handle it).
2. **Restart the consumer Vite dev server.** This is essential when the recipe change
   introduces new atomic classes — particularly new `colorPalette.*` shade references or
   new `colorPalette` entries on slots. Vite's HMR does not re-scan linked package
   dependencies deeply enough to detect new Panda-generated classes. A cold start
   (`Ctrl-C` → `pnpm dev`) forces Vite to rebuild its module graph and pick up
   everything.
3. Ensure consuming apps' **`panda.config.ts`** **`include`** covers linked DS source if
   they generate CSS from DS recipes.

---

## Anti-patterns

- **`cva` only on `Control`** while **Root / Label / Thumb** use ad hoc CSS modules — migrate to **one `sva`**.
- **Local `function cx(...)`** — use **`@styled-system/css`** **`cx`** only.
- **Duplicating `switchRecipe()` on both Root and Control** — each slot gets recipe classes **once**, from the correct slot definition.
- **`colorPalette` only on root when child slots need it conditionally** — if a child slot uses `colorPalette.*` inside `_checked` / `_hover` / etc., it needs `colorPalette` set directly on that slot in the palette variant. Inheritance from root is not sufficient for Panda's atomic extraction of conditional rules.
- **Mixed `colorPalette.*` and fixed tokens for the same concern** — if a slot should respond to palette, **all** its color properties must use `colorPalette.*`. Using `accent.solid` on the control while `colorPalette.base` on the thumb breaks palette switching.
- **Inline `style` attribute in DS wrappers** — use `css()` to keep everything in the Panda pipeline.
