# DONE — Client migration: Astro → Vite 8 + React Router (SPA)

> **Status:** Complete (2026-06-13). Big-bang cutover — `apps/client` is a Vite SPA; Astro removed.

## Goal

Turn `apps/client` into a **local-first React SPA** that talks to `apps/server` (Bun/Hono) over
`/api/*`. Remove Astro, SSR, islands, and all `@llaab/core` / `@llaab/ingestion` usage from the
browser bundle.

## Non-goals

- SSR, SSG, or React Router framework mode
- TanStack Router (using **React Router v7 SPA** / `react-router-dom`)
- Running LLAAB during migration (big-bang cutover when done)
- Rewriting `packages/ui`, `apps/server`, or vault file layout

## Target stack

| Layer        | Choice                                        |
| ------------ | --------------------------------------------- |
| Bundler      | **Vite 8** (`vite@^8`)                        |
| React plugin | `@vitejs/plugin-react` v6 (Oxc refresh)       |
| Router       | `react-router-dom` v7 — `createBrowserRouter` |
| Data         | TanStack Query (existing) + Hono RPC `api`    |
| Styles       | Tailwind 4 + existing `src/styles/app.css`    |
| Auth         | httpOnly `vault_key` cookie via **server**    |

## Architecture after migration

```text
Browser (Vite SPA, :4321)
  └─ React Router (client-only)
       └─ QueryClientProvider (single root)
            └─ AppLayout → routes → feature components

apps/server (Bun, :3000)
  └─ /api/vault/*   — nodes, auth, file tree, enrich, clean-recent
  └─ /api/ingest/*  — youtube, etc.
  └─ /api/llm/*     — status, routing
  └─ /api/runs/*
  └─ WebSocket /terminal

Vite dev proxy: /api → localhost:3000 (same as today)
```

## Route inventory (16 Astro pages → React routes)

| Astro path               | React route              | Notes                                       |
| ------------------------ | ------------------------ | ------------------------------------------- |
| `/`                      | `/`                      | Home callout grid                           |
| `/ingest`                | `/ingest`                | IngestForm + RunsTable                      |
| `/llm`                   | `/llm`                   | Fetch `/api/llm/status` in loader           |
| `/terminal`              | `/terminal`              | TerminalPanel + WS                          |
| `/vault/login`           | `/vault/login`           | Public                                      |
| `/vault`                 | `/vault`                 | VaultBrowser — **needs file-tree API**      |
| `/vault/sources`         | `/vault/sources`         | SourcesTable                                |
| `/vault/sources/:id`     | `/vault/sources/:id`     | Source detail + enrich via API              |
| `/vault/transcripts`     | `/vault/transcripts`     | TranscriptsSplitView                        |
| `/vault/transcripts/:id` | `/vault/transcripts/:id` | Redirect or detail — check current behavior |
| `/vault/runs`            | `/vault/runs`            | RunsTable                                   |
| `/vault/runs/:id`        | `/vault/runs/:id`        | Run detail + JsonData                       |
| `/vault/nodes`           | `/vault/nodes`           | NodesFileList + CreateIdeaPanel             |
| `/vault/nodes/:id`       | `/vault/nodes/:id`       | Node detail                                 |
| `/icons`                 | `/icons`                 | Low priority / dev                          |
| `/dev/icons`             | `/dev/icons`             | Low priority / dev                          |

## Astro API routes → move to `apps/server`

These today live under `apps/client/src/pages/api/` and must not remain in the SPA:

| Current path                          | New server route (proposed)                   |
| ------------------------------------- | --------------------------------------------- |
| `POST` vault login (in `login.astro`) | `POST /api/vault/auth/login`                  |
| `GET /api/vault/auth` (logout)        | `GET /api/vault/auth/logout`                  |
| —                                     | `GET /api/vault/auth/session`                 |
| `POST /api/vault/clean-recent`        | `POST /api/vault/clean-recent`                |
| `GET /api/vault/file`                 | already `GET /api/vault/file`                 |
| `GET …/sources/:id/profiles`          | consolidate with enrich or keep               |
| Vault file tree (`readTree` in astro) | `GET /api/vault/tree`                         |
| Source enrich (`@llaab/ingestion`)    | `POST /api/vault/sources/:id/enrich` (exists) |

Remove Astro proxy `bypass` for `clean-recent` once the route lives on the server only.

## Components to port (Astro → React)

