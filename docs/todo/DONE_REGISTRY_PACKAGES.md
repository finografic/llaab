# DONE — Registry: Pinned Packages

> **Status:** Complete (2026-06-28). All 6 phases shipped; readme renderer (Phase 2 extension) committed in third batch.

Add a "Registry" section to LLAAB for browsing and pinning npm packages. The UI mirrors npmx.dev (search → results list → package detail) with a Pin action on the detail page and a dedicated Pinned Packages list. The npmx.dev repo at `/Users/justin/repos-finografic-ref/npmx.dev` is used as a reference — TypeScript types and API endpoint logic are lifted directly; Vue components are used as structural blueprints and rewritten as React.

**Scope (v1 — packages only):** search, results list, package detail (readme + metadata sidebar), pin/unpin, pinned list.  
**Out of scope:** version distribution charts, file browser, compare, Algolia, provenance badges, i18n.

---

## Progress

- [x] Phase 1 — Types: `packages/schemas/src/npm-registry.ts`
- [x] Phase 2 — Server: npm proxy routes + pins CRUD + JSON store + readme renderer (marked+shiki+sanitize-html)
- [x] Phase 3 — Client: TanStack Query hooks
- [x] Phase 4 — Client: `PackageCard` component + `PackagePinsTable`
- [x] Phase 5 — Client: three route pages
- [x] Phase 6 — Router + nav wiring

---

## Phase 1 — Types

**File to create:** `packages/schemas/src/npm-registry.ts`

Lift from `/Users/justin/repos-finografic-ref/npmx.dev/shared/types/npm-registry.ts`:

- `NpmSearchPackage`, `NpmSearchResult`, `NpmSearchResponse` — search API shapes
- `PackageMetaResponse` — lightweight card/list metadata (name, version, description, keywords, license, date, links, author, weeklyDownloads)
- `NpmDownloadCount` — download point response
- `SlimPackument`, `SlimVersion` — detail page shapes (strip file-browser / provenance fields not needed in v1)

Add LLAAB-native type:

```ts
export interface PinnedPackage {
  name: string
  pinnedAt: string          // ISO timestamp
  meta: PackageMetaResponse // snapshot at pin time
}
```

**File to modify:** `packages/schemas/src/index.ts` — export from `npm-registry.ts`.

---

## Phase 2 — Server

**New folder:** `apps/server/src/routes/registry/`

### `registry-pins.store.ts`

Tiny JSON file store — raw `fs.readFile` / `writeFile` (follows `writer.utils.ts` pattern from `packages/core/src/storage/`). Pins file lives at `~/.llaab/pinned-packages.json` (configurable via `LLAAB_PACKAGE_PINS_PATH` env var).

```ts
// exports:
readPins(): Promise<PinnedPackage[]>
writePins(pins: PinnedPackage[]): Promise<void>
```

### `registry-npm.routes.ts`

Two routes — logic ported from `/Users/justin/repos-finografic-ref/npmx.dev/server/api/registry/package-meta/[...pkg].get.ts` and `app/composables/npm/useNpmSearch.ts`:

```
GET /npm/search?q=<query>&size=25&from=0
  → proxies https://registry.npmjs.org/-/v1/search
  → returns NpmSearchResponse (pass-through)

GET /npm/package/:name  (encoded; supports @scope/name)
  → fetches packument from https://registry.npmjs.org/<name>
  → fetches weekly downloads from https://api.npmjs.org/downloads/point/last-week/<name>
  → returns PackageMetaResponse + { readme: string | null }
```

### `registry-pins.routes.ts`

```
GET  /pins           → readPins() → PinnedPackage[]
POST /pins           → body: { name } → fetch meta → add → return PinnedPackage
DELETE /pins/:name   → remove by name → return { success: true }
```

### `registry.schema.ts`

```ts
export const pinBodySchema = z.object({ name: z.string().min(1) })
```

### `index.ts`

Wire all routes into `createRouter()`. Export `registryRouter`. No auth middleware (registry is public). Follow `apps/server/src/routes/llm/index.ts` pattern exactly.

**File to modify:** `apps/server/src/app.ts` — add `.route('/api/registry', registryRouter)` after `/api/runs`.

---

## Phase 3 — Client Query Hooks

**New folder:** `apps/client/src/queries/registry/`

Follow pattern in `apps/client/src/queries/vault/useVaultFile.ts` (private fetch fn above exported hook, `QUERY_KEYS` from `./index`).

| File                   | Hook(s)                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `index.ts`             | `REGISTRY_QUERY_KEYS`                                                                     |
| `useNpmSearch.ts`      | `useNpmSearch(query)` — enabled when `query.length > 0`, `staleTime: 60_000`              |
| `useNpmPackage.ts`     | `useNpmPackage(name)` — `staleTime: 5 * 60_000`                                           |
| `usePinnedPackages.ts` | `usePinnedPackages()`, `usePinPackage()`, `useUnpinPackage()`, `useIsPackagePinned(name)` |

Use 300 ms debounce at the call site (route level), not inside the hook.

---

## Phase 4 — Client Components

### `apps/client/src/components/PackageCard/PackageCard.tsx`

