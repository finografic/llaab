# Component File Organization

When a component file grows past a few hundred lines — multiple sub-components, shared
types, helper functions, and a stateful main export all in one place — split it into a
folder before it becomes unreadable. This is the LLAAB convention for "how to break up a
huge component file."

Reference implementation: `apps/client/src/forms/IngestForm/` (split out of a ~970-line
`IngestForm.tsx`). Other examples of the same shape: `apps/client/src/dialogs/CleanVaultDialog/`,
`apps/client/src/tables/RunsTable/`.

## Folder shape

```text
src/forms/ComponentName/
  ComponentName.tsx          # main export + its Props interface
  component-name.types.ts    # shared types (only if reused by sub-components)
  component-name.utils.ts    # pure helper functions (only if reused or non-trivial)
  components/
    SubComponent.tsx         # one file per extracted sub-component
```

Only add `*.types.ts` / `*.utils.ts` / `components/` when there is something to put in
them — a component with no shared types or extracted children is just `ComponentName.tsx`
in its own folder, or doesn't need a folder at all.

## What to extract, and where

- **Shared types** (`FormValues`, phase unions, data shapes used by both the main
  component and its sub-components) → `component-name.types.ts`. Import with
  `import type { ... } from './component-name.types'`.
- **Pure helpers** (URL classification, label/phase derivation, formatting) →
  `component-name.utils.ts`. Anything that doesn't touch React state belongs here, not
  inline in the component body.
- **Presentational sub-components** (cards, lists, status rows — anything renderable on
  its own with its own props) → `components/SubComponent.tsx`, one component per file.
  Import with `import { SubComponent } from './components/SubComponent'`.
- **Cross-component constants** (taxonomy lists, enum-like arrays, anything duplicated
  across more than one component) → promote to `src/constants/<topic>.constants.ts`
  rather than copying into the new folder. `IngestForm` and `CreateIdeaPanel` both
  needed `KNOWN_TAGS`/`normalizeTag`; both now import from
  `constants/taxonomy.constants.ts`.

## Rules while splitting

- **Don't change behavior.** This is a structural move — copy logic verbatim into its new
  home, then wire up imports. Functional changes belong in a separate commit.
- **Replace hand-rolled `<svg>` icons with `@llaab/icons` / `lucide-react`** while you're
  in the file (see `.github/instructions/project/components-shadcn.instructions.md`).
  Don't introduce new inline SVG.
- **Replace native `<button>` with shadcn `Button`** where one exists for the job —
  `variant`/`size` plus the original CSS class (e.g. `pipeline-retry-btn`) usually
  preserves bespoke theming (see `packages/ui/src/components/button.tsx`).
- **Update every import site.** Folder moves change both the internal relative imports
  (siblings become `../Sibling`) and external references (`forms/ComponentName` becomes
  `forms/ComponentName/ComponentName` per the folder-import convention — full path
  including filename, not a barrel `index.ts`).
- **Delete the old flat file** once the folder is wired up and verified — don't leave a
  re-export shim behind.

## When NOT to split

- A component under ~150 lines with no extractable sub-components or shared types.
- A one-off presentational component that nothing else will ever import — adding a
  folder and a `components/` subfolder for a single file is overhead, not clarity.
