# LLAAB — Next Steps

> Maintained working list. Larger initiatives live in [`ROADMAP.md`](./ROADMAP.md) — this doc
> covers concrete near-term tasks, manual testing, and small fixes not large enough for ROADMAP.
>
> Last updated: 2026-06-25 (Hermes first-run plan)

---

## Manual Testing Checklist

Things to verify end-to-end after recent orchestration and UI changes:

- [x] Ingest a fresh YouTube URL → confirm transcript + source nodes created
- [ ] Open `/terminal` → confirm socket connects and typed commands stream output
- [ ] Run `ai.run extract "..."` from `/terminal` → confirm a `RunNode` is created
- [ ] Run `shell.exec --enable-session --confirm`, then `shell.exec --confirm node --version`,
      then `shell.exec --disable-session`
- [ ] View `/vault/runs/[id]` for a terminal command → confirm command metadata is readable
- [ ] Verify dark mode renders correctly across all pages (no light backgrounds)
- [ ] Verify badge colors look correct in dark mode (nodes/[id], runs, sources, transcripts)
- [ ] Verify `/ingest` drag-and-drop still works after the shadcn migration
- [ ] Verify `/ingest` pipeline cards still show correct states for fresh ingest, reused transcript, and extract retry
- [ ] Verify sidebar nav expand/collapse + active route styling after the shadcn migration
- [ ] Verify `/vault` file tree selection and content preview after replacing the DS tree
- [ ] Ingest same URL again → confirm dedup fires (`Already saved` in UI)
- [ ] Ingest URL with content from different domains (d:infra, d:ui, etc.) → confirm tag variance
- [ ] Verify extraction produces ideas in `/vault/nodes/ideas/` with correct `source_id`
- [ ] View transcript detail page (`/vault/transcripts/[id]`) — check summary and linked ideas
- [ ] View idea node page (`/vault/nodes/[id]`) — confirm title renders, source_id visible
- [ ] View source detail page (`/vault/sources/[id]`) — confirm linked transcripts show
- [ ] Run `pnpm dev:clean:vault:recent:2h` → confirm it removes nodes from last 2 hours including ideas

---

## Up Next

- [ ] **Hermes first run — CLI, Discord, then read-only LLAAB MCP** — Hermes is installed; verify
      `hermes doctor`, foreground `hermes gateway`, standalone `pnpm dev:cli -- mcp`, then register
      only `vault_list` / `vault_read`.
      Detail: [`TODO_HERMES_FIRST_RUN.md`](./TODO_HERMES_FIRST_RUN.md).
- [x] **Verify per-idea tag fix and confirm distinct tag sets** — extracted ideas were all
      showing the transcript's full, identical tag set; the fix now asks the LLM for tags
      per idea directly. Needs a rebuild + fresh extraction to confirm it actually works.
      Verified against generated vault artifacts: 21/18/27 extracted ideas across three
      transcript groups each had distinct per-idea tag sets, with zero matching the full
      transcript tag set.
      Detail: [`TODO_IDEA_TAG_RELEVANCE.md`](./TODO_IDEA_TAG_RELEVANCE.md).
- [x] **Migrate the ingest form pipeline to durable process state** — see
      [`TODO_PROCESS_STATE_AUDIT.md`](./TODO_PROCESS_STATE_AUDIT.md). `IngestForm.tsx`'s
      transcript/extraction status and elapsed timers are local-state-only despite
      `ingest-youtube` being `runSkill`-backed — same bug class fixed for consolidation
      (status disappears if the page remounts/is navigated away from mid-run).
      Done: `/ingest` now derives active ingest status from `useRunMonitor()` and lets the
      run-backed `ingest-youtube` request own extraction during initial ingest.

- [ ] **Build nav-unlocked observability pages** — start with `/llm/providers`,
      `/llm/capabilities`, `/system/doctor`, and `/system/harness`.
      Detail: [`TODO_NAV_UNLOCKED_PAGES.md`](./TODO_NAV_UNLOCKED_PAGES.md).

- [ ] **Update nav locks as pages land** — only flip `live: true` in
      `apps/client/src/lib/nav-menu.config.ts` after the page/route exists and passes
      the relevant client typecheck/build verification.

- [ ] **Decide extracted SkillNode behavior** — extraction returns `skills`, but the pipeline
      creates `IdeaNode`s only. Decide whether generated skill phrases become candidate
      `SkillNode`s, and what review/status model they should use.

---

## Documentation

- [ ] **Populate `apps/server/src/routes/AGENTS.md` stub sections** — Crons is fully written; Agent,
      Ingest, LLM, and Runs each currently have a one-line `> TODO — populate` placeholder plus a
      bare route list. Fill each in with the same depth as the Crons section (what the group owns,
      how its routes are wired/validated, any non-obvious behavior) following the file-map pattern
      already used in `apps/server/src/routes/vault/AGENTS.md`.

## Code — Small Fixes & Polish

- [ ] **Terminal follow-up UX** — vertical slice is complete and graduated to
      [`DONE_TERMINAL_PANEL.md`](./DONE_TERMINAL_PANEL.md). Remaining polish:
      add UI command injection from node/transcript pages (for example,
      "Read in Terminal" → `fs.read ...`), promote autocomplete from static suggestions to live
      vault path search, and hot-link URLs in terminal output once command streams show URLs.

