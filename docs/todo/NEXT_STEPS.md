# LLAAB — Next Steps

> Maintained working list. Larger initiatives live in [`ROADMAP.md`](./ROADMAP.md) — this doc
> covers concrete near-term tasks, manual testing, and small fixes not large enough for ROADMAP.
>
> Last updated: 2026-04-19

---

## Manual Testing Checklist

Things to verify end-to-end after recent pipeline changes:

- [x] Ingest a fresh YouTube URL → confirm transcript + source nodes created
- [ ] Ingest same URL again → confirm dedup fires (`Already saved` in UI)
- [ ] Ingest URL with content from different domains (d:infra, d:ui, etc.) → confirm tag variance
- [ ] Verify extraction produces ideas in `/vault/nodes/ideas/` with correct `source_id`
- [ ] View transcript detail page (`/vault/transcripts/[id]`) — check summary and linked ideas
- [ ] View idea node page (`/vault/nodes/[id]`) — confirm title renders, source_id visible
- [ ] View source detail page (`/vault/sources/[id]`) — confirm linked transcripts show
- [ ] Run `pnpm dev:clean:vault:recent:2h` → confirm it removes nodes from last 2 hours including ideas

---

## Code — Small Fixes & Polish

- [ ] **Extraction retry button** — add `POST /api/vault/transcripts/:id/extract` route + "Re-extract"
      button on `/vault/transcripts/[id]` page. `extractKnowledgeFromTranscript` is already exported
      and ready to call.

- [ ] **LLM model status indicator** — surface `GET /api/llm/models` somewhere in the UI (even just
      a small footer badge showing which Ollama models are available). Helps debug extraction failures.
      `GET /api/llm/models` already exists in `apps/server`.

- [ ] **`related` field on idea nodes** — currently always `[]`. Consider auto-linking extracted ideas
      to their transcript via `related` (in addition to `source_id`). Low priority — `source_id` is
      the primary provenance link.

---

## Roadmap Items — Current Priority Order

See [`ROADMAP.md`](./ROADMAP.md) for full descriptions. Suggested order:

1. **P2 — Terminal / Command Panel** — next major feature after current pipeline is stable
2. **P3 — Zod v4 upgrade** — do before schema surface grows further
3. **P3 — oxlint migration** — phase 2 audit next; see [`TODO_OXLINT_MIGRATION.md`](./TODO_OXLINT_MIGRATION.md)
4. **P3 — Source Auto-Follow** — agent loop slot already reserved; needs scheduled trigger story
5. **P3 — Library Watch** — npmx.dev logic is portable; `PackageNode` schema needed first
6. **P3 — Karpathy graph** — defer until vault has meaningful node density (50+ nodes)

---

## Open Questions (carry-forward from architecture)

- **Tag origin tracking** — separate `autoTags` / `manualTags` fields vs. derive post-hoc?
  Decide before building solid/outline tag UI. Tracked in `DONE_TAXONOMY.md`.

- **LLM dev tools** — ping model, check connection, list installed Ollama models in UI.
  `GET /api/llm/models` exists; just needs a UI surface. Could be as simple as a settings modal.

- **Skill extraction from transcripts** — the LLM currently extracts `ideas` and `skills` arrays
  from transcripts, but only `IdeaNode`s are created. `SkillNode`s from extraction are not yet
  implemented. Decision needed: should extracted `skills` phrases also become `SkillNode`s?
