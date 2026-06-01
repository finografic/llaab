# packages/ui/src/components

Canonical home for all shadcn/ui primitives in this monorepo.

## Adding components

Run from `apps/client` so `apps/client/components.json` controls the install target:

```bash
cd apps/client
pnpm dlx shadcn@latest add <component-name>
```

shadcn will write the new file here and update `globals.css` if needed.

## Importing

```ts
import { Button } from '@llaab/ui/components/button';
import { Card, CardContent } from '@llaab/ui/components/card';
```

Or from an `apps/client` file using the `components/ui/*` tsconfig alias:

```ts
import { Button } from 'components/ui/button';
```

## Conventions

- Internal `cn()` imports use `@llaab/ui/lib/utils` (not the app-local `lib/utils`).
- No `'use client'` directive unless the component requires it (e.g. `Separator`).
- Custom components that follow shadcn patterns (e.g. `Spinner`) live here too.
