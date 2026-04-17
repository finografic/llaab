# Hono RPC — Developer Guide

How the typed client works, how to add new routes, and why this replaces the manual pattern.

---

## Route module structure

Each route group under `apps/server/src/routes/` has three files:

```
routes/vault/
  vault.schema.ts   ← Zod schemas + inferred TS types
  vault.routes.ts   ← Named handler exports { path, handler }
  index.ts          ← Wires path + validator + handler; exports named router
```

**`*.schema.ts`** — Zod validators and their inferred types. No logic.

```ts
// vault.schema.ts
export const listNodesQuerySchema = z.object({
  type: NodeTypeSchema.optional(),
  limit: z.string().optional().transform((v) => v ? parseInt(v) : undefined),
});
export type ListNodesQuery = z.infer<typeof listNodesQuerySchema>;
```

**`*.routes.ts`** — Handler functions with semantic names. Each export is `{ path, handler }`.
Handlers use `AppCtx`, `AppCtxJson<T>`, or `AppCtxQuery<T>` from `types/app.types.ts` so
`c.req.valid()` is fully typed without being inside the validator chain at definition time.

```ts
// vault.routes.ts
import type { AppCtxQuery } from '../../types/app.types.js';
import type { ListNodesQuery } from './vault.schema.js';

export const listVaultNodes = {
  path: '/nodes' as const,
  handler: async (c: AppCtxQuery<ListNodesQuery>) => {
    const query = c.req.valid('query');
    const nodes = await listNodes(query);
    return c.json({ nodes });
  },
};
```

**`index.ts`** — Pure composition. Imports schemas and route handlers, wires them together.
No business logic here.

```ts
// index.ts
import { zValidator } from '@hono/zod-validator';
import { createRouter } from '../../lib/create-app.js';
import { listNodesQuerySchema } from './vault.schema.js';
import * as routes from './vault.routes.js';

export const vaultRouter = createRouter()
  .get(routes.listVaultNodes.path, zValidator('query', listNodesQuerySchema), routes.listVaultNodes.handler)
  .post(routes.createVaultNode.path, zValidator('json', createNodeBodySchema), routes.createVaultNode.handler);
```

---

## How AppType flows to the client

### Server — `apps/server/src/app.ts`

```ts
export const app = _base
  .route('/api/vault', vaultRouter)
  .route('/api/ingest', ingestRouter)
  // ...

export type AppType = typeof app;
```

`AppType` encodes every registered route, its input schema, and its response shape. It is a
pure type — zero bytes at runtime. The chained `.route()` form is required so TypeScript can
track the cumulative route shape through each call.

### Client — `apps/client/src/lib/rpc.ts`

```ts
import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';   // type-only import, erased at build

export const rpc = hc<AppType>(baseUrl);
```

`hc<AppType>` returns a proxy whose property path mirrors the server's URL structure:

| URL                        | `rpc` accessor                      |
| -------------------------- | ----------------------------------- |
| `GET /api/vault/file`      | `rpc.api.vault.file.$get()`         |
| `GET /api/vault/nodes`     | `rpc.api.vault.nodes.$get()`        |
| `POST /api/vault/nodes`    | `rpc.api.vault.nodes.$post()`       |
| `GET /api/vault/nodes/:id` | `rpc.api.vault.nodes[':id'].$get()` |
| `POST /api/ingest/youtube` | `rpc.api.ingest.youtube.$post()`    |
| `GET /api/runs`            | `rpc.api.runs.$get()`               |
| `GET /api/runs/:id`        | `rpc.api.runs[':id'].$get()`        |

---

## Using `rpc` in a component

```tsx
import { rpc } from '../lib/rpc';

// GET with query params
const res = await rpc.api.vault.nodes.$get({ query: { type: 'idea' } });
const { nodes } = await res.json();
// nodes is typed as LabNode[]

// POST with JSON body
const res = await rpc.api.vault.nodes.$post({
  json: { type: 'idea', title: 'My idea', tags: ['d:llm'] },
});
const data = await res.json();
// data is typed as { id: string; path: string; type: string } | { error: string }

// Dynamic segment
const res = await rpc.api.vault.nodes[':id'].$get({ param: { id: nodeId } });
const { node } = await res.json();
```

