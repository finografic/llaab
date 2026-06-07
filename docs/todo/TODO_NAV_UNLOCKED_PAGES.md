# TODO — Navigation Pages Unlocked by Orchestration

> **Status:** P0 active candidate. Orchestration and adapter foundations are complete; several
> locked navigation items now have enough backend architecture to become real pages.
>
> Stable architecture reference:
> [07 — Orchestration and adapters](../07_ORCHESTRATION_AND_ADAPTERS.md).

---

## Goal

Turn the next locked nav items from `NAV_MENU_DESIGN.md` into simple, useful frontend pages backed
by the orchestration routes and registries that now exist.

The standard is the existing YouTube ingest page: small, direct, inspectable UI that exposes the
real system state without becoming a dashboard for its own sake.

---

## Selection Criteria

Prioritize pages when:

- the backend route, CLI command, or package API already exists
- the page helps verify orchestration behavior
- the page unlocks a nav item currently visible but locked
- the first version can be read-only or one-shot
- it does not require a new scheduler, watcher, or background process

Defer pages when:

- they need a new node type
- they need a new ingestion parser
- they depend on search indexing or retrieval design not yet implemented
- they would require always-on automation

---

## Phase 1 — Model and System Observability Pages

These are the highest-leverage unlocked pages because the backend architecture already exists.

### 1. `/llm/providers`

- [ ] Create `apps/client/src/pages/llm/providers.astro`.
- [ ] Read provider availability/routing from `GET /api/llm/status`.
- [ ] Read provider capability declarations from `GET /api/llm/capabilities`.
- [ ] Show provider id, display name, availability, configured models, and capabilities.
- [ ] Link back to `/llm` for task routing status.
- [ ] Unlock **Models → Providers** in `apps/client/src/lib/nav-menu.config.ts`.

### 2. `/llm/capabilities`

- [ ] Create `apps/client/src/pages/llm/capabilities.astro`.
- [ ] Show capability → provider mapping from `GET /api/llm/capabilities`.
- [ ] Include command capabilities from `packages/core/src/capability.ts` in the page data.
- [ ] Include executor capability status when available from CLI/server support.
- [ ] Unlock **Models → Capabilities** in `apps/client/src/lib/nav-menu.config.ts`.

### 3. `/system/doctor`

- [ ] Add a server route for web diagnostics, likely `GET /api/system/doctor`.
- [ ] Reuse the same checks as `lab doctor` where possible instead of duplicating logic.
- [ ] Show provider availability, Ollama status, command handler count, executor availability,
      and important binary checks (`yt-dlp`, `opencode`, `node`, `git`, `pnpm`).
- [ ] Unlock **System → Doctor** in `apps/client/src/lib/nav-menu.config.ts`.

### 4. `/system/harness`

- [ ] Add a small server route if needed, likely `GET /api/system/harness`.
- [ ] Show the extraction harness boundary: token limits, chunking policy, overlap, and current
      model used for extraction.
- [ ] Link to recent extraction `RunNode`s so harness behavior can be inspected.
- [ ] Unlock **System → Harness** in `apps/client/src/lib/nav-menu.config.ts`.

### Phase 1 Done Means

- All four pages render in dark mode and mobile layout.
- The pages use existing shadcn primitives from `packages/ui/src/components/`.
- No new always-on background work is introduced.
- Nav items are live only after their routes exist.
- `astro check --root apps/client` passes.
- Relevant server/client type checks pass.

---

## Phase 2 — Execution Pages

These are unlocked by the command bus and agent loop, but need a little more UI/API shaping.

### 5. `/agent`

- [ ] Create a one-shot agent runner page.
- [ ] Use existing `POST /api/agent/run`.
- [ ] Show last run result and link to created `RunNode`.
- [ ] Provide a clear manual trigger; do not add scheduling or polling.
- [ ] Unlock **Execute → Agent**.

### 6. `/execute/skills`

- [ ] Create a skills registry browser.
- [ ] Expose skill route metadata through a small server endpoint if needed.
- [ ] Show skill id, node type, declared capabilities, and whether it is agent-runnable.
- [ ] Link to related node-type pages where useful.
- [ ] Unlock **Execute → Skills**.

### 7. `/pipeline/extract`

- [ ] Create a re-extraction page for saved transcripts.
- [ ] List transcripts with extraction status, idea count, model metadata, and last run link.
- [ ] Reuse `POST /api/vault/transcripts/:id/extract` for per-transcript re-extraction.
- [ ] Start with one-at-a-time actions; batch mode can follow later.
- [ ] Unlock **Pipeline → Re-extract**.

---

## Phase 3 — Deeper Future Pages

These remain useful, but should wait behind Phase 1 and Phase 2.

### `/vault/search`

- Needs search/retrieval design before implementation.
- Start with simple local full-text search only if it does not conflict with future retrieval.

### `/ingest/article`

- Needs article fetch/parse pipeline and likely `ResourceNode` write path.
- Should follow the same two-phase rule as YouTube where applicable: save first, extract second.

### `/ingest/document`

- Needs local document parsing choice and file upload flow.
- Do not implement with an always-on watcher.

---

## Open Design Notes

- Provider/capability pages may want a shared `CapabilityBadge` or `ProviderStatusCard`, but add
  a component only after duplication is visible.
- Doctor should be a one-shot check, not a live monitor.
- Harness should show the extraction boundary and recent evidence, not become a generic pipeline
  visualizer yet.
- Batch re-extraction should be explicit and cancellable before it becomes multi-select.
