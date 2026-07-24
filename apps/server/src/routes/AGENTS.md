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

LLAAB does not own an in-process scheduler — see
`.github/instructions/project/agent-execution.instructions.md` (no always-on background
processes, file watchers, or polling loops; one-shot trigger → run → exit only). The `crons`
route group is the explicit, one-shot execution surface for recipes that _would_ otherwise be
cron jobs: each recipe is a typed function that scans vault state, does bounded work, and exits.
Timing is owned by OS `cron`: the `/crons` toggle installs or removes LLAAB-managed crontab lines
that call `POST /api/crons/:id/run`. This keeps scheduling outside the server process while still
making enable/disable a real app control.

Full design background: `docs/todo/DONE_CRONS_PAGE.md`.

### Files

| File              | Role                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `cron-recipes.ts` | Recipe registry, crontab state, consolidation scan handler, and `runCronRecipe(id)` entrypoint |
| `crons.routes.ts` | `list` (`GET /`), `run` (`POST /:id/run`), and `update` (`PATCH /:id`) route exports           |
| `crons.schema.ts` | `updateCronRecipeBodySchema` — `{ enabled: boolean }`                                          |
| `index.ts`        | Wires the three routes onto `createRouter()`, validating `update`'s body                       |

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
  cronExpression: string;     // e.g. '0 */6 * * *'
  scheduleExamples: Array<{ label: string; value: string }>;  // launchd/cron snippets shown in the UI
}
```

`GET /api/crons` returns `listCronRecipesWithState()` — the registry merged with each recipe's
`enabled` flag (see Enable/disable below) — as `{ recipes }`. There is no per-recipe route for
`run` or `update` — both are generic: they look up the recipe by id and call `runCronRecipe(id)` /
`setCronRecipeEnabled(id, enabled)`. Adding a recipe to the array is enough to make it runnable
and toggleable over HTTP; no router change needed.

### Enable/disable

`enabled` means the recipe has a LLAAB-managed line in the user's crontab. `GET /api/crons` awaits
`crontab -l` and returns `enabled: true` only when that recipe's marker is present.
`PATCH /api/crons/:id` with `{ enabled: true }` adds the managed line; `{ enabled: false }` removes
that one line. Preserve unrelated crontab content. Managed lines end with a marker shaped like
`# llaab:cron:<recipe-id>` so updates can be idempotent.

`runCronRecipe(id)` also checks that marker before doing work. Disabled recipes therefore do not
run from Run Now, `/terminal`, or a direct `POST /api/crons/:id/run`. This is intentional until the
UI grows a separate "Run once even if unscheduled" control.

### Execution path

`runCronRecipe(id)` records wrapper-level cron history in `configs/cron-history.json`, capped to
the latest two entries per recipe. That file is ignored by git because it is operational cache, not
vault knowledge. Do not wrap cron recipes themselves in `runSkill('cron-<id>', ...)`; that creates
noisy `vault/runs` markdown files every time external schedulers fire.

Recipe work may still call helpers that create real durable runs. For example, transcript
consolidation uses `consolidateTranscriptIdeasForTranscript`, so the actual consolidation process
remains visible in Activity Monitor and `/vault/runs` while the cron wrapper log stays in local JSON.

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
inside `apps/server`. Scheduling is always OS crontab-backed through the managed line created by
`PATCH /api/crons/:id`.

---

## Agent (`agent/`)

> TODO — populate. See `docs/todo/ROADMAP.md#next`.

`POST /api/agent/run` (one-shot agent processor, optional `{ nodeId?, force? }`) and
`GET /api/agent/status` (last run metadata).

## Ingest (`ingest/`)

> TODO — populate. See `docs/todo/ROADMAP.md#next`.

`POST /api/ingest/youtube` — `ingestYouTube` skill, `{ url, title?, tags?, skipExtraction? }`.

## LLM (`llm/`)

The LLM route group exposes the task router in `@llaab/llm`.

Providers currently supported by the router:

| Provider id | Runtime              | Default endpoint / source                 |
| ----------- | -------------------- | ----------------------------------------- |
| `ollama`    | Ollama local server  | `OLLAMA_HOST` or `http://localhost:11434` |
| `lmstudio`  | LM Studio local API  | `LLAAB_LMSTUDIO_BASE_URL` or `:1234/v1`   |
| `anthropic` | Anthropic remote API | `ANTHROPIC_API_KEY` + configured model    |
| `opencode`  | OpenCode Go cloud    | `OPENCODE_API_KEY` + `OPENCODE_BASE_URL`  |

`GET /api/llm/status` returns the persisted task routing map plus provider-qualified local model
options. `GET /api/llm/models` returns the same local model options in a smaller shape. The client
uses these options so two providers can expose similarly named models without ambiguity.

`PATCH /api/llm/routing` persists `{ task, tier, provider, model }` into
`configs/llm-routing.json`. `POST /api/llm/complete` and `/stream` then call `routeLlm(...)` /
`streamLlm(...)`, which dispatch by the saved provider id. A bare `model` override still uses the
task's saved provider.

Wiki tasks are first-class LLM routes. `wiki-compile` is called by the one-shot wiki draft
compiler; `wiki-discover` is called only when optional model review is explicitly requested for
deterministic wiki-candidate clusters. Both tasks appear in `configs/llm-routing.json` and are
editable through `/llm`.

Current LM Studio integration is intentionally a thin OpenAI-compatible inference adapter. Do not
install `@lmstudio/sdk` until a concrete adapter/agent feature needs model lifecycle management,
embeddings, or LM Studio tool-use flows.

## Runs (`runs/`)

> TODO — populate. See `docs/todo/ROADMAP.md#next`.

Run list/detail/monitor (`GET /`, `/:id`, `/monitor`), retry (`POST /:id/retry`), and dismiss
(`POST /:id/dismiss`).

## Vault (`vault/`)

Already documented — see `vault/AGENTS.md` for the full file map, the "adding a new route file" checklist, and the canonical idea consolidation reference.

## UI State (`ui-state/`)

Already documented — see `ui-state/AGENTS.md`. Generic `GET /:key` / `PUT /:key` persistence for
UI-only settings (filter selections, panel state, etc.) backed by `configs/ui-state.json` — a
project-local config store, not vault content. Adding a new persisted setting never needs a new
route; see that doc's "Adding a new persisted setting" section.
