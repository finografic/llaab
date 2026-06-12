# TODO — Library Watch

> **Status:** Not started. P3 backlog — implement after Terminal Panel.
> Replaces the manual Obsidian workflow for tracking library choices and ecosystem state.

---

## What this is

A `/vault/packages` page where you track npm packages, frameworks, Homebrew tools, and other
ecosystem dependencies. Each entry is a `PackageNode` — a vault node that stores stats, metadata,
and a `follow` flag. Followed packages auto-refresh on `lab agent run`.

---

## Source material — npmx.dev

`/Users/justin/repos-finografic/npmx.dev` has directly portable logic (Nuxt/Vue stripped):

| Source file                       | What to port                                               | Notes                                        |
| --------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `app/utils/npm/api.ts`            | Download + version fetch functions                         | Strip `useNuxtApp()`, use `fetch`            |
| `shared/types/npm-registry.ts`    | `PackageMetaResponse`, `NpmDownloadCount`, `SlimPackument` | Convert to TS interfaces in `@llaab/schemas` |
| `app/components/Package/Card.vue` | Card layout: name, downloads, deps, badges                 | Re-implement as React                        |

`PackageMetaResponse` (already in npmx.dev) maps directly to `PackageNode` stored fields —
no invention needed, just a schema and a fetch wrapper.

---

## `PackageNode` schema

New node type in `packages/schemas/src/package-node.schema.ts`:

```ts
PackageNodeSchema = BaseNodeSchema.extend({
  type: z.literal("package"),
  ecosystem: z.enum(["npm", "brew", "pip", "cargo", "gem"]),
  packageName: z.string(), // e.g. "citty", "@clack/prompts"
  version: z.string().optional(), // latest version
  description: z.string().optional(),
  license: z.string().optional(),
  weeklyDownloads: z.number().int().optional(),
  dependencyCount: z.number().int().optional(),
  installSize: z.number().int().optional(), // bytes (unpackedSize from dist)
  lastPublished: z.string().optional(), // ISO date of latest version
  homepage: z.string().url().optional(),
  repository: z.string().optional(),
  follow: z.boolean().default(false),
  // npm-specific
  isEsm: z.boolean().optional(), // type === 'module'
  hasTypes: z.boolean().optional(), // @types/* or types field present
  vulnerabilities: z.number().int().optional(), // 0 = clean
});
```

---

## Data sources (all public, no auth)

### npm

```
Registry:  https://registry.npmjs.org/<pkg>
Downloads: https://api.npmjs.org/downloads/point/last-week/<pkg>
```

Returns `PackageMetaResponse`-shaped data. See npmx.dev types for exact field mapping.
Notable: use `time[version]` for last-published — **not** `time.modified` (misleading,
updates on maintainer changes without a new publish).

### Homebrew

```
https://formulae.brew.sh/api/formula/<name>.json
```

Fields: `name`, `desc`, `homepage`, `versions.stable`, `installed` (dep count),
`ruby_source_sha256` (integrity). Downloads via `analytics.installs.30d`.

### pip / cargo / gem

All have equivalent open JSON APIs — add as ecosystem support grows.

---

## Skills

### `addPackageNode(input)` — new skill in `@llaab/skills`

```ts
input: { packageName: string; ecosystem: 'npm' | 'brew' | ...; tags?: string[] }
```

1. Fetch metadata from the appropriate registry API
2. Create a `PackageNode` with `follow: false` (user opts in)
3. Return `{ id, path, node }`

### `refreshPackageStats(node)` — agent loop skill

```ts
input: {
  package: PackageNode;
}
```

1. Re-fetch stats for the package
2. Update the node's `weeklyDownloads`, `version`, `lastPublished`, `vulnerabilities`
3. Uses `updateNode()` — doesn't recreate, just patches stats fields

Agent loop registry entry (one line):

```ts
{
  nodeType: 'package',
  skill: 'refresh-package-stats',
  execute: (node) => refreshPackageStats({ package: node as PackageNode }),
  filter: (node) => (node as PackageNode).follow === true,
}
```

---

## Fetch layer — port from npmx.dev

New file: `packages/skills/src/fetch/npm.ts`

Strip the Nuxt wrappers (`useNuxtApp`, `$npmApi`) from `app/utils/npm/api.ts` and replace with
plain `fetch`. Encode scoped package names (`@scope/pkg` → `@scope%2Fpkg`). Add basic error
handling for 404 (package not found) and 429 (rate limit).

```ts
export async function fetchNpmMeta(
  packageName: string,
): Promise<PackageMetaResponse>;
export async function fetchNpmWeeklyDownloads(
  packageName: string,
): Promise<number>;
export async function fetchBrewMeta(
  formulaName: string,
): Promise<BrewMetaResponse>;
```

---

## Server routes

| Method | Path                        | Description                                                  |
| ------ | --------------------------- | ------------------------------------------------------------ |
| POST   | `/api/packages`             | Add a package — calls `addPackageNode`                       |
| GET    | `/api/packages`             | List `PackageNode`s — wraps `listNodes({ type: 'package' })` |
| PATCH  | `/api/packages/:id/follow`  | Toggle `follow` flag                                         |
| POST   | `/api/packages/:id/refresh` | Force-refresh stats for one package                          |

---

## UI — `/vault/packages`

Card layout (visual reference: `Package/Card.vue` in npmx.dev):

```
┌─────────────────────────────────────────────────┐
│ npm   citty                          v0.2.2  ↺  │
│ Elegant CLI Builder                             │
│ ─────────────────────────────────────────────── │
│ 20.4M / week   0 deps   34.6 kB   MIT           │
│ Apr 1, 2026                         [following] │
└─────────────────────────────────────────────────┘
```

- Ecosystem badge (npm / brew / pip / cargo)
- Weekly downloads with abbreviated formatting (20.4M, 1.2K)
- Dep count, install size, license
- Last published date
- Follow toggle (calls `PATCH /api/packages/:id/follow`)
- Overflow menu: force refresh, open npm page, remove

Filter bar: by ecosystem, by follow status.

Add panel: package name input + ecosystem selector → calls `POST /api/packages`.

---

## Implementation phases

### Phase 1 — Schema + fetch layer

- [ ] `packages/schemas/src/package-node.schema.ts` — `PackageNode` + export from index
- [ ] `packages/skills/src/fetch/npm.ts` — ported from npmx.dev, plain `fetch`
- [ ] `packages/skills/src/fetch/brew.ts` — Homebrew formulae API

### Phase 2 — Skills + agent loop

- [ ] `packages/skills/src/add-package.ts` — `addPackageNode` skill
- [ ] `packages/skills/src/refresh-package-stats.ts` — `refreshPackageStats` skill
- [ ] Add `package` route to `@llaab/skills/src/agent/registry.ts`

### Phase 3 — Server routes

- [ ] `apps/server/src/routes/packages/` — CRUD + follow toggle + refresh endpoint
- [ ] Wire into `apps/server/src/app.ts`

### Phase 4 — UI

- [ ] `apps/client/src/routes/vault-packages.tsx` — page shell
- [ ] `PackageCard` React component (reference: npmx.dev `Package/Card.vue`)
- [ ] `AddPackagePanel` React component — ecosystem selector + name input
- [ ] Follow toggle wired to `PATCH /api/packages/:id/follow`

---

## Notes

- `follow: false` by default — you opt packages in explicitly, not a firehose
- Stats refresh is cheap (two small JSON fetches per package) — safe to run on every `lab agent run`
- No always-on background refresh — follows the project-wide agent execution rule
- Vulnerability count via npm audit API is optional and can be Phase 5 if needed
