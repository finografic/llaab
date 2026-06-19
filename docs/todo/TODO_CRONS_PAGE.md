# TODO — Crons Page and External Automation Recipes

> **Status:** Started. LLAAB exposes one-shot jobs and cron recipes, but scheduling remains
> external. Do not add an internal scheduler, timer loop, watcher, or polling worker.

## Goal

Create a `/crons` page for managing explicit automation recipes. The page should show what can be
run on a schedule, how to trigger it manually, and how to install an external schedule using
`cron`, `launchd`, GitHub Actions, Vercel Cron, or another user-owned scheduler.

The page is a visibility and command-generation surface. The actual work is performed by
one-shot scripts, CLI commands, or HTTP endpoints that run and exit.

## Recommended Libraries

- Prefer no runtime scheduler library in LLAAB.
- Use OS cron, macOS `launchd`, GitHub Actions schedules, or Vercel Cron as external triggers.
- If schedule parsing or preview is needed in the UI, consider `croner` for lightweight cron
  expression validation and next-run calculation.
- Avoid `node-cron`, Agenda, Bree, BullMQ repeatable jobs, or any package that implies an
  always-on Node worker inside `apps/server`.

## First Cron Recipe

Name: `check-transcripts-consolidation`

Purpose:

- Scan transcript nodes.
- Detect transcripts with extracted ideas that are missing canonical consolidation.
- Run missing consolidation work.
- Do nothing when all transcripts are already consolidated.
- Persist a `RunNode` for each explicit invocation.

Candidate triggers:

```bash
cron.run check-transcripts-consolidation
```

```bash
curl -X POST http://localhost:8888/api/crons/check-transcripts-consolidation/run
```

The command/route should be safe to run repeatedly. It should report `skipped`, `consolidated`,
and `failed` counts.

## Phase 1 — One-Shot Job Contract

- [x] Define a typed cron recipe registry.
- [x] Add recipe id, title, description, command examples, and risk level.
- [x] Add a one-shot handler signature that returns structured summary data.
- [x] Ensure each invocation creates a durable `RunNode`.
- [x] Keep scheduling external.

## Phase 2 — Transcript Consolidation Check

- [x] Implement `check-transcripts-consolidation`.
- [x] Reuse existing transcript, idea, and canonical idea APIs where possible.
- [x] Detect only missing consolidation work; avoid duplicate canonical idea generation.
- [x] Return clear no-op output when nothing is pending.
- [x] Add a terminal command for manual execution.

## Phase 3 — API Surface

- [x] Add `GET /api/crons` for recipe metadata.
- [x] Add `POST /api/crons/:id/run` for manual one-shot execution.
- [x] Reuse run filters/client-side filtering for recent history.
- [x] Require explicit user action; no server-side schedule loop.

## Phase 4 — `/crons` Page

- [x] Add a Crons nav entry.
- [x] List available recipes.
- [x] Add a `Run Now` action per recipe.
- [x] Show external install snippets for cron and launchd-style HTTP triggers.
- [x] Show recent run links.
- [ ] Add a small `Cron syntax` toggle near the top of `/crons`.
- [ ] Show the cron syntax legend in a monospace block, collapsed by default.
- [ ] Add a lightweight `Adding a Cron Recipe` section.

## Phase 5 — Terminal Integration

- [x] Add terminal presets for cron recipes.
- [x] Support `cron.run <recipe-id>` as a typed command.
- [x] Link completed cron invocations to `/vault/runs/:id`.
- [ ] Allow future node/transcript pages to inject relevant cron commands.

## Adding a Cron Recipe

Current mechanism is code-first:

1. Add recipe metadata to `apps/server/src/routes/crons/cron-recipes.ts`.
2. Add a one-shot implementation in that file or a helper beside it.
3. Wrap execution in `runSkill(...)` so every invocation creates a durable `RunNode`.
4. Keep the recipe id stable; it becomes the URL and terminal command id.
5. Expose manual execution through `POST /api/crons/:id/run`.
6. Add a terminal action when the recipe should be discoverable from `/terminal`.

Do not add timers, watchers, polling loops, or server-owned schedulers. External `cron`,
`launchd`, GitHub Actions, Vercel Cron, or another user-controlled scheduler owns timing.

## Non-Goals

- No `setInterval`.
- No file watchers.
- No background worker process inside `apps/server`.
- No automatic LLM calls without an explicit external trigger.
