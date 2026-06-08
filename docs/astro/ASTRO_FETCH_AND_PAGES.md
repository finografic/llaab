# LLAAB — Astro: Pages, Fetch & File System

📅 Apr 13, 2026

This document covers Astro's rendering model as used in `@llaab/web`, how to build simple pages, and when/how to reach for `fetch`, file-system access, and TanStack Query.

---

## Rendering model — static + islands

Astro defaults to **fully static output**: every `.astro` page is pre-rendered to plain HTML at build time. Interactive behaviour lives in isolated **React islands** that hydrate in the browser.

```
.astro page           → server (or build time): renders HTML
  └── <Component      → browser: hydrates and runs as React
        client:load />
           └── fetch() → hits your /api/*.ts endpoint
```

There are three rendering directives for React islands:

| Directive        | When the island hydrates             |
| ---------------- | ------------------------------------ |
| `client:load`    | Immediately on page load             |
| `client:idle`    | When the browser is idle             |
| `client:visible` | When the component scrolls into view |

For LLAAB, `client:load` is fine for all interactive components.

---

## Configuration — LLAAB local setup

`apps/client/astro.config.ts` has no `output` key, which means the default `'static'` is active. This is intentional — LLAAB is a local dev tool only; no deployment adapter is needed.

API routes that must run server-side opt out of pre-rendering individually:

```typescript
// src/pages/api/ingest.ts
export const prerender = false; // ← this one line is all that is needed
```

**No adapter is installed or required.** Adapters (`@astrojs/node`, `@astrojs/vercel`, etc.) are only needed when deploying to a server or hosting platform. Running `astro dev` locally works without one.

If `astro build` ever warns about a missing adapter for server endpoints, ignore it — LLAAB is never built for production deployment.

---

## Getting started — a simple page

### 1. Static page (no data)

Create `src/pages/my-page.astro`:

```astro
---
// Frontmatter runs on the server (or at build time).
// Import components, fetch data, define variables here.
const title = 'My Page';
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
  </head>
  <body>
    <h1>{title}</h1>
  </body>
</html>
```

Visit `http://localhost:4321/my-page`.

### 2. Page with server-side data (file system)

Reading the vault at page-render time requires no API route — read directly in the `.astro` frontmatter. This runs on the server, so Node's `fs` is available.

```astro
---
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const vaultDir = path.resolve(process.cwd(), '../../vault/transcripts');
const files = await readdir(vaultDir);
---

<html lang="en">
  <head><meta charset="utf-8" /><title>Transcripts</title></head>
  <body>
    <ul>
      {files.map((f) => <li>{f}</li>)}
    </ul>
  </body>
</html>
```

> **Note:** direct `fs` access in `.astro` frontmatter works in `astro dev` without an adapter because the page is server-rendered on request. If you ever switch to `output: 'static'` (build-time pre-rendering), `fs` still works but the data is frozen at build time — not live.

### 3. Page with a React island (client interactivity)

```astro
---
import { MyForm } from '../components/MyForm';
---

<html lang="en">
  <head><meta charset="utf-8" /><title>Form</title></head>
  <body>
    <!-- client:load hydrates the component in the browser -->
    <MyForm client:load />
  </body>
</html>
```

`MyForm.tsx` is a normal React component. It has no special Astro knowledge.

---

## Getting started — fetch + API routes

### 1. Create the endpoint

```typescript
// src/pages/api/my-endpoint.ts
import type { APIRoute } from 'astro';

export const prerender = false; // required — opts this route out of static rendering

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  const data = { id, message: 'Hello from the server' };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // ... process body
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### 2. Call it from a React island

```typescript
// Inside any React component
const res = await fetch('/api/my-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://...' }),
});

const json = await res.json();
```

### 3. File system inside an API route

Because API routes run on the server, `node:fs` is fully available:

```typescript
// src/pages/api/transcripts.ts
import type { APIRoute } from 'astro';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

