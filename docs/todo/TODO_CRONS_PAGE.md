# TODO — Crons Page and External Automation Recipes

> **Status:** Planned. LLAAB should expose one-shot jobs and cron recipes, but scheduling remains
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
lab cron run check-transcripts-consolidation
```

```bash
curl -X POST http://localhost:8888/api/crons/check-transcripts-consolidation/run
```

The command/route should be safe to run repeatedly. It should report `skipped`, `consolidated`,
and `failed` counts.

## Phase 1 — One-Shot Job Contract

- [ ] Define a typed cron recipe registry.
- [ ] Add recipe id, title, description, command examples, and risk level.
- [ ] Add a one-shot handler signature that returns structured summary data.
- [ ] Ensure each invocation creates a durable `RunNode`.
- [ ] Keep scheduling external.

## Phase 2 — Transcript Consolidation Check

- [ ] Implement `check-transcripts-consolidation`.
- [ ] Reuse existing transcript, idea, and canonical idea APIs where possible.
- [ ] Detect only missing consolidation work; avoid duplicate canonical idea generation.
- [ ] Return clear no-op output when nothing is pending.
- [ ] Add a terminal command or CLI command for manual execution.

## Phase 3 — API Surface

- [ ] Add `GET /api/crons` for recipe metadata.
- [ ] Add `POST /api/crons/:id/run` for manual one-shot execution.
- [ ] Add `GET /api/crons/:id/history` or reuse run filters once available.
- [ ] Require explicit user action; no server-side schedule loop.

## Phase 4 — `/crons` Page

- [ ] Add a Crons nav entry.
- [ ] List available recipes and last run status.
- [ ] Add a `Run Now` action per recipe.
- [ ] Show external install snippets for cron, launchd, and HTTP schedulers.
- [ ] Show recent run links.

## Phase 5 — Terminal Integration

- [ ] Add terminal presets for cron recipes.
- [ ] Support `cron.run <recipe-id>` as a typed command if useful.
- [ ] Link completed cron invocations to `/vault/runs/:id`.
- [ ] Allow future node/transcript pages to inject relevant cron commands.

## Non-Goals

- No `setInterval`.
- No file watchers.
- No background worker process inside `apps/server`.
- No automatic LLM calls without an explicit external trigger.
