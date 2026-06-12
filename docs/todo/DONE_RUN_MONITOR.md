# DONE — App-Wide Run Monitor

> **Completed:** 2026-06-13 — app-wide Run Monitor with durable run events, live polling, and retry.

---

## Goal

Build an app-wide right sidebar that shows durable background run progress, so ingestion and
extraction can continue visibly even when the user navigates away from the page that started the
work.

The Vite + React Router migration makes this straightforward: the monitor can live once in the
single `AppLayout` React tree, share the root TanStack Query cache, and remain mounted across
route transitions. There is no Astro SSR/island boundary to work around.

This is a **Run Monitor**, not an Agent Monitor. It should support agent-driven runs later, but the
first version should model ordinary app workflows: YouTube ingestion, transcript reuse, idea
extraction, node writes, and failures.

## UX Shape

The monitor should live at the app layout level, probably as a collapsible right sidebar or drawer.

Core states:

- No active runs.
- Active run summary.
- Recent completed or failed runs.
- Failed run with retry affordance.

Core content:

- Run title and status.
- Source or transcript link back to the page that spawned the run.
- Task-list style steps.
- Compact model metadata when available.
- Operational trace/events.

Example:

```text
Run Monitor

Ingest YouTube
AI mistakes you're probably making
Running · Extracting ideas

[x] Fetch transcript
[x] Save transcript node
[-] Extract ideas
[ ] Write idea nodes
[ ] Link run outputs

Activity
21:49 Started ingest-youtube
21:49 Reused existing transcript
21:50 gemma4:e4b-it-qat selected
21:50 Extracted 8 ideas
```

## Terms

- **Run Monitor** — app-wide UI that displays active and recent runs.
- **Run step** — durable checklist item within a run.
- **Run event** or **Trace event** — timestamped operational log entry.
- **Trace** — observable workflow history, not model private reasoning.

Avoid the label "chain of thought" in product UI. If using the AI Elements component as visual
inspiration, adapt the terminology to **Activity**, **Trace**, or **Execution Trace**.

## Progress

- [x] Phase 1 — data model for run steps and events.
- [x] Phase 2 — server API for active/recent runs.
- [x] Phase 3 — app-wide sidebar shell in `AppLayout`.
- [x] Phase 4 — ingestion and extraction write progress events.
- [x] Phase 5 — live refresh via polling or SSE.
- [x] Phase 6 — retry/navigation polish.

Current implementation:

- `RunNodeSchema` carries a durable `events: RunEvent[]` trace (id, at, level, message, optional
  `node_ids`/`href`) alongside `stages`/`decisions`. `RunMonitorItemSchema` exposes the same
  `events` array to the client.
- `runSkill` persists the run node immediately with `run_status: 'running'` (a pending `execute`
  stage and a "Started ..." event) before the skill body runs, then finalizes it
  (`run_status: completed | failed`, final stages/decisions, a "Completed/failed ..." event) once
  it settles. `appendRunEvent(runNodeId, event)` lets skills append durable progress events
  mid-run.
- `ingestYouTube` emits events for transcript saved, extraction started, ideas extracted, and
  extraction failures — visible in the monitor's Activity feed.
- `GET /api/runs/monitor` derives active and recent run summaries (including `events`) from
  `RunNode` data. `POST /api/runs/:id/retry` re-dispatches a failed `ingest-youtube` run from its
  recorded input.
- `RunMonitor` lives once in `AppLayout`, shares the root TanStack Query cache, and renders an
  Activity feed per run plus a Retry action for failed ingest-youtube runs.
- UI state uses a root `RunMonitorProvider` powered by `@finografic/zustand-context-creator`.
- `useRunMonitor` polls every 4s while any run is active (even when the sheet/trigger is closed)
  and every 20s otherwise; the sheet polls every 3s while open. `IngestForm` invalidates the
  monitor query when a run starts and again after extraction completes.

## Next TODO

- Extraction currently runs after the `ingest-youtube` run's `execute` stage finalizes
  (`run_status` flips to `completed` before extraction starts), so extraction-in-progress runs
  show up in "recent" rather than "active". Revisit if extraction should keep the run "running".
- Consider an SSE stream for active run updates instead of polling, if polling proves too coarse.
- Extend retry to other skills/run types once there is a second one to generalize from.

## Phase 1 — Data Model

Extend run persistence with durable progress metadata.

Candidate fields on `RunNode`:

- `status`: `queued | running | completed | failed | cancelled`
- `current_step_id`
- `steps`
- `events`
- `source_node_id`
- `source_url`
- `primary_node_id`
- `error`

Candidate step shape:

```ts
interface RunStep {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  detail?: string;
  node_ids?: string[];
}
```

Candidate event shape:

```ts
interface RunEvent {
  id: string;
  at: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  node_ids?: string[];
  href?: string;
}
```

Keep this small at first. The monitor should be useful with only status, steps, and events.

## Phase 2 — Server API

Add read endpoints for the app shell:

- `GET /api/runs/active`
- `GET /api/runs/recent?limit=...`
- optional `GET /api/runs/:id/events`

Possible combined endpoint:

- `GET /api/runs/monitor`

Return active runs first, then recent completed/failed runs. Include enough linked node metadata to
render source/transcript links without extra round trips.

## Phase 3 — App-Wide UI

Add a layout-level `RunMonitor` component.

Likely placement:

- shell trigger in `AppHeader`
- collapsible right sidebar/drawer in `AppLayout`
- route-persistent state through the root Query provider; no page-local provider workaround

Visual approach:

- Use the AI Elements **Task List** component as the closest inspiration.
- Use a compact activity feed below the task list.
- Reuse `ExtractionModelCard variant="compact-bar"` for model metadata when present.
- Use shadcn primitives for sidebar/drawer, badges, buttons, and scroll areas.

Do not add agent roster/status UI yet. That can layer on later when actual agent workers exist.

## Phase 4 — Write Progress

Update run-producing workflows to emit steps/events:

- `ingest-youtube`
- transcript reuse path
- transcript save path
- idea extraction
- idea node writes
- run produced-node linking
- retry/failure path

The run should continue independently of the originating page's React state. Navigating away should
not lose the visible run status.

In the SPA, starting a run should invalidate or seed the shared monitor query rather than coupling
the monitor to page-local component state.

## Phase 5 — Live Updates

Start simple:

- Poll `/api/runs/monitor` every few seconds while the monitor is open or while active runs exist.

Consider later:

- SSE stream for active run updates.
- Browser notifications for completed/failed runs.
- `BroadcastChannel` only if cross-tab monitor sync becomes a real workflow.

Avoid watchers or always-on schedulers. This should remain request-driven and app-session-driven.

## Phase 6 — Retry And Navigation

Add useful actions:

- Click source/transcript title to return to the relevant page.
- Click run id/title to open the run detail route.
- Retry failed extraction when a retry route exists.
- Dismiss completed run from the visible monitor list without deleting the run node.

## Open Questions

- Should active runs be defined by `status === running`, or by incomplete `completed_at`?
- Should the run monitor show only the current browser session's runs or all recent app runs?
- Should extraction retries create new run nodes or append to the existing run?
- Should trace events live inside `RunNode`, or as separate event nodes if they become large?

## Success Criteria

- Starting ingestion/extraction creates a visible run in the app-wide monitor.
- Navigating away from the ingest page does not hide or interrupt progress.
- The monitor shows current step, model metadata, and produced node links.
- Completed runs remain available as recent history.
- Failed runs show an error and a clear retry/navigation path.
