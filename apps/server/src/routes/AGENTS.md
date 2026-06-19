# AGENTS.md — Server Routes

`apps/server/src/routes/` holds every HTTP route group, each mounted in `apps/server/src/app.ts`
under its own `/api/<group>` prefix:

| Prefix          | Router          | Folder      |
| --------------- | --------------- | ----------- |
| `/api/agent`    | `agentRouter`   | `agent/`    |
| `/api/crons`    | `cronsRouter`   | `crons/`    |
| `/api/ingest`   | `ingestRouter`  | `ingest/`   |
| `/api/llm`      | `llmRouter`     | `llm/`      |
| `/api/vault`    | `vaultRouter`   | `vault/`    |
| `/api/runs`     | `runsRouter`    | `runs/`     |
| `/api/ui-state` | `uiStateRouter` | `ui-state/` |

Each group folder follows the same shape: `*.schema.ts` (Zod request/query schemas),
`*.routes.ts` (`{ path, handler }` exports with semantic names), and `index.ts` (router wiring
only — chains `routes.*` onto `createRouter()`, no business logic). `vault/` is the one group
split across multiple `vault-*.routes.ts` files by domain — see `vault/AGENTS.md` for that file
map and the checklist for adding a new vault domain file.

This doc gives a one-paragraph orientation per group. It does not replace reading the route file
itself — go to the source for request/response shapes.

---

## Crons (`crons/`)

LLAAB does not own a scheduler — see
`.github/instructions/project/agent-execution.instructions.md` (no always-on background
processes, file watchers, or polling loops; one-shot trigger → run → exit only). The `crons`
route group is the explicit, one-shot execution surface for recipes that _would_ otherwise be
cron jobs: each recipe is a typed function that scans vault state, does bounded work, and exits.
Timing is owned entirely by something outside LLAAB — OS `cron`, macOS `launchd`, a GitHub Actions
schedule, Vercel Cron, or a manual click on `/crons` or `cron.run <id>` in `/terminal`.

Full design background: `docs/todo/DONE_CRONS_PAGE.md`.

### Files