Renders a single npm search result / list card. Fields: name (bold mono, links to `/registry/package/:name`), description, version badge, license, weekly downloads, keywords tag row, publish date. Used in search results; pinned list uses `PackagePinsTable` instead.

### `apps/client/src/tables/PackagePinsTable/PackagePinsTable.tsx`

Copy `apps/client/src/tables/SourcesTable/SourcesTable.tsx` as template. Columns: Name (link to detail), Description, Version, License, Downloads, Pinned date, Unpin action (icon button). All cell renderers at module scope with explicit `CellContext<PinnedPackage, unknown>`.

---

## Phase 5 — Client Routes

### `apps/client/src/routes/registry-search.tsx`

- `PageLayout` + `PageHero` (eyebrow "Registry", title "Packages")
- Controlled search input → 300 ms debounce → `useNpmSearch(debouncedQuery)`
- Results: count + list of `<PackageCard>` items
- Empty/loading states
- Handle: `{ title: 'Package Registry' }`

### `apps/client/src/routes/registry-package.tsx`

- Param `:name` (URL-encoded; supports `@scope%2Fname`)
- `PageLayout` + `PageHero` (title = package name, back link to search)
- Two-column layout: left = readme rendered as markdown; right = metadata sidebar (version, license, downloads, deps, keywords, maintainers, repo link)
- Pin toggle in `PageHero` right slot — `BookmarkIcon` / `BookmarkCheckIcon` (Lucide); calls `usePinPackage` / `useUnpinPackage`
- Handle: `{ title: packageName }`

### `apps/client/src/routes/registry-pinned.tsx`

- `PageLayout` + `PageHero` (eyebrow "Registry", title "Pinned Packages", meta = count)
- `PageList` wrapping `PackagePinsTable`
- Handle: `{ title: 'Pinned Packages' }`

---

## Phase 6 — Router + Nav Wiring

### `apps/client/src/router.tsx`

Add three lazy imports and route entries inside `AppLayout` children:

```tsx
{ path: 'registry', element: lazyElement(RegistrySearchPage), handle: { title: 'Package Registry' } },
{ path: 'registry/pinned', element: lazyElement(RegistryPinnedPage), handle: { title: 'Pinned Packages' } },
{ path: 'registry/package/:name', element: lazyElement(RegistryPackagePage), handle: { title: 'Package' } },
```

### `apps/client/src/lib/nav-menu.config.ts`

Add Registry section (between Vault and Pipeline):

```ts
{
  id: 'registry',
  label: 'Registry',
  items: [
    { label: 'Packages', description: 'Search and browse npm packages', href: '/registry/packages', live: true },
    { label: 'Pinned', description: 'Your saved library collection', href: '/registry/pinned', live: true },
  ],
},
```

---

## Files Summary

### New files

| File                                                           | Notes                      |
| -------------------------------------------------------------- | -------------------------- |
| `packages/schemas/src/npm-registry.ts`                         | Lifted types from npmx.dev |
| `apps/server/src/routes/registry/registry-pins.store.ts`       | JSON file store            |
| `apps/server/src/routes/registry/registry-npm.routes.ts`       | npm proxy routes           |
| `apps/server/src/routes/registry/registry-pins.routes.ts`      | pins CRUD                  |
| `apps/server/src/routes/registry/registry.schema.ts`           | Zod schemas                |
| `apps/server/src/routes/registry/index.ts`                     | router wiring              |
| `apps/client/src/queries/registry/index.ts`                    | query keys                 |
| `apps/client/src/queries/registry/useNpmSearch.ts`             |                            |
| `apps/client/src/queries/registry/useNpmPackage.ts`            |                            |
| `apps/client/src/queries/registry/usePinnedPackages.ts`        |                            |
| `apps/client/src/components/PackageCard/PackageCard.tsx`       | + `.module.css`            |
| `apps/client/src/tables/PackagePinsTable/PackagePinsTable.tsx` | + `.module.css`            |
| `apps/client/src/routes/registry-search.tsx`                   | + `.module.css`            |
| `apps/client/src/routes/registry-package.tsx`                  | + `.module.css`            |
| `apps/client/src/routes/registry-pinned.tsx`                   | + `.module.css`            |

### Modified files

| File                                     | Change                                        |
| ---------------------------------------- | --------------------------------------------- |
| `packages/schemas/src/index.ts`          | export from `npm-registry.ts`                 |
| `apps/server/src/app.ts`                 | add `.route('/api/registry', registryRouter)` |
| `apps/client/src/router.tsx`             | add 3 lazy route entries                      |
| `apps/client/src/lib/nav-menu.config.ts` | add Registry section                          |

---

## Verification

1. `pnpm build` from repo root — no TypeScript errors
2. Start server + client; navigate to `/registry` — search input renders
3. Type "react" — `PackageCard` results appear with name, downloads, keywords
4. Click a card → detail page loads readme + metadata sidebar
5. Click Pin → bookmark icon toggles; `/registry/pinned` shows the pinned package
6. Unpin from pinned list → row disappears; detail page reverts to unpin state
7. Check `~/.llaab/pinned-packages.json` exists and contains correct JSON