Error handling — check `res.ok` or check for `'error' in data` after `.json()`:

```ts
const data = await res.json();
if ('error' in data) {
  throw new Error(data.error);
}
// data.nodes is LabNode[] here
```

---

## Adding a new route — step by step

### 1 — Add the schema (if needed)

In `apps/server/src/routes/<group>/<group>.schema.ts`:

```ts
export const createThingBodySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['a', 'b']),
});
export type CreateThingBody = z.infer<typeof createThingBodySchema>;
```

### 2 — Add the handler in `*.routes.ts`

```ts
// things.routes.ts
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CreateThingBody } from './things.schema.js';

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) => {
    const things = await listNodes({ type: 'thing' });
    return c.json({ things });
  },
};

export const create = {
  path: '/' as const,
  handler: async (c: AppCtxJson<CreateThingBody>) => {
    const body = c.req.valid('json');
    const result = await createNode({ type: 'thing', title: body.name });
    return c.json(result, 201);
  },
};
```

### 3 — Wire it in `index.ts`

```ts
// things/index.ts
import { zValidator } from '@hono/zod-validator';
import { createRouter } from '../../lib/create-app.js';
import { createThingBodySchema } from './things.schema.js';
import * as routes from './things.routes.js';

export const thingsRouter = createRouter()
  .get(routes.list.path, routes.list.handler)
  .post(routes.create.path, zValidator('json', createThingBodySchema), routes.create.handler);
```

### 4 — Register in `app.ts`

```ts
export const app = _base
  // existing routes ...
  .route('/api/things', thingsRouter);   // ← add this line

export type AppType = typeof app;        // no other change needed
```

### 5 — Use it in the client

```ts
const res = await rpc.api.things.$get();
const { things } = await res.json();

const res = await rpc.api.things.$post({
  json: { name: 'My thing', kind: 'a' },
});
```

---

## Context type helpers

`apps/server/src/types/app.types.ts` exports three context types for use in `*.routes.ts`:

| Type             | Use when                                        |
| ---------------- | ----------------------------------------------- |
| `AppCtx`         | No validator — plain GET with no parsed input   |
| `AppCtxJson<T>`  | Handler follows a `zValidator('json', schema)`  |
| `AppCtxQuery<T>` | Handler follows a `zValidator('query', schema)` |

These declare the appropriate `in` types so `c.req.valid('json')` and `c.req.valid('query')` are
fully typed inside standalone handler functions.

---

## Why RPC over the original pattern

### Original pattern (generic fetch wrapper)

```ts
const data = await apiPost<CreateResult>('/api/vault/nodes', { type: 'idea', title });
```

Problems:

- `CreateResult` is a manually maintained interface — it can drift from what the server actually returns
- The URL string is untyped — a typo (`/api/vaullt/nodes`) compiles fine
- The body type is `unknown` — passing extra or missing fields compiles fine
- Refactoring a route name requires grep + manual update across all call sites

### Hono RPC

```ts
const res = await rpc.api.vault.nodes.$post({ json: { type: 'idea', title } });
const data = await res.json();
```

Advantages:

- **No manual types** — response shape is inferred from `c.json()` in the handler
- **URL is a type** — `rpc.api.vaullt` doesn't exist; TypeScript errors at the call site
- **Body is validated** — the Zod schema drives the input type; wrong shape = compile error
- **Automatic coverage** — every new route is immediately typed in the client
- **Refactor-safe** — rename a route or change a response field; TypeScript finds all broken sites
- **No runtime overhead** — `AppType` is erased at build time

---

## The `import type` across app boundary

`rpc.ts` imports from `'../../../server/src/app.js'` — a relative path that crosses the
`apps/client` / `apps/server` boundary. This is valid because:

1. It is a **type-only import** (`import type`), erased entirely at compile time.
2. TypeScript resolves transitive type imports relative to the **imported file's location**
   (`apps/server/`), where all server deps are available via pnpm workspace symlinks.
3. The client only needs `hono` (already a dependency) to use `hono/client` at runtime.
