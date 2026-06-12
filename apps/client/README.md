# @llaab/client

Local-first React SPA for LLAAB — Vite 8 + React Router v7.

## Commands

| Command          | Action                         |
| ---------------- | ------------------------------ |
| `pnpm dev`       | Vite dev server on `:4321`     |
| `pnpm build`     | Production bundle → `dist/`    |
| `pnpm preview`   | Serve `dist/` (proxies `/api`) |
| `pnpm typecheck` | TypeScript check               |

## Architecture

- **Entry:** `index.html` → `src/main.tsx`
- **Routes:** `src/router.tsx` (`createBrowserRouter`)
- **Data:** TanStack Query + Hono RPC (`lib/api.ts`)
- **API proxy:** Vite dev/preview forwards `/api/*` → `apps/server` (`SERVER_URL`)

## Path aliases

Same tsconfig aliases as before (`components/*`, `forms/*`, `lib/*`, …). Vite resolves them in
`vite.config.ts`.

## Persistent client (launchd)

`scripts/macos/start-persistent-client.sh` builds with `LLAAB_CLIENT_OUT_DIR`, then runs
`vite preview` against the staged `dist/` output.
