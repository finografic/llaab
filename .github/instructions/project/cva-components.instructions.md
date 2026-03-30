# CVA components — atomic recipes & single-element components

Authoring guide for **`cva`** (class variance / atomic recipes) on **one DOM node**
in `packages/design-system/src/components/` (and rare single-node cases elsewhere).

**Pair doc:** [SVA components](sva-components.instructions.md) for multi-slot Ark
compounds and `createStyleContext`.

---

## Shared conventions (all Panda component work)

Same rules as **[sva-components.instructions.md](sva-components.instructions.md)** (section **Shared conventions**). In short:

| Topic                             | Rule                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`cx`**                          | Import only from `@styled-system/css`. **Inline** `cx(...)` in JSX when the result is used **once**; use a `const` only if reused, very long, or clarity needs a name.                                                          |
| **Deprecated API**                | Do **not** add `@deprecated` props or backward-compat aliases. Prefer a clean break while the API is still settling.                                                                                                            |
| **`onChange` at the DS boundary** | On **wrappers**, simplify handler shapes when it helps DX; **primitives** stay close to DOM/Ark (`onCheckedChange` on a raw button is N/A — buttons use `onClick`).                                                             |
| **Types**                         | Export explicit variant unions where `RecipeProps<>` is insufficient (e.g. `ButtonVariant`, `ButtonPalette`). Do not index `RecipeProps` for keys that are not exposed.                                                         |
| **Tokens**                        | Prefer semantic tokens in recipes (`fg`, `bg.muted`, `accent.solid`, `border.subtle`). Port Ark demo CSS by **mapping** demo variables to tokens, not by shipping demo CSS variables.                                           |
| **Ark example CSS**               | Treat Ark docs stylesheets as a **spec** → implement as Panda **`cva`** + tokens. Avoid shipping parallel **CSS modules** for the same UI long term.                                                                            |
| **Recipe binding name**           | The variable holding a recipe's return value is always **`styles`** (a class string), not `recipeClass` or `cls`. Multiple recipes in one scope: **`stylesButton`**, **`stylesBadge`**, etc.                                    |
| **No inline `style` in wrappers** | Never use the `style` attribute for layout in DS wrappers — use Panda `css()` instead. Module-level `const` for static values; `css()` inline for one-offs. Keeps all styling in the Panda layer (cascade, tokens, extraction). |

---

## Recipe return variable (`styles`)

**`cva`** returns a **single class string** (unlike **`sva`** slot objects). Still use
the same naming rule:

| Situation                                | Name                             | Example                                                                                         |
| ---------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| One recipe in scope                      | **`styles`**                     | `const styles = buttonRecipe({ size, variant, palette })` → `className={cx(styles, className)}` |
| Several recipes in the same file/closure | **`styles` + PascalCase suffix** | `const stylesButton = buttonRecipe(…)`, `const stylesIcon = iconRecipe(…)`                      |

---

## When to use `cva` instead of `sva`

| Use **`cva`**                                                                                             | Use **`sva`** instead                                                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Single** element receives all variant styles (**Button**, **Badge**, **Text**, **Spinner**, **Label**). | **Multiple** Ark (or DS) parts each need classes (**Dialog**, **Switch**, **Checkbox**, **Select**). |
| One **`className`** string from **`buttonRecipe({ ... })`**.                                              | **`recipe()`** returns an object of slot class strings, or **context** injects them per slot.        |

Do **not** wrap a lone `cva` in fake **`{ root: '...' }`** “slots” just for consistency — that obscures when **`sva`** is the real tool.

---

## File layout (per component)

| File               | Role                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `{name}.recipe.ts` | `cva({ base, variants, compoundVariants?, defaultVariants })` + `*Variants` type + explicit union types |
| `{name}.tsx`       | `forwardRef` component; **`cx(recipe(...), className)`**                                                |
| `index.ts`         | Barrel                                                                                                  |

**No separate `{name}.types.ts`** — the `*Variants` type and any explicit union exports (`ButtonVariant`, `ButtonPalette`, …) live at the **bottom of `{name}.recipe.ts`**, co-located with the recipe they describe.

```ts
// bottom of button.recipe.ts
import type { RecipeProps } from '../../types/recipes.types';

export type ButtonVariants = RecipeProps<typeof buttonRecipe>;
export type ButtonVariant  = 'solid' | 'subtle' | 'outline' | 'ghost' | 'link';
export type ButtonPalette  = 'default' | 'primary' | 'danger' | …;
```

---

## Recipe (`cva`) checklist

- **`base`:** shared layout, transitions, focus rings, disabled states.
- **`variants`:** orthogonal axes (`size`, `variant`, `palette`, `iconOnly`, …).
- **`compoundVariants`:** combinations that are not a simple product of axes (e.g. warning + solid).
- **`defaultVariants`:** safe defaults for every variant group you expect consumers to omit.
- **JSDoc:** variant groups and semantics (**`palette`** sets `colorPalette` for token resolution, etc.).

---

## Component implementation

- **`forwardRef`** to the underlying element (`ark.button`, `span`, …).
- **`const styles = buttonRecipe({ ... })`** when you reference the class string more than once (e.g. `styles` + `buttonRecipe.raw`); otherwise inline **`className={cx(buttonRecipe({ ... }), className)}`** per the **`cx`** inlining rule.
- Merge consumer **`className`** last: **`cx(styles, className)`**.
- Expose **`data-*`** attributes that help debugging and style hooks (`data-size`, `data-variant`, `data-loading`, …) where useful.

---

## JSDoc

- Top-of-file or above **`export const Button`:** purpose, recipe name, **usage `import`**, minimal **`@example`** with variants.
- Keeps parity with **SVA** docs: consumers discover API from the component export, not only README.

---

## Anti-patterns

- **`cva`** for a component that is actually **multi-part** Ark UI — use **`sva` + `createStyleContext`**.
- **`clsx` / `cn`** for Panda class strings in DS code — use **`cx`** from **`@styled-system/css`** for consistency with generated classes.
- **Local `function cx(...)`** — use **`@styled-system/css`** **`cx`** only.
- **Inline `style` attribute in DS wrappers** — use `css()` to keep everything in the Panda pipeline.
