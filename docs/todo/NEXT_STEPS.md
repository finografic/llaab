# LLAAB — Next Steps

> Maintained working list. Larger initiatives live in [`ROADMAP.md`](./ROADMAP.md) — this doc
> covers concrete near-term tasks, manual testing, and small fixes not large enough for ROADMAP.
>
> Last updated: 2026-06-07 (Phase 0 orchestration metadata)

---

## Manual Testing Checklist

Things to verify end-to-end after recent pipeline changes:

- [x] Ingest a fresh YouTube URL → confirm transcript + source nodes created
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

- [x] **LLM execution metadata in frontmatter** — write `llm_model`, `llm_duration_ms`,
      `llm_prompt_tokens`, `llm_completion_tokens` to transcript and idea nodes at extraction time.
      See ROADMAP P2 for full implementation boundary.

---

## Code — Small Fixes & Polish

- [x] **Extraction retry button** — `POST /api/vault/transcripts/:id/extract` route exists and
      transcript detail page includes "Re-extract" action.

- [x] **LLM model status indicator** — `/llm` page calls `GET /api/llm/status` and surfaces model
      routing/availability.

- [ ] **`related` field on idea nodes** — currently always `[]`. Consider auto-linking extracted ideas
      to their transcript via `related` (in addition to `source_id`). Low priority — `source_id` is
      the primary provenance link.

- [ ] **Expand LLM auto-tag triggers** — add conservative model-family terms such as `gemma`,
      `llama`, `mistral`, `qwen`, `phi`, and `gemini` to the `d:llm` taxonomy trigger set so
      transcript/idea nodes about specific models do not miss the LLM domain tag.

- [x] **shadcn initial-setup audit** — fixed dark mode (`data-theme` → `class="dark"`), re-enabled
      `app.css`, removed duplicate framework imports, fixed light-mode badge hex colors across 6
      pages, installed `badge`, `breadcrumb`, `table`, `tooltip`, `scroll-area` to `packages/ui`.

---

## Near-Term Integration

- [x] **Install `@finografic/ai-harness` in the first LLAAB consumer package** — now added to
      `@llaab/ingestion`.

- [x] **Spike harness at the transcript extraction boundary** — `llm-extract.ts` now uses a small
      local harness prep pipeline before `control.execute(...)`.

- [ ] **Validate the new extraction prep in real transcript ingestion** — run the actual ingest +
      extract flow and confirm the staged preparation is useful in practice.
      Start here:
      `packages/ingestion/src/extract/harness-prep.ts`,
      `packages/ingestion/src/extract/llm-extract.ts`,
      `packages/control/src/orchestrator.ts`.
      Done means:
      extraction succeeds, harness stages appear in trace output, and there is a written call on
      whether current truncation is acceptable.

- [ ] **Compare current truncation-based prep vs harness-ready prep** — confirm what should stay
      local to LLAAB now and what should move into the harness package later.
      Specifically answer:
      should `prepareExtractionInput(...)` remain local for now, or is transcript length handling
      the next package-level feature gap?

- [ ] **Decide next priority after consumer validation** — if transcript extraction still feels
      blocked by input prep limits, do harness extension before Terminal Panel. If not, Terminal
      Panel can stay next.
      Record that decision in both `ROADMAP.md` and `TODO_HARNESS.md`.

- [ ] **Capture one short implementation note after validation** — update `TODO_HARNESS.md` with:
      what was tested, what failed or held up, and whether Phase 2 or Terminal should come next.

---

## Roadmap Items — Current Priority Order

See [`ROADMAP.md`](./ROADMAP.md) for full descriptions. Suggested order:

1. **P1 — Install and validate `@finografic/ai-harness`** — adopt the released package in the
   transcript extraction path first; remaining work is real-flow validation; see
   [`TODO_HARNESS.md`](./TODO_HARNESS.md)
2. **P2 — Terminal / Command Panel** — only stays next if harness consumer validation does not
   expose immediate prep/runtime blockers
3. **P2 — Harness layer extension** — should move ahead of Terminal Panel if long-input prep or
   model-boundary issues become the real blocker during transcript testing
4. **P3 — Source Auto-Follow** — agent loop slot already reserved; needs scheduled trigger story
5. **P3 — Library Watch** — npmx.dev logic is portable; `PackageNode` schema needed first
6. **P3 — Karpathy graph** — defer until vault has meaningful node density (50+ nodes)

---

## Open Questions (carry-forward from architecture)

- **Harness priority call** — after a real ingest + extract validation pass, does transcript prep
  remain "good enough", or is token-aware harness work now the sharper blocker than Terminal?

- **Tag origin tracking** — separate `autoTags` / `manualTags` fields vs. derive post-hoc?
  Decide before building solid/outline tag UI. Tracked in `DONE_TAXONOMY.md`.

- **LLM dev tools** — ping model, check connection, list installed Ollama models in UI.
  `/llm` now covers status/routing; decide whether a lightweight global indicator (header/footer)
  is still useful.

- **Skill extraction from transcripts** — the LLM currently extracts `ideas` and `skills` arrays
  from transcripts, but only `IdeaNode`s are created. `SkillNode`s from extraction are not yet
  implemented. Decision needed: should extracted `skills` phrases also become `SkillNode`s?
