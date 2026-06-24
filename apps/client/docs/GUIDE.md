# LLAAB Client — Vite + React Router Guide

> Quick reference for the `apps/client` SPA after the Astro migration (2026-06-12).

## Stack

| Layer   | Choice                                   |
| ------- | ---------------------------------------- |
| Bundler | Vite 8                                   |
| UI      | React 19 + shadcn (`packages/ui`)        |
| Router  | React Router v7 (`createBrowserRouter`)  |
| Data    | TanStack Query + Hono RPC (`lib/api.ts`) |
| Styles  | Tailwind 4 + `src/styles/app.css` tokens |

## Project layout

```text
apps/client/
  index.html              # SPA shell
  vite.config.ts          # aliases, /api proxy, envDir → repo root
  src/
    main.tsx              # QueryClientProvider + RouterProvider + Toaster
    router.tsx            # route tree
    routes/               # page components (one file per route)
    layouts/              # AppLayout, PageLayout, PageDetail, PageList
    components/           # shared UI (NavMenu, VaultBrowser, …)
    forms/  dialogs/  tables/   # feature modules
    queries/              # TanStack Query hooks
    lib/api.ts            # typed Hono client
```

## Adding a route

1. Create `src/routes/my-page.tsx` using `PageLayout` / `PageHero` as needed.
2. Register in `src/router.tsx` with optional `handle: { title: '…' }` for the app header.
3. For vault routes, nest under the `VaultLayout` branch (session loader redirects to login).

## Route left sidebars

`AppLayout` owns the physical app sidebars. Routes that need a left sidebar should inject their
sidebar content into the global shell with `useAppLeftSidebar`, instead of creating a nested local
split layout.

```tsx
import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useMemo } from 'react';

export function MyRoute() {
  const sidebar = useMemo(
    () => ({
      id: 'my-route',
      content: <MyRouteSidebar />,
      defaultOpen: true,
      minWidth: '420px',
      maxWidth: '560px',
      defaultWidth: '480px',
    }),
    [],
  );

  useAppLeftSidebar(sidebar);

  return <MyRouteDetail />;
}
```

The left-sidebar toggle in the secondary action bar only appears while the current route has
registered sidebar content. `AppLayout` handles resize, collapse, default-open behavior, and cleanup
when the route unmounts. `/vault/transcripts` is the reference implementation: its transcript list is
registered as route-owned left-sidebar content while the transcript detail remains the route body.

## Data fetching

Use query hooks under `queries/*` — never import `@llaab/core` or `@llaab/ingestion` in the
client bundle. Vault lists use `useVaultNodes({ type: 'source' })`; mutations call `api.vault.*`
with `credentials: 'include'` (configured in `lib/api.ts` and `lib/api-client.ts`).

## LLM provider routing

`/llm` edits persisted task routing from `configs/llm-routing.json`. The route displays
provider-qualified model options so similarly named models stay distinct:

- `(Ollama) <model>` from Ollama on `:11434`
- `(LM Studio) <model>` from LM Studio's OpenAI-compatible server on `:1234`
- `(Anthropic) <model>` for remote routes

The provider prefix is muted in the select label. Saving a task route persists both `provider` and
`model`; server-side `routeLlm(...)` dispatches to the selected provider. LM Studio uses
`LLAAB_LMSTUDIO_BASE_URL` when set, otherwise `http://localhost:1234/v1`.

## Vault auth

- Login: `POST /api/vault/auth/login` → httpOnly `vault_key` cookie (server only).
- Session: `GET /api/vault/auth/session` — used by `vaultSessionLoader` on `/vault/*`.
- Logout: `GET /api/vault/auth/logout`.

## Dev vs production

| Mode       | Client URL                    | API                           |
| ---------- | ----------------------------- | ----------------------------- |
| `pnpm dev` | `http://127.0.0.1:3000`       | Vite proxy → `:8888`          |
| launchd    | `http://llaab.localhost:3000` | `vite dev` or preview + proxy |

Run server separately: `pnpm --filter @llaab/server dev`.

## Styling

- **CSS modules:** `import styles from './Foo.module.css'` — access as `styles.className`.
- **Global detail utilities:** `styles/page-detail.css` (`.section`, `.meta-grid`, `.badge`, …).
- **Tokens:** shadcn CSS vars + LLAAB tokens in `styles/app.css`.

## Common pitfalls

| Symptom                     | Fix                                                     |
| --------------------------- | ------------------------------------------------------- |
| API 401 on vault pages      | Log in at `/vault/login`; check cookie + server running |
| QueryClient error           | Ensure component is under root provider in `main.tsx`   |
| Alias not resolving in Vite | Add to `vite.config.ts` **and** `tsconfig.json` paths   |
| OAuth / env vars missing    | `.env` at repo root; restart server after changes       |

See also: [`docs/todo/DONE_CLIENT_VITE_MIGRATION.md`](../../docs/todo/DONE_CLIENT_VITE_MIGRATION.md).