| File              | Role                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cron-recipes.ts` | `CronRecipe` registry (`CRON_RECIPES`), enabled/disabled state, the shared consolidation-scan handler, and `runCronRecipe(id)` — the entry point |
| `crons.routes.ts` | `list` (`GET /`), `run` (`POST /:id/run`), and `update` (`PATCH /:id`) route exports                                                             |
| `crons.schema.ts` | `updateCronRecipeBodySchema` — `{ enabled: boolean }`                                                                                            |
| `index.ts`        | Wires the three routes onto `createRouter()`, validating `update`'s body — no business logic                                                     |

### Recipe registry

`CRON_RECIPES: CronRecipe[]` in `cron-recipes.ts` is the single source of truth for what `/crons`
and `cron.run` can discover and run. Each entry is metadata only:

```ts
interface CronRecipe {
  id: string;                 // stable — becomes the URL segment and terminal command id
  title: string;
  description: string;
  command: string;            // e.g. 'cron.run check-transcripts-consolidation'
  risk: 'low' | 'medium' | 'high';
  scheduleExamples: Array<{ label: string; value: string }>;  // launchd/cron snippets shown in the UI
}
```

`GET /api/crons` returns `listCronRecipesWithState()` — the registry merged with each recipe's
`enabled` flag (see Enable/disable below) — as `{ recipes }`. There is no per-recipe route for
`run` or `update` — both are generic: they look up the recipe by id and call `runCronRecipe(id)` /
`setCronRecipeEnabled(id, enabled)`. Adding a recipe to the array is enough to make it runnable
and toggleable over HTTP; no router change needed.

### Enable/disable

LLAAB has no visibility into whether an external scheduler (cron/launchd/GitHub Actions) is
actually configured to hit a recipe, so there's no "currently scheduled" indicator — see the
design note at the top of this section. What it _can_ offer is a kill-switch: each recipe has a
persisted `enabled` boolean (default `true`), stored in `configs/cron-recipes.json`
(`{ recipes: { [id]: { enabled } } }`, written lazily on first toggle — same pattern as
`configs/llm-routing.json` in `packages/llm/src/router.ts`). `PATCH /api/crons/:id` with
`{ enabled }` flips it; `runCronRecipe(id)` checks `isCronRecipeEnabled(id)` first and throws
before doing any work (no `RunNode` is created) if disabled. Disabling a recipe in `/crons`
therefore actually blocks it — Run Now, `cron.run <id>`, and any external `curl` hitting
`POST /api/crons/:id/run` all go through the same gate. The `/crons` UI shows this as a toggle
button (active/disabled, next to Run Now) rather than a read-only badge, since it's a real
control, not just a status light.

### Execution path

`runCronRecipe(id)` wraps the recipe's work in `runSkill('cron-<id>', handler, { recipeId })`
(from `@llaab/skills`), so **every invocation persists a durable `RunNode`** — visible in the
Activity Monitor, linkable from `/vault/runs/:id`, surfaced in the `/crons` "Recent Cron Runs"
list (filtered by `skill_id?.startsWith('cron-')`). The handler receives the live `runNodeId` and
calls `appendRunEvent(...)` as it works, so progress shows up in the run's event log while it's
still in flight.

Currently both registered recipes share one handler shape (scan transcripts → filter pending →
consolidate each via `consolidateTranscriptIdeasForTranscript` from
`vault/vault-transcripts.routes.ts`). The only per-recipe variation today is the transcript
_selection_ window, applied by `selectScanTranscripts(recipeId, transcripts)`:

| Recipe id                                | Transcript scan window          | Risk   |
| ---------------------------------------- | ------------------------------- | ------ |
| `check-transcripts-consolidation`        | All transcripts                 | medium |
| `check-recent-transcripts-consolidation` | `created_at` within last 7 days | medium |

A transcript is "pending" (needs consolidation) when **both** are true:

1. `!transcriptHasCanonicalSet(transcript)` — `canonical_coverage.canonical_idea_ids.length === 0`.
2. `transcriptHasCandidateIdeas(transcript, runs, ideasById)` — some `RunNode.produced_node_ids`
   that references the transcript also produced an idea node. (A transcript with zero extracted
   ideas yet has nothing to consolidate, so it's correctly skipped, not flagged as pending.)

If a future recipe needs genuinely different logic (not just a different scan window), don't keep
adding `if (recipeId === ...)` branches inside the one shared `runSkill` handler — split
`runCronRecipe` into a per-recipe handler lookup (e.g. a `Record<string, RecipeHandler>`) once a
second shape shows up.

### Adding a new recipe

1. Add a `CronRecipe` entry to `CRON_RECIPES` in `cron-recipes.ts` — pick a stable kebab-case
   `id`; it becomes both the URL (`/api/crons/<id>/run`) and the terminal command
   (`cron.run <id>`).
2. If it reuses the existing scan-and-consolidate shape, extend `selectScanTranscripts` (or the
   equivalent dispatch) with the new id's filter. Otherwise write a new handler and route to it
   by id inside `runCronRecipe`.
3. No route or schema changes needed — `GET /api/crons` and `POST /api/crons/:id/run` are already
   generic over the registry.
4. Add a terminal preset in `apps/client/src/components/TerminalPanel.tsx` (the `Crons` actions
   group) if the recipe should be one-click-discoverable from `/terminal`.
5. `/crons` picks up the new card automatically from `GET /api/crons` — no client change needed
   unless the recipe needs bespoke UI beyond the standard command/risk/schedule-examples card.

Do not add `setInterval`, file watchers, or a background worker to make a recipe "scheduled"
inside `apps/server`. Scheduling is always external — see the `scheduleExamples` on each recipe
for the `cron`/`launchd` snippet to hand to the user's own scheduler.

---

## Agent (`agent/`)

> TODO — populate. See `docs/todo/NEXT_STEPS.md`.

`POST /api/agent/run` (one-shot agent processor, optional `{ nodeId?, force? }`) and
`GET /api/agent/status` (last run metadata).

## Ingest (`ingest/`)

> TODO — populate. See `docs/todo/NEXT_STEPS.md`.

`POST /api/ingest/youtube` — `ingestYouTube` skill, `{ url, title?, tags?, skipExtraction? }`.

## LLM (`llm/`)

> TODO — populate. See `docs/todo/NEXT_STEPS.md`.

Routed completion/streaming (`POST /complete`, `POST /stream`), model/status/capability
introspection (`GET /models`, `/status`, `/capabilities`), and routing overrides
(`PATCH /route`).

## Runs (`runs/`)

> TODO — populate. See `docs/todo/NEXT_STEPS.md`.

Run list/detail/monitor (`GET /`, `/:id`, `/monitor`), retry (`POST /:id/retry`), and dismiss
(`POST /:id/dismiss`).

## Vault (`vault/`)

Already documented — see `vault/AGENTS.md` for the full file map, the "adding a new route file" checklist, and the canonical idea consolidation reference.

## UI State (`ui-state/`)

Already documented — see `ui-state/AGENTS.md`. Generic `GET /:key` / `PUT /:key` persistence for
UI-only settings (filter selections, panel state, etc.) backed by `configs/ui-state.json` — a
project-local config store, not vault content. Adding a new persisted setting never needs a new
route; see that doc's "Adding a new persisted setting" section.
