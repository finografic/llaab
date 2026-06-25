# DONE — `apps/server` (Hono)

> **Completed:** 2026-04-17 — server scaffolded, client migrated, all routes implemented.

---

## Why

Astro API routes are UI glue — they exist to let a page talk to the backend without a second
process during development. The moment anything needs to call the same logic _without_ a browser
involved (agent loops, CLI triggers, scheduled jobs, LLM pipelines, future mobile or external
consumers), the logic belongs in a dedicated server, not co-located with page files.

The split is clean: `apps/client` becomes a pure UI; `apps/server` owns all vault I/O, skill
execution, and agent coordination.

---

## Core Dependencies

### Server (`apps/server`)

| Package               | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `hono`                | Router — lightweight, Bun-native, first-class TypeScript           |
| `@hono/zod-validator` | Request validation using the existing `@llaab/schemas` Zod schemas |
| `http-status-codes`   | Named HTTP status constants (`HttpStatusCodes.OK`, etc.)           |
| `@llaab/skills`       | Skill execution — `ingestYouTube`, `captureIdea`, `runSkill`       |
| `@llaab/core`         | Vault I/O — `readNode`, `listNodes`, `VAULT_ROOT`                  |
| `@llaab/schemas`      | Zod schemas — request/response contracts                           |
| `picocolors`          | CLI request logging (already in ecosystem)                         |

### Client (`apps/client`) — changes on migration

| Change                       | Detail                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| Remove `@llaab/skills`       | No longer calls skills directly — goes via HTTP                 |
| Remove `@llaab/ingestion`    | Same reason                                                     |
| Add `hono/client` (optional) | Hono RPC — full end-to-end type safety from server router types |
| Add `SERVER_URL` env var     | `http://localhost:3000` in dev; configurable                    |
| Add `src/lib/api-client.ts`  | Thin fetch wrapper (or Hono RPC client) used by React islands   |

---

## Auth Strategy

This is a local dev tool — there is no public deployment. Two options:

### Option A — Shared API Key (recommended for now)

The server reads a key from env (`LLAAB_API_KEY`). The client sends it as a header on every
request. Simple, zero deps, zero sessions.

```
# .env (both apps read this)
LLAAB_API_KEY=llaab-dev
```

```ts
// Client request
fetch('http://localhost:3000/api/ingest', {
  headers: { 'X-API-Key': import.meta.env.LLAAB_API_KEY },
  ...
});
```

```ts
// Server middleware
app.use('/api/*', async (c, next) => {
  const key = c.req.header('X-API-Key');
  if (key !== process.env['LLAAB_API_KEY']) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});
```

No sessions, no cookies, no OAuth — appropriate for localhost.

### Option B — `@hono/auth-js` (for when real auth is needed)

If the server ever needs to be accessible over a network or support multiple users, `@hono/auth-js`
is the established path (same library as in the other monorepo). This adds a proper session layer
and supports OAuth providers. Defer until there is an actual requirement.

---

## Implemented Structure

```
apps/server/
  src/
    app.ts                  ← Hono app — CORS, auth middleware, chained route registration
    index.ts                ← Entry point — Bun.serve()
    lib/
      create-app.ts         ← createRouter() + createApp() helpers
    middlewares/
      auth.middleware.ts    ← X-API-Key guard
      logger.middleware.ts  ← Request/response logging
    routes/
      index.route.ts        ← GET / — health + version
      ingest/
        index.ts            ← Pure composition — exports ingestRouter
        ingest.schema.ts    ← Zod schemas + inferred types
        ingest.routes.ts    ← Named handler exports { path, handler }
      vault/
        index.ts            ← Pure composition — exports vaultRouter
        vault.schema.ts
        vault.routes.ts
      runs/
        index.ts            ← Pure composition — exports runsRouter
        runs.routes.ts      ← (no schema needed — no request validation)
      llm/
        index.ts            ← Pure composition — exports llmRouter
        llm.schema.ts
        llm.routes.ts
      agent/
        index.ts            ← Pure composition — exports agentRouter
        agent.schema.ts
        agent.routes.ts
    types/
      app.types.ts          ← AppCtx / AppCtxJson<T> / AppCtxQuery<T> context helpers
  package.json
  tsconfig.json
```

---

## Route Conventions

Three files per route group:

**`*.schema.ts`** — Zod validators and inferred types. No logic.