export const GET: APIRoute = async () => {
  const dir = path.resolve(process.cwd(), '../../vault/transcripts');
  const files = await readdir(dir);

  return new Response(JSON.stringify({ files }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

> **Adapter note:** `fs` access in API routes requires a server runtime. In `astro dev` this is provided automatically. For a production build you would need `@astrojs/node` (or another server adapter). LLAAB does not have a production build target, so this is a non-issue.

---

## When to add TanStack Query

Plain `fetch` + `useState` is the right default. Add TanStack Query only when you hit one of these:

| Scenario                                              | Why Query helps                             |
| ----------------------------------------------------- | ------------------------------------------- |
| **Optimistic updates**                                | Roll back UI on failure automatically       |
| **Pagination / infinite scroll**                      | Built-in page cursor management             |
| **Multiple components sharing the same server state** | Single cache, deduped requests              |
| **Background refetching**                             | Stale-while-revalidate without manual logic |

For a simple mutation (submit form → show result), `fetch` is sufficient and Query adds no value.

---

## Quick reference

| Goal                                 | Approach                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| Static page, no data                 | `.astro` file, no `prerender` flag needed                           |
| Page with live data from `fs`        | Read in `.astro` frontmatter, set `prerender = false` on the page   |
| Interactive UI                       | React component with `client:load`                                  |
| Server-side logic / `fs` from client | API route in `src/pages/api/`, add `export const prerender = false` |
| Shared client state, pagination      | Add TanStack Query inside the React island                          |
| Deploy to a server                   | Add an adapter (`@astrojs/node`) — not needed for LLAAB             |

---

## Vault page pattern

All vault pages share the same three-part structure. Follow this template when adding new ones:

```astro
---
export const prerender = false;

import { listNodes } from '@llaab/core';
import type { MyNode } from '@llaab/schemas';
import AppLayout from '../../../layouts/AppLayout.astro';

// 1. Auth gate — always first
const COOKIE_NAME = 'vault_key';
const password = import.meta.env.VAULT_PASSWORD ?? 'llaab';
const cookie = Astro.cookies.get(COOKIE_NAME);
if (cookie?.value !== password) return Astro.redirect('/vault/login', 302);

// 2. Data — load directly via @llaab/core (no API hop needed)
const { id } = Astro.params;                        // for [id].astro pages
const all = await listNodes({ type: 'my-type' });
const node = (all as MyNode[]).find((n) => n.id === id);
if (!node) return Astro.redirect('/vault/my-type', 302);

// 3. Any derived data (e.g. linked nodes)
const related = await listNodes({ type: 'other' });
---

<AppLayout title={node.title}>
  <!-- render here -->
</AppLayout>
```

Key conventions:

- `export const prerender = false` — required on every vault page.
- Import `@llaab/core` directly in the frontmatter — no need to go via `@llaab/server` API.
- Auth gate redirects before any data loading.
- Detail pages redirect back to the list when the node is not found.
- All vault pages use `AppLayout` (sidebar + header shell).

---

## Calling the server from React islands — RPC

React islands call `@llaab/server` via the typed Hono RPC client in `src/lib/api.ts`. Never use
raw `fetch` against the server from a component.

```typescript
import { api } from '../lib/api';

// GET with query params
const res = await api.vault.nodes.$get({ query: { type: 'idea', limit: '20' } });
const json = await res.json();

// POST with JSON body
const res = await api.vault.nodes.$post({
  json: { type: 'idea', title: 'My idea', tags: ['d:llm'] },
});
const json = await res.json();
```

URL path segments become property accessors. Hyphens become camelCase:
`/api/vault/nodes` → `api.vault.nodes`. Methods: `.$get()`, `.$post()`.

TypeScript infers request/response shapes from `AppType` in `apps/server/src/app.ts`. See
`docs/astro/HONO_RPC.md` for the full guide including how to add new routes and the context
type helpers used in standalone handler functions.

---

## `client:only="react"` vs `client:load`

Components that use `@finografic/design-system` (e.g. `TagsInputDS`, `CreateIdeaPanel`) **must**
use `client:only="react"`, not `client:load`.

The linked DS package resolves its own React module instance. SSR runs two React copies
simultaneously, which causes a null dispatcher crash. `client:only` skips SSR entirely for
that component, avoiding the conflict.

```astro
<!-- correct — skips SSR for this island -->
<CreateIdeaPanel client:only="react" />

<!-- wrong — crashes with null dispatcher on SSR -->
<CreateIdeaPanel client:load />
```

All other React components (no DS deps) can use `client:load` normally.

---

## Gotcha: providers cannot wrap islands across the `.astro` boundary

**Symptom:** a React island that calls a context-dependent hook (`useQuery`, `useQueryClient`,
or any custom hook backed by `useContext`) throws at render time — e.g. `"No QueryClient set,
use QueryClientProvider to set one"` — and Astro silently drops the island from the page (no
`<astro-island>` placeholder is even emitted; it just isn't there).

**Cause:** this looks like ordinary React composition, but it isn't:

```astro
<!-- looks right, is broken -->
<QueryClientProvider client:load>
  <RunsTable runs={runs} sources={sources} />
</QueryClientProvider>
```

`.astro` template syntax is Astro's own templating language — it is compiled by Astro, not
React. When one framework component appears nested inside another in a `.astro` template,
Astro does **not** hand React a single `<Provider><Consumer /></Provider>` element to render
as one tree. It renders each framework component to an HTML string **independently**, then
splices the inner component's output into the outer one's `children` slot as static markup.
`RunsTable` therefore gets server-rendered with zero ancestors — no `QueryClientProvider`
anywhere above it — so `useQueryClient()` throws immediately, and the render of that subtree
is abandoned.

This is a direct consequence of how **islands work**: they're isolated by design (ship less
JS, hydrate independently), so React Context cannot cross an Astro template boundary between
two separately-declared framework components — no matter which `client:*` directive you pick,
and whether the failing render happens at SSR or build time.

**Fix:** keep the provider and its consumer in the _same_ React component tree by wrapping
**inside** the component file — never around it in the `.astro` template:

```tsx
// ✅ correct — provider + consumer in one React tree, mounted as a single island
export function RunsTable(props: RunsTableProps) {
  return (
    <QueryClientProvider>
      <RunsTableRoot {...props} />
    </QueryClientProvider>
  );
}

function RunsTableRoot({ runs: initialRuns, sources = [], showHeading = false }: RunsTableProps) {
  const { data: runs = initialRuns } = useRuns({ initialData: initialRuns });
  // ...
}
```

```astro
<!-- ✅ mount the self-wrapping component directly — no nesting in the template -->
<RunsTable client:load runs={runs} sources={sources} />
```

`providers/QueryClientProvider/QueryClientProvider.tsx` wraps a shared `queryClient` singleton,
so re-providing it from multiple islands is harmless — every island still reads from and
invalidates the same cache. Reference implementations, all wrapping themselves this exact way:
`forms/IngestForm/IngestForm.tsx`, `dialogs/CleanVaultDialog/CleanVaultDialog.tsx`,
`tables/RunsTable/RunsTable.tsx`, `components/VaultBrowser.tsx`, `forms/CreateIdeaPanel.tsx`.

**Rule of thumb:** if a component (or anything it renders) calls a hook backed by React
Context, that component must be the thing Astro mounts with `client:*`, and it must supply
its own context internally. Never rely on a `.astro`-level wrapper to provide context to a
nested island — it will not reach it.

---

## Vault routes

| URL                       | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `/vault`                  | Gated file-tree browser — raw markdown viewer                      |
| `/vault/login`            | Password form; default `llaab`, override via `VAULT_PASSWORD` env  |
| `/vault/transcripts`      | List: transcript cards with source_type badge, stats, idea count   |
| `/vault/transcripts/[id]` | Detail: source metadata, summary, extracted ideas, full transcript |
| `/vault/nodes`            | List + Create — ideas/resources/prompts/skills/instructions        |
| `/vault/nodes/[id]`       | Detail: type/status/date, tags, body, type-specific fields         |
| `/vault/sources`          | List: sources sorted alpha, followed badge, platform chips         |
| `/vault/sources/[id]`     | Detail: kind/follow/url/platforms, linked transcripts              |
| `/vault/runs`             | Table: runs with run_status badge, produced count, duration        |
| `/vault/runs/[id]`        | Detail: summary grid, stages table, decisions list, error block    |
| `/api/vault/auth`         | POST sets cookie, GET clears it — client-only auth                 |