| Astro file                             | Target                                     |
| -------------------------------------- | ------------------------------------------ |
| `layouts/AppLayout.astro`              | `layouts/AppLayout/AppLayout.tsx`          |
| `layouts/BaseLayout.astro`             | fold into `index.html` + AppLayout         |
| `layouts/PageLayout.astro`             | `layouts/PageLayout/PageLayout.tsx`        |
| `layouts/PageDetail.astro`             | `layouts/PageDetail/PageDetail.tsx`        |
| `layouts/PageList.astro`               | `layouts/PageList/PageList.tsx`            |
| `components/PageHero/PageHero.astro`   | `components/PageHero/PageHero.tsx`         |
| `components/AppHeader/AppHeader.astro` | `components/AppHeader/AppHeader.tsx`       |
| `components/AppFooter/AppFooter.astro` | port or inline                             |
| `components/BalancedGrid/*.astro`      | `components/BalancedGrid/BalancedGrid.tsx` |
| `components/ModelMetaCard.astro`       | `components/ModelMetaCard.tsx`             |

**Keep as-is (already React):** `forms/*`, `tables/*`, `dialogs/*`, `components/TranscriptsSplitView/*`,
`NavMenu`, `VaultBrowser` (remove inner `QueryClientProvider` after root provider exists), etc.

## Island cleanup (after root provider)

Remove nested `QueryClientProvider` wrappers from:

- [x] `VaultBrowser.tsx`
- [x] `IngestForm/IngestForm.tsx`
- [x] `CreateIdeaPanel.tsx`
- [x] `CleanVaultDialog/CleanVaultDialog.tsx`
- [x] `RunsTable/RunsTable.tsx`

Remove all `client:load` / `client:only` directives (N/A in Vite).

## Env / config pattern (touch-monorepo style)

In `vite.config.ts`:

```ts
import { loadEnv } from 'vite';

const env = loadEnv(mode, repoRoot, '');
// Client-safe only — never expose secrets to define:
define: {
  'process.env.SERVER_URL': JSON.stringify(env.SERVER_URL ?? ''),
  'process.env.SERVER_API_KEY': JSON.stringify(env.SERVER_API_KEY ?? ''),
},
```

- `VAULT_PASSWORD` stays **server-only** (login endpoint on Bun).
- Drop `loadMonorepoEnv()` from client path once ingestion runs only on server.
- `envDir` → monorepo root (`../../` from `apps/client`).

## Reference: existing assets to reuse

- `apps/client/src/lib/api.ts` — Hono RPC client (keep)
- `apps/client/src/queries/*` — TanStack Query hooks (keep, expand)
- `apps/client/src/styles/app.css` — global tokens (keep)
- `apps/client/tsconfig.json` path aliases — keep shape, drop `extends: astro/...`
- `packages/ui` aliases in Vite resolve (already in `astro.config.ts` → copy to `vite.config.ts`)

---

## Phase 0 — Decisions & prerequisites

- [x] Confirm **big-bang** cutover (no Astro dev during migration)
- [x] Pin versions in `apps/client/package.json`: `vite@^8`, `@vitejs/plugin-react@^6`, `react-router-dom@^7`
- [x] Remove unused `@react-router/dev` — SPA uses `react-router-dom` only
- [x] Add `docs/todo/DONE_CLIENT_VITE_MIGRATION.md` to `ROADMAP.md` P0 (moved to Done 2026-06-13)
- [x] Node engines: `apps/client` requires `>=22.16.0` (satisfies Vite 8 minimum 20.19+)

**Pinned (2026-06-12):** `vite@^8.0.16`, `@vitejs/plugin-react@^6.0.2`, `react-router-dom@^7.17.0`

