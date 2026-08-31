---
applyTo: '**/{tsconfig*.json,vite.config.*,vitest.config.*,tsdown.config.*}'
description: Path aliases in a monorepo — who owns a short name, how packages reach each other, and keeping the bundler in step with TypeScript. Read before adding or changing any alias.
---

# Monorepo Path Aliases

Two failures keep recurring. Both are silent until something unrelated breaks.

1. A package's short aliases leak into its consumers, so the consumer can no
   longer use those names for its own folders.
2. An alias is added to `tsconfig.json` only. TypeScript is satisfied, so
   nothing complains until the bundler tries to load the file at run time.

---

## 1. A short alias is package-local

Inside a package, short names refer to that package's own folders.

```jsonc
// apps/server/tsconfig.json
"db": ["./src/db"],
"lib/*": ["./src/lib/*"],
"types/*": ["./src/types/*"]
```

Every package may claim the same names for itself. `lib/*`, `types/*`,
`utils/*`, `hooks/*` and `routes/*` are ordinary folder names, and an app is
near-certain to want them.

**Never point a short name at another package.** These are the shape to
refuse:

```jsonc
// apps/client/tsconfig.json — wrong
"types/*": ["../server/src/types/*"],   // client cannot have src/types
"utils/*": ["../server/src/utils/*"],   // and `utils` meant packages/ui
"hooks/*": ["../../packages/ui/src/hooks/*"]
```

## 2. Cross-package imports use the package name

```ts
import type { AppType } from '@workspace/server/app';
import { Button } from '@workspace/ui/components/button';
```

Never a relative climb out of the package — `../../../server/src/app` is the
same mistake written differently. The scope follows the workspace
(`@workspace/*`, `@llaab/*`); match what `package.json` `name` fields use.

A cross-package import should also be a declared dependency in the importing
package's `package.json`, so the build tool can order the two.

## 3. A package consumed as source must not force its aliases on consumers

This is what causes leak (1). If `packages/ui` is compiled from source by its
consumers and a component writes `from 'hooks/useIsMobile'`, then every
consumer must map `hooks/*` at `packages/ui` — and none of them can use
`hooks/*` for themselves.

Fix it at the source. The providing package imports itself by name:

```ts
// packages/ui/src/components/sidebar.tsx
import { useIsMobile } from '@workspace/ui/hooks/useIsMobile';
```

For a package consumed for its **types**, use TypeScript project references so
consumers read declarations instead of compiling source. Declarations carry no
path aliases, so nothing leaks:

```jsonc
// apps/server/tsconfig.json — the provider
"composite": true,
"declaration": true,
"emitDeclarationOnly": true,
"outDir": "./.types"        // not ./dist, which the bundler cleans
```

```jsonc
// apps/client/tsconfig.json — the consumer
"references": [{ "path": "../server" }]
```

Then set `typecheck` to `tsc --build` in both, so the provider is built first.
Add the provider's output directory to `.gitignore` and to the `typecheck`
task's `outputs` in `turbo.json`.

**Accepted exception:** shadcn/ui components are vendored source and import
each other as `ui/*` and the `cn` helper as `utils`. Keep those two mapped at
the UI package, and mark them in a comment as belonging to it.

## 4. Mirror every alias into the bundler config

TypeScript reads `paths` in `tsconfig.json`. Vite, Vitest, tsdown and the rest
do not. An alias present in only one of them typechecks and then fails to
resolve — for a frontend app that means a dead dev server on a file the editor
showed as fine.

Whenever a project has both, the two lists must be changed together:

```ts
// apps/client/vite.config.ts
resolve: {
  alias: {
    // This app's own folders.
    'assets': resolve('src/assets'),
    'features': resolve('src/features'),
    'hooks': resolve('src/hooks'),
    'lib': resolve('src/lib'),

    // Other workspace packages.
    '@workspace/ui': resolve('../../packages/ui/src'),

    // Provider-internal, needed because packages/ui is bundled from source.
    'ui': resolve('../../packages/ui/src/components'),
    'utils': resolve('../../packages/ui/src/lib/utils'),
  },
}
```

Only aliases that survive to run time need a bundler entry — a provider reached
purely through project references and type-only imports does not. When in doubt,
mirror it.

`vite-tsconfig-paths` removes the duplication by having the bundler read
`tsconfig.json` directly. Prefer it in new frontend projects. Where both lists
exist by hand, keep them in the same order and under the same comment headings
so a missing entry is visible.

## 5. Group the alias list

In both files, in this order, with these headings:

1. **This app's own folders** — the short names.
2. **Other workspace packages** — the `@workspace/*` entries; the only surface
   this package's own code may import from.
3. **Provider-internal aliases** — anything borrowed from a package consumed as
   source. Say in a comment that they are compiler and bundler plumbing, not an
   import surface, and never write them in this package's code.

An empty third group is the goal.

---

## Checklist before adding an alias

- Does it point inside this package? If not, use `@workspace/<pkg>/*` instead.
- Is the same name already claimed by a package this one consumes as source?
  Fix the provider rather than surrendering the name.
- Does the project have a bundler or test-runner config with its own alias
  list? Add it there too.
- Does the import need a `package.json` dependency to make the edge real?
