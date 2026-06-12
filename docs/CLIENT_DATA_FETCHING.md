# Client data fetching — Vite SPA

How `@llaab/client` loads vault and pipeline data after the Astro → Vite migration.

---

## Architecture

```text
Browser (Vite SPA, :3000)
  └─ React Router
       └─ QueryClientProvider (single root in main.tsx)
            └─ routes → TanStack Query hooks → api.* (Hono RPC)

apps/server (Bun, :8888)
  └─ /api/vault/*, /api/ingest/*, /api/runs/*, /api/llm/*, …

Vite dev/preview proxy: /api and /terminal → LLAAB_API_URL (default http://127.0.0.1:8888)
```

All vault I/O goes through the server API. The client bundle does **not** import
`@llaab/core` or `@llaab/ingestion`.

---

## Typed API client

Use `api` from `lib/api.ts` (Hono RPC). Full route guide: [`docs/server/HONO_RPC.md`](./server/HONO_RPC.md).

```tsx
import { api } from 'lib/api';

const res = await api.vault.nodes.$get({ query: { type: 'source' } });
const { nodes } = await res.json();
```

Prefer domain hooks in `src/queries/<domain>/` so components share cache and invalidation.

---

## TanStack Query hooks

Hooks live under `apps/client/src/queries/` grouped by domain (`runs`, `transcripts`, `nodes`, `vault`).
Each barrel exports `QUERY_KEYS.<domain>` plus typed query/mutation hooks that call `api.*` directly.

| Hook / pattern            | Use for                                     |
| ------------------------- | ------------------------------------------- |
| `useVaultNodes({ type })` | List pages (sources, runs table sources, …) |
| `useVaultNode(id)`        | Detail pages                                |
| `useRuns()`               | Runs table — no `initialData` from SSR      |
| `useVaultTree()`          | `/vault` file browser                       |
| Mutation `onSuccess`      | `invalidateQueries` on related `QUERY_KEYS` |

Plain `fetch` + `useState` is fine for one-off forms. Query adds value when multiple components
share server state, mutations need invalidation, or background refetch matters.

---

## Vault auth

When `VAULT_PASSWORD` is set on the server, gated routes use `vaultSessionLoader` in
`router.tsx` — it calls `GET /api/vault/auth/session` and redirects to `/vault/login` on 401.
When `VAULT_PASSWORD` is unset or empty, vault routes are open (local dev default).

Login: `POST /api/vault/auth/login` with `{ password }` sets an httpOnly `vault_key` cookie.
Logout: `GET /api/vault/auth/logout`.

All `api` requests use `credentials: 'include'`.

---

## Vault page pattern

List routes (`PageList` + table or file list):

1. Route component calls `useVaultNodes({ type: '…' })` or a domain-specific hook.
2. Wrap content in `PageLayout` + `PageHero`.
3. Pass fetched data into table wrappers under `src/tables/`.

Detail routes (`PageDetail`):

1. Read `:id` from `useParams()`.
2. `useVaultNode(id)` or a typed detail hook; show loading / not-found states.
3. Mutations (enrich, extract, delete) call `api.*` via mutation hooks and invalidate queries.

Example — ingest runs table links authors to sources:

```tsx
const { data: sourceNodes = [] } = useVaultNodes({ type: 'source' });
return <RunsTable sources={sourceNodes} showHeading />;
```

`RunsTable` builds `sourcesById` and renders follow icons + `/vault/sources/:id` links when the
source node loads from the API (requires valid vault frontmatter — see `@llaab/core` YAML parser).

---

## Quick reference

| Goal                      | Approach                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Read vault nodes          | `useVaultNodes` / `useVaultNode` → `api.vault.nodes`        |
| Ingest / extract          | Mutation hooks → `api.ingest.*`, `api.vault.*`              |
| Runs list                 | `useRuns()` in `RunsTable` (single hook, no SSR seed)       |
| File tree browser         | `useVaultTree()` → `GET /api/vault/tree`                    |
| Add a new server endpoint | Server route + `AppType`; then hook or direct `api.*`       |
| Cross-tab live sync       | Not implemented — see `docs/todo/TODO_CROSS_ISLAND_SYNC.md` |

---

## Env and secrets

- Client code uses **same-origin** `/api/*` — no API key in the browser bundle.
- `LLAAB_API_URL` is **vite.config-only** (dev/preview proxy target).
- `LLAAB_API_KEY`, `VAULT_PASSWORD`, OAuth/LLM keys are server-only.
- Use `VITE_*` only when a value must appear in the client bundle.
