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

`packages/web/astro.config.ts` has no `output` key, which means the default `'static'` is active. This is intentional — LLAAB is a local dev tool only; no deployment adapter is needed.

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

## Routes added

| URL                     | What it does                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| `/vault`                | Gated browser — redirects to `/vault/login` if no cookie                   |
| `/vault/login`          | Password form (default: `llaab`; override with `VAULT_PASSWORD` in `.env`) |
| `/api/vault/auth`       | `POST` sets cookie and redirects to `/vault`; `GET` clears cookie (logout) |
| `/api/vault/file?path=` | Raw file content; path validated to stay under `vault/`                    |

**Layout:** Full-height shell with top bar, left tree sidebar (260px), and right content panel. Top-level vault folders start expanded. Choosing a file fetches and shows its raw text. `.tmp`, dotfiles, and `.gitkeep` are hidden.

---

### Design system note

The DS project holds the standards, but the web package does not yet have Panda CSS config or generated styled-system output. DS components import `@styled-system/css` and `@styled-system/jsx`, which are not resolvable in `packages/web` today. Wiring that up (`panda.config`, codegen, CSS imports in the Astro layout) is a focused one-session task; after that, DS components should work in the app.
