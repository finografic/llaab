# Hono RPC — Developer Guide

How the typed client works, how to add new routes, and why this replaces the manual pattern.

---

## What changed — the handler files

The old pattern had three files per route group:

```
routes/vault/
  vault.routes.ts    ← Zod schemas + input types
  vault.handlers.ts  ← handler functions (Context → Response)
  index.ts           ← wires them together
```

The new pattern has two:

```
routes/vault/
  vault.routes.ts    ← Zod schemas + input types  (unchanged)
  index.ts           ← schemas + inline handlers, chained
```

The handler logic moved inline into `index.ts`. The reason is below.

---

## Why inline handlers are required for RPC

Hono infers types by reading the **chain** of method calls on a router. When you write:

```ts
const vaultRouter = createRouter()
  .get('/nodes', zValidator('query', listNodesQuerySchema), async (c) => {
    const nodes = await listNodes(c.req.valid('query'));
    return c.json({ nodes });           // ← TypeScript sees this return value
  })
```

TypeScript sees `c.json({ nodes })` and captures `{ nodes: LabNode[] }` as the response type for
`GET /vault/nodes`. That information lives in `typeof vaultRouter`.

With the old pattern:

```ts
// OLD — type information is lost
router.get('/nodes', zValidator('query', schema), handleListNodes);
//                                                ↑ this is (c: Context) => Promise<Response>
//                                                  TypeScript only sees "Response", not the shape
```

When you pass a separate handler function, TypeScript sees `Promise<Response>` — the specific shape
of `{ nodes: LabNode[] }` is erased. The chain only captures types for inline return values.

This is a TypeScript structural inference limitation, not a Hono limitation.

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

`AppType` is a TypeScript type that encodes every registered route, its input schema, and its
response shape. It is a pure type — zero bytes at runtime.

### Client — `apps/client/src/lib/rpc.ts`

```ts
import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';   // type-only import, erased at build

export const rpc = hc<AppType>(baseUrl);
```

`hc<AppType>` returns a proxy object whose property path mirrors the server's URL structure:

| URL                        | `rpc` accessor                      |
| -------------------------- | ----------------------------------- |
| `GET /api/vault/file`      | `rpc.api.vault.file.$get()`         |
| `GET /api/vault/nodes`     | `rpc.api.vault.nodes.$get()`        |
| `POST /api/vault/nodes`    | `rpc.api.vault.nodes.$post()`       |
| `GET /api/vault/nodes/:id` | `rpc.api.vault.nodes[':id'].$get()` |
| `POST /api/ingest/youtube` | `rpc.api.ingest.youtube.$post()`    |
| `GET /api/runs`            | `rpc.api.runs.$get()`               |
| `GET /api/runs/:id`        | `rpc.api.runs[':id'].$get()`        |

The `$get` / `$post` methods accept typed input and return a `Promise<TypedResponse<T>>`. You still
call `.json()` on the response — the difference is that TypeScript knows the shape of what comes
back.

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

Error handling: check `res.ok` (HTTP status) or check if `'error' in data` after `.json()` if the
route returns error shapes — the union type makes this safe:

```ts
const data = await res.json();
if ('error' in data) {
  throw new Error(data.error);
}
// data.nodes is LabNode[] here
```

---

## Adding a new route — step by step

### 1 — Define the schema (if needed)

In `apps/server/src/routes/<group>/<group>.routes.ts`:

```ts
export const createPackageBodySchema = z.object({
  packageName: z.string().min(1),
  ecosystem: z.enum(['npm', 'brew']),
});
```

### 2 — Add the handler inline in the router

In `apps/server/src/routes/<group>/index.ts`, extend the chain:

```ts
export const packagesRouter = createRouter()
  .get('/', async (c) => {
    const packages = await listNodes({ type: 'package' });
    return c.json({ packages });
  })
  .post('/', zValidator('json', createPackageBodySchema), async (c) => {
    const body = c.req.valid('json');
    const result = await addPackageNode(body);
    return c.json(result, 201);
  });
```

### 3 — Register the router in `app.ts`

```ts
export const app = _base
  // existing routes ...
  .route('/api/packages', packagesRouter);   // ← add this line

export type AppType = typeof app;            // no other change needed
```

### 4 — Use it in the client

The type is immediately available — no manual type definition needed:

```ts
const res = await rpc.api.packages.$get();
const { packages } = await res.json();
// packages is typed as LabNode[] (or whatever the handler returns)

const res = await rpc.api.packages.$post({
  json: { packageName: 'citty', ecosystem: 'npm' },
});
```

TypeScript will error if you pass wrong fields, wrong types, or access a route that doesn't exist.

---

## Why RPC over the original pattern

### Original pattern (generic fetch wrapper)

```ts
// api-client.ts
const data = await apiPost<CreateResult>('/api/vault/nodes', { type: 'idea', title });
```

Problems:

- `CreateResult` is a manually maintained interface — it can drift from what the server actually
  returns
- The URL string is untyped — a typo (`/api/vaullt/nodes`) compiles fine
- The body type is `unknown` — passing extra or missing fields compiles fine
- Refactoring a route name requires grep + manual update across all call sites

### Hono RPC

```ts
const res = await rpc.api.vault.nodes.$post({ json: { type: 'idea', title } });
const data = await res.json();
```

Advantages:

- **No manual types** — response shape is inferred from `c.json()` in the handler; update the
  handler and the client type updates automatically
- **URL is a type** — `rpc.api.vaullt` doesn't exist; TypeScript errors at the call site, not at runtime
- **Body is validated** — the Zod schema used by `zValidator` drives the input type; wrong shape
  = compile error
- **Automatic coverage** — every new route added to the server is immediately typed in the client
  with zero client-side changes
- **Refactor-safe** — rename a route, add/remove a field from the response, change a query param;
  TypeScript finds all broken call sites instantly
- **No runtime overhead** — `AppType` is erased at build time; `hc<AppType>` adds zero bytes to
  the client bundle beyond the tiny `hono/client` runtime

The cost: handler logic must be inline in the chained router definition (no separate handler
files). For this codebase where handlers are thin wrappers around `@llaab/core` and
`@llaab/skills` functions, the tradeoff is worth it.

---

## The `import type` across app boundary

`rpc.ts` imports from `'../../../server/src/app.js'` — a relative path that crosses the
`apps/client` / `apps/server` boundary. This is valid because:

1. It is a **type-only import** (`import type`), erased entirely at compile time. Vite/Astro
   never bundles server code into the client.
2. TypeScript resolves transitive type imports relative to the **imported file's location**
   (`apps/server/`), where all server deps (`@llaab/skills`, `@llaab/llm`, etc.) are available
   via pnpm workspace symlinks.
3. The client only needs `hono` (already a dependency) to use `hono/client` at runtime.