- [x] **Extraction retry button** — `POST /api/vault/transcripts/:id/extract` route exists and
      transcript detail page includes "Re-extract" action.

- [x] **LLM model status indicator** — `/llm` page calls `GET /api/llm/status` and surfaces model
      routing/availability.

- [x] **`related` field on idea nodes** — currently always `[]`. Consider auto-linking extracted ideas
      to their transcript via `related` (in addition to `source_id`). Low priority — `source_id` is
      the primary provenance link.
      Done: both extraction paths set `related: [transcriptId]`; verified all 70 current idea
      files include their `source_id` in `related`.

- [x] **Expand LLM auto-tag triggers** — model-family terms such as `gemma`, `llama`,
      `mistral`, `qwen`, `phi`, and `gemini` now contribute to `d:llm` tagging through the
      Phase 6b auto-tag expansion.

- [x] **shadcn initial-setup audit** — fixed dark mode (`data-theme` → `class="dark"`), re-enabled
      `app.css`, removed duplicate framework imports, fixed light-mode badge hex colors across 6
      pages, installed `badge`, `breadcrumb`, `table`, `tooltip`, `scroll-area` to `packages/ui`.

---

## Near-Term Integration

- [x] **Install `@finografic/ai-harness` in the first LLAAB consumer package** — now added to
      `@llaab/ingestion`.

- [x] **Spike harness at the transcript extraction boundary** — `llm-extract.ts` now uses a small
      local harness prep pipeline before `control.execute(...)`.

- [x] **Validate the new extraction prep in real transcript ingestion** — run the actual ingest +
      extract flow and confirm the staged preparation is useful in practice.
      Start here:
      `packages/ingestion/src/extract/harness-prep.ts`,
      `packages/ingestion/src/extract/llm-extract.ts`,
      `packages/control/src/orchestrator.ts`.
      Done means:
      extraction succeeds, harness stages appear in trace output, and there is a written call on
      whether current truncation is acceptable.

- [x] **Compare current truncation-based prep vs harness-ready prep** — confirm what should stay
      local to LLAAB now and what should move into the harness package later.
      Specifically answer:
      should `prepareExtractionInput(...)` remain local for now, or is transcript length handling
      the next package-level feature gap?

- [x] **Decide next priority after consumer validation** — if transcript extraction still feels
      blocked by input prep limits, do harness extension before Terminal Panel. If not, Terminal
      Panel can stay next.
      Record that decision in both `ROADMAP.md` and `TODO_HARNESS.md`.

- [x] **Capture one short implementation note after validation** — update `TODO_HARNESS.md` with:
      what was tested, what failed or held up, and whether Phase 2 or Terminal should come next.

### Orchestration verdict

The orchestration foundation is complete: provider interface, LLM metadata, token-aware extraction
prep, command bus, Terminal Panel, capability routing, diagnostics, OpenCode registration, and
session-gated `shell.exec`. The next highest-value work is exposing this architecture through
small nav pages rather than adding another backend layer immediately.

---

## Roadmap Items — Current Priority Order

See [`ROADMAP.md`](./ROADMAP.md) for full descriptions. Suggested order:

1. **P0 — Nav-unlocked observability pages** — `/llm/providers`, `/llm/capabilities`,
   `/system/doctor`, `/system/harness`
2. **P1 — Execution pages** — `/agent`, `/execute/skills`, `/pipeline/extract`
3. **P1 — Extracted SkillNode creation** — decide and implement skill promotion from extraction
4. **P2 — Adapter expansion** — only when a concrete workflow needs a new external executor
5. **P2 — Harness package graduation** — move reusable token/chunk/context utilities into
   `@finografic/ai-harness` when the package boundary is clear
6. **P2 — Search and retrieval discipline** — design before unlocking `/vault/search`
7. **P3 — Source Auto-Follow** — agent loop slot exists; needs explicit trigger story
8. **P3 — Library Watch** — npmx.dev logic is portable; `PackageNode` schema needed first
9. **P3 — Karpathy graph** — defer until vault has meaningful node density (50+ nodes)

---

## Open Questions (carry-forward from architecture)

- **Harness priority call** — answered 2026-06-07: token-aware extraction prep was completed in
  the orchestration work. Remaining harness work is package-boundary cleanup, not a blocker for
  nav observability pages.

- **Tag origin tracking** — separate `autoTags` / `manualTags` fields vs. derive post-hoc?
  Decide before building solid/outline tag UI. Tracked in `DONE_TAXONOMY.md`.

- **LLM dev tools** — `/llm` covers status/routing; `/llm/providers`, `/llm/capabilities`, and
  `/system/doctor` are now the preferred surfaces for deeper diagnostics.

- **Skill extraction from transcripts** — the LLM currently extracts `ideas` and `skills` arrays
  from transcripts, but only `IdeaNode`s are created. `SkillNode`s from extraction are not yet
  implemented. Decision needed: should extracted `skills` phrases also become `SkillNode`s?