**`*.routes.ts`** — Handler functions with semantic names (`list`, `detail`, `create`, `youtube`,
etc.). Each export is `{ path: '/relative-path', handler: async (c) => ... }`. Handlers use
`AppCtx`, `AppCtxJson<T>`, or `AppCtxQuery<T>` so `c.req.valid()` is typed correctly in
isolation.

**`index.ts`** — Pure composition. Imports schemas and route handlers, wires them:
`createRouter().get(routes.list.path, routes.list.handler)`. Exports a named router.

See `docs/server/HONO_RPC.md` for the full guide including step-by-step for adding routes.

---

## Example — `ingest` Route

### `routes/ingest/ingest.schema.ts`

```ts
import { z } from 'zod';

export const ingestYouTubeBodySchema = z.object({
  url:   z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  tags:  z.array(z.string()).optional(),
});

export type IngestYouTubeBody = z.infer<typeof ingestYouTubeBodySchema>;
```

### `routes/ingest/ingest.routes.ts`

```ts
import { ingestYouTube } from '@llaab/skills';
import type { AppCtxJson } from '../../types/app.types.js';
import type { IngestYouTubeBody } from './ingest.schema.js';

export const youtube = {
  path: '/youtube' as const,
  handler: async (c: AppCtxJson<IngestYouTubeBody>) => {
    const body = c.req.valid('json');
    const { record, result } = await ingestYouTube({ url: body.url, title: body.title, tags: body.tags });

    if (record.status === 'failed') {
      return c.json({ success: false as const, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    const reused = result.runTrace?.stages.some((s) => s.name === 'dedupe:transcript') ?? false;
    return c.json({ success: true as const, result: { id: result.id, path: result.path, type: result.type, reused } });
  },
};
```

### `routes/ingest/index.ts`

```ts
import { zValidator } from '@hono/zod-validator';
import { createRouter } from '../../lib/create-app.js';
import { ingestYouTubeBodySchema } from './ingest.schema.js';
import * as routes from './ingest.routes.js';

export const ingestRouter = createRouter()
  .post(routes.youtube.path, zValidator('json', ingestYouTubeBodySchema), routes.youtube.handler);
```

---

## Vault Routes (planned)

| Method | Path                   | Handler    | Notes                                     |
| ------ | ---------------------- | ---------- | ----------------------------------------- |
| GET    | `/vault/nodes`         | `list`     | `listNodes()` — optional `?type=` filter  |
| GET    | `/vault/nodes/:id`     | `getOne`   | `readNode()` by id                        |
| GET    | `/vault/nodes/:id/raw` | `getRaw`   | Raw markdown file content                 |
| GET    | `/vault/runs`          | `listRuns` | All `RunNode` entries                     |
| GET    | `/vault/runs/:id`      | `getRun`   | Single run with full stage/decision trace |

These replace the current `/api/vault/file` Astro route and the vault browser's direct `fs` calls.

---

## LLM Routes (future)

LLM communications will almost certainly need to run through the server, not through Astro — they
may be long-running, may need streaming (`text/event-stream`), and may be triggered by agents
rather than user gestures. A `routes/llm/` module is the right home when that work starts.

Hono supports streaming responses natively via `c.streamText()` — no extra adapter needed.

---

## Client Migration Checklist

- [x] Add `SERVER_URL` + `LLAAB_API_KEY` to root `.env` / `.env.example`
- [x] Create `src/lib/api-client.ts` — `apiGet` / `apiPost` wrappers with `X-API-Key` header
- [x] Update `IngestForm.tsx` — calls `POST /api/ingest/youtube` via `apiPost`
- [x] Update `VaultBrowser.tsx` — calls `GET /api/vault/file?path=` via `apiGet`
- [x] Delete `apps/client/src/pages/api/ingest.ts`
- [x] Delete `apps/client/src/pages/api/vault/file.ts`
- [x] Remove `@llaab/skills` and `@llaab/ingestion` from `apps/client/package.json`
- [x] `apps/client/src/pages/api/vault/auth.ts` — kept (cookie-based vault login is UI-specific)

---

## Open Questions

- Hono RPC vs plain fetch in the client — RPC gives full type safety but requires the router type to be exported and imported in the client. Straightforward with a monorepo, but adds a compile-time coupling. Plain fetch is simpler and fine for now.
- Port convention — `3000` for server, `4321` for client (Astro default). Make explicit in `.env.example`.
- Agent triggers — will agents be triggered by HTTP (a `POST /agent/run` route) or by in-process calls? Shapes whether `routes/agent/` is needed or whether the agent layer is purely internal.