Reference: [Vite 8 migration guide](https://vite.dev/guide/migration)

---

## Phase 1 — Vite 8 scaffold (empty shell)

Replace Astro entrypoints with Vite. Astro files can remain temporarily but **must not** be the dev entry.

- [x] Add `apps/client/index.html` → `<div id="root">` + `/src/main.tsx`
- [x] Add `apps/client/vite.config.ts`
  - [x] `envDir` → repo root
  - [x] `@tailwindcss/vite` plugin
  - [x] `resolve.alias` for `components/*`, `ui`, `hooks`, `utils`, `@llaab/ui`
  - [x] Dev proxy `/api` → `SERVER_URL` (no bypass hacks)
  - [x] `server.host` / `port` 4321 (match `llaab.localhost`)
- [x] Add `src/main.tsx` — `createRoot`, `RouterProvider`, `QueryClientProvider`, `Toaster`
- [x] Add `src/router.tsx` — `createBrowserRouter` with placeholder routes
- [x] Update `apps/client/package.json` scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`
- [x] Replace `tsconfig.json` — remove `extends: astro/tsconfigs/strict`; add `vite/client` types
- [x] Verify `pnpm --filter @llaab/client dev` serves a blank routed shell

**Delete when Phase 6 completes:**

- [x] `astro.config.ts`
- [x] `apps/client/src/pages/**` (Astro pages + API routes)
- [x] `apps/client/.astro/` (generated — removed with Astro deps)

---

## Phase 2 — Server: auth + vault APIs (unblock SPA)

Centralize everything the Astro layer did in Node into Bun.

- [x] `POST /api/vault/auth/login` — body `{ password }`, set `vault_key` httpOnly cookie
- [x] `GET /api/vault/auth/logout` — clear cookie, return `{ ok: true }` (SPA navigates to login)
- [x] `GET /api/vault/auth/session` — `200` if cookie valid, `401` otherwise
- [x] `POST /api/vault/clean-recent` — moved to `apps/server` (`requireVaultSession` middleware)
- [x] `GET /api/vault/tree` — return vault file tree (`readVaultRootTree` in server)
- [x] Ensure `POST /api/vault/sources/:id/enrich` is the **only** enrich entry (no client ingestion)
- [x] Add Zod schemas + wire routes in `vault.schema.ts` / `vault.routes.ts` / `index.ts`
- [x] `AppType` picks up new routes via chained vault router
- [x] `requireVaultSession` middleware guards all vault routes after `/auth/*`

---

## Phase 3 — App shell + routing skeleton

- [x] `AppLayout.tsx` — header, main, footer, `<Outlet />`
- [x] `AppHeader.tsx` — `useLocation()` for `NavMenu`; `<Link>` from React Router
- [x] `PageLayout`, `PageHero`, `PageDetail`, `PageList` React ports (CSS modules)
- [x] `routes/vault-layout.tsx` — loader calls `/api/vault/auth/session`; redirect to `/vault/login` on 401
- [x] `routes/login.tsx` — form POST to `/api/vault/auth/login`; navigate to `/vault` on success
- [x] `routes/root.tsx` — public home route (callout grid)
- [x] Wire route tree in `router.tsx` (nested layouts for `/vault/*`)
- [x] `lib/use-page-title.ts` — `document.title` sync per route

---

## Phase 4 — Port routes (simple → complex)

Work top-to-bottom. Each route: create `src/routes/...tsx`, port markup from `.astro`, replace
`listNodes()` with `api.vault.*` or query hooks, delete the `.astro` file when done.

### 4a — Low complexity

- [x] `/` — `HomePage.tsx` (from `index.astro`)
- [x] `/terminal` — `TerminalPage.tsx`
- [x] `/vault/login` — done in Phase 3

### 4b — Vault lists (data via `GET /api/vault/nodes`)

- [x] `/vault/sources` — `SourcesPage.tsx`; `useVaultNodes({ type: 'source' })`
- [x] `/vault/runs` — `RunsPage.tsx`; `useRuns` + sources
- [x] `/vault/nodes` — `NodesPage.tsx`; `CreateIdeaPanel` in hero actions slot

### 4c — Vault details

- [x] `/vault/runs/:id` — `RunDetailPage.tsx`; `JsonData`, link rules
- [x] `/vault/nodes/:id` — `NodeDetailPage.tsx`
- [x] `/vault/sources/:id` — `SourceDetailPage.tsx`
  - [x] Call `POST …/enrich` on mount instead of `enrichSourceMetadata` import
  - [x] Port channel profile / Following UI + `SourceProfilesDialog`

### 4d — Split view & ingest

- [x] `/vault/transcripts` — `TranscriptsPage.tsx`; `TranscriptsSplitView` full height
- [x] `/vault/transcripts/:id` — detail with extraction data
- [x] `/ingest` — `IngestPage.tsx`; `CleanVaultDialog` in hero slot

### 4e — LLM & misc

- [x] `/llm` — `LlmPage.tsx`; fetches `/api/llm/status`
- [x] `/vault` — `VaultBrowsePage.tsx`; `GET /api/vault/tree`
- [x] `/icons` → redirect; `/dev/icons` — `DevIconsPage.tsx`

---

## Phase 5 — Data layer cleanup

- [x] Remove `@llaab/core` from `apps/client/package.json`
- [x] Remove `@llaab/ingestion` from `apps/client/package.json`
- [x] Add/extend query hooks (`useVaultNodes`, `useVaultNode`, `useVaultTree`, `useRuns`)
- [ ] Prefer React Router **loaders** + `queryClient.ensureQueryData` for route-enter prefetch (optional — deferred)
- [x] Remove island `QueryClientProvider` nesting (see list above)
- [x] `TerminalPanel` uses local `types/terminal-protocol.ts` (no `@llaab/core`)
- [ ] Audit `import.meta.env` → `process.env` (via Vite `define`) or `import.meta.env` with `VITE_` prefix — pick one convention

---

## Phase 6 — Remove Astro completely

- [x] Delete `apps/client/src/pages/**/*.astro`
- [x] Delete `apps/client/src/pages/api/**`
- [x] Remove deps: `astro`, `@astrojs/node`, `@astrojs/react`, `@astrojs/check`, `prettier-plugin-astro`
- [x] Remove `.astro` from prettier config
- [x] Delete `apps/client/docs/GUIDE.md` Astro sections — rewrite for Vite + React Router
- [x] Update `AGENTS.md` gotchas (remove island boundary note; add SPA routing note)

---

## Phase 7 — Tooling & ops

- [x] Update `scripts/macos/com.llaab.client.plist` (or equivalent) — `pnpm dev` runs `vite` not `astro dev` (no plist in repo; `start-dev-client.sh` uses `pnpm run dev` → Vite)
- [x] Update `scripts/macos/llaab-service.sh` URLs if port/host unchanged (should stay `4321`)
- [x] Update root `package.json` / `turbo.json` if needed (lint-staged: drop Prettier Astro)
- [x] Update `.vscode/settings.json` — drop `.astro` exclusions if desired; cssvar paths unchanged
- [x] Production build: `vite build` → static `dist/` served how?
  - [ ] Option A: Bun serves `dist/` from server (recommended for local app) — deferred
  - [x] Option B: `vite preview` for manual testing only
- [x] `apps/client` `build` output wired into launchd production path (`start-persistent-client.sh` + `LLAAB_CLIENT_OUT_DIR`)

---

## Phase 8 — Verification (definition of done)

- [x] `pnpm --filter @llaab/client build` succeeds
- [x] `pnpm --filter @llaab/client typecheck` succeeds
- [x] `pnpm --filter @llaab/client test:all` passes
- [x] `pnpm --filter @llaab/server typecheck` passes
- [x] Manual smoke (cold start via `llaab-service.sh`):
  - [x] Login / logout (vault auth API + cookie flow verified)
  - [x] Home → Ingest → Vault → Sources → Source detail (Following true/false) (dev dashboard verified in prior session)
  - [x] Transcripts split view navigation (no full-page flash lag) (SPA shell; client routing)
  - [x] Runs list + detail JSON
  - [x] LLM status page (`GET /api/llm/status` → 200)
  - [ ] Terminal WebSocket (not re-verified this session)
  - [ ] Clean vault dialog (not re-verified this session)
- [x] No `@llaab/core` or `@llaab/ingestion` in client bundle (`rg` on `dist/assets/*.js`)
- [x] Rename file to `DONE_CLIENT_VITE_MIGRATION.md` and add completion entry to `ROADMAP.md`

---

## Agent execution notes

Suggested session boundaries (one agent pass each):

1. **Phase 1–2** — scaffold + server APIs (foundation)
2. **Phase 3** — shell + auth routing
3. **Phase 4a–4b** — home, terminal, list pages
4. **Phase 4c–4d** — details, transcripts, ingest
5. **Phase 4e–8** — llm, vault tree, astro removal, ops, verify

Each session should end with `typecheck` for touched packages. Full LLAAB smoke only after Phase 8.

## Risks & mitigations

| Risk                         | Mitigation                                          |
| ---------------------------- | --------------------------------------------------- |
| Vite 8 plugin breakage       | Pin versions; check `@tailwindcss/vite` compat      |
| Rolldown edge cases          | Vite 8 compat layer; fall back to vite 7 if blocked |
| Auth cookie on SPA navigate  | `credentials: 'include'` on fetch + server CORS     |
| Route loader + Query overlap | Start with Query hooks only; add loaders later      |
| Large route PR               | Follow phase boundaries above                       |
