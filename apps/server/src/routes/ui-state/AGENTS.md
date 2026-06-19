# AGENTS.md — UI State Persistence

## What this is

A generic, project-local key/value store for **UI state that should survive a reload or app
restart but isn't vault content** — filter selections, panel open/closed, last-picked tab, sort
order, etc. Think of `configs/ui-state.json` as an XDG-style config file, just scoped to this
project instead of `~/.config` — same idea (small, human-readable, git-ignorable settings store),
different location.

**Do not use this for:**

- Vault content (transcripts, ideas, runs, sources) — those are nodes in `vault/`.
- Anything the server's business logic depends on — this store is UI-only and has no schema
  enforcement beyond "JSON-serializable."
- Secrets or anything sensitive — `configs/ui-state.json` is a plain-text file on disk.

## Storage

`ui-state.store.ts` reads/writes `configs/ui-state.json`, a flat `Record<string, unknown>`. Same
lazy-write pattern as `configs/llm-routing.json` (`packages/llm/src/router.ts`) and
`configs/cron-recipes.json` (`apps/server/src/routes/crons/cron-recipes.ts`): the file doesn't
exist until the first write, `getUiState(key)` returns `null` for a missing key instead of
throwing, and `setUiState(key, value)` does a full read-modify-write (fine at this scale — this
file holds small UI preferences, not high-frequency or high-volume data).

## API

| Route                    | Behavior                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| `GET /api/ui-state/:key` | Returns `{ key, value }`. `value` is `null` if nothing was ever saved. |
| `PUT /api/ui-state/:key` | Body `{ value: unknown }`. Persists and returns `{ key, value }`.      |

There is one generic route pair for every key — adding a new persisted setting **never** needs a
new server route. The `key` is just a string used as a JSON object property (e.g.
`"transcripts.authorFilter"`); namespacing by dot-prefix (`<feature>.<setting>`) is a convention,
not enforced, so unrelated features don't collide on a name like `"filter"`.

## Client usage

`apps/client/src/queries/ui-state/useUiState.ts` exports `usePersistedUiState<T>(key, defaultValue)`:

```tsx
const { value: selectedAuthors, setValue: setSelectedAuthors } = usePersistedUiState<string[]>(
  'transcripts.authorFilter',
  [],
);
```

- `value` is `defaultValue` until the `GET` resolves, then whatever was last saved (or still
  `defaultValue` if nothing was ever saved).
- `setValue(next)` fires a `PUT` and updates the TanStack Query cache on success — no manual
  `invalidateQueries` needed since the mutation writes the new value straight into the cache.
- This is a thin TanStack Query wrapper, not a global store — each call site owns its own `key`
  and `defaultValue`. There's no central registry of "all persisted UI keys"; grep for
  `usePersistedUiState(` to find current consumers.

First (and reference) consumer: `AuthorFilter` in
`apps/client/src/components/TranscriptsSplitView/components/AuthorFilter.tsx`, wired through
`TranscriptsSidebar.tsx` via the `'transcripts.authorFilter'` key.

## Adding a new persisted setting

1. Pick a stable, namespaced key: `<feature>.<setting>` (e.g. `'crons.lastViewedTab'`).
2. Call `usePersistedUiState<YourType>(key, defaultValue)` wherever the setting is read/written.
   No server change needed — the generic `:key` routes handle it.
3. If the value needs to be read from a _different_ component than the one that sets it, both
   call sites just use the same `key` — TanStack Query's cache keeps them in sync without any
   extra wiring (same pattern as any other shared query key).
