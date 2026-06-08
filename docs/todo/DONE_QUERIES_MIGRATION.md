# DONE — `queries/<domain>` Pattern Migration

> **Completed:** 2026-06-08 — `apps/client` now reads and mutates vault data through
> TanStack Query hooks grouped by domain under `src/queries/`; the old
> `lib/runs-events` event bus and manual `useState`+`useEffect` fetch dances are gone.

---

## Why

Cross-component refresh (e.g. "a run finished — refresh the runs table") was wired
through a hand-rolled event bus (`lib/runs-events` → `dispatchRunsChanged` /
`lib/use-runs` → `useRunsChanged`). Every consumer needed its own `useState` +
`useEffect` fetch/refetch dance, and invalidation was a string-matched custom event
with no type safety against the actual data it was meant to refresh.

`@tanstack/react-query` was already a dependency but unwired. Centralizing fetches
behind `queries/<domain>` hooks with a shared `QUERY_KEYS` map gives predictable,
type-checked invalidation from anywhere in the tree — declared once, next to the
mutation that causes it.

---

## What changed

### Provider — shared singleton `QueryClient`

`src/providers/QueryClientProvider/`:

- `queryClient.ts` — one `QueryClient` created at module scope (not per-component
  `useState(() => new QueryClient())`), so every Astro island shares one cache.
  Astro mounts each `client:load`/`client:only` component as an independent React
  root — a per-instance client would mean a mutation in `IngestForm` could never
  invalidate a query read by `RunsTable`.
- `QueryClientProvider.tsx` — thin wrapper around TanStack's provider, nested
  directly around each island root in the `.astro` page (only the wrapper carries
  the `client:*` directive):

  ```astro
  <QueryClientProvider client:only="react">
    <IngestForm />
  </QueryClientProvider>
  ```

### Query domains — `src/queries/<domain>/`

Each domain is a barrel (`index.ts`) exporting `QUERY_KEYS.<domain>` plus typed
query/mutation hooks, calling `api.*` (the typed Hono RPC client) directly — no
hand-written `endpoints/` layer, since `lib/api` already derives request/response
shapes from the server's route definitions.

- **`runs/`** — `useRuns` (list, with `initialData`/`enabled`), `useDeleteRun`
  (mutation, invalidates `runs.list`)
- **`transcripts/`** — `useTranscriptIdeas`, `useExtractTranscript`,
  `useDiscardTranscript`, `useIngestYoutube` (mutations invalidate
  `transcripts.ideas`/`runs.list` as appropriate)
- **`nodes/`** — `useCreateIdea`, `useNodeTags`, `useVaultTagsByUsage`
- **`vault/`** — `useVaultFile`, `useVaultClean` (invalidates `runs.list`)

Raw fetchers used both by a query hook and by a sibling mutation (e.g.
`fetchExistingIdeas`, `fetchNodeTags`) are exported from the hook module that owns
the query key, mirroring the plan doc's `useTranscriptIdeas`/`useExtractTranscript`
example.

### Migrated consumers

- [x] `tables/RunsTable` + `components/DeleteRunAction` → `queries/runs`
- [x] `dialogs/CleanVaultDialog` → `queries/runs` (conditional fetch via
      `enabled: open`) + `queries/vault`
- [x] `forms/CreateIdeaPanel` → `queries/nodes`
- [x] `components/VaultBrowser` → `queries/vault`
- [x] `forms/IngestForm` → `queries/transcripts` + `queries/nodes`; the
      multi-phase ingest/extract/discard pipeline now drives its phase-machine UI
      state from `mutateAsync` results instead of raw `api.*` calls, and relies on
      each mutation's `onSuccess`/`onSettled` to invalidate the runs/ideas/tags
      caches in place of `dispatchRunsChanged()`

### Islands wrapped in `QueryClientProvider`

`pages/ingest.astro`, `pages/vault/index.astro`, `pages/vault/runs/index.astro`,
`pages/vault/nodes/index.astro` — one wrapper per island root that reads or
mutates query state. `TranscriptsTable` and `NodesFileList` don't touch
`queries/*` (yet), so their pages were left unwrapped.

### Removed

- [x] `lib/runs-events.ts` (`RUNS_CHANGED_EVENT`/`dispatchRunsChanged`)
- [x] `lib/use-runs.ts` (`useRuns` event-bus hook — superseded by
      `queries/runs/useRuns`)

---

## Deviations from the original plan

- No `useTranscript`/`useNode`/`useTranscripts`/`useNodes` list/detail hooks were
  added — nothing in the client currently needs them; add when a real consumer
  shows up rather than speculatively.
- `useIngestYoutube` (in `queries/transcripts/`) wasn't in the original domain
  sketch — added because `IngestForm`'s ingest call needed a mutation hook with
  the same `runs.list` invalidation as the rest of the pipeline.
