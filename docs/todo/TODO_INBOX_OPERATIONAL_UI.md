# TODO — Inbox Operational UI

> **Created:** Jul 12, 2026. Polish `/vault/inbox` into a dense operational surface for scanning,
> triage, review, and retrieval without changing Hermes routing or capture semantics.

## Goal

Make the Inbox useful as the daily review queue for Telegram and manual captures. Preserve the
existing `IdeaNode`-backed capture model, detail routes, URL filter state, and review tags while
making common workflows obvious from the list page.

## Scope

- Frontend-first work in the Inbox route, list, filters, and presentation helpers.
- Reuse existing vault queries, batch node updates, media routes, and review-state tags.
- Keep `/vault/inbox` and `/vault/inbox/:id` route semantics stable.
- Do not change Telegram execution boundaries, Hermes receipts, or routing behavior.
- Do not add polling, background work, or a new Inbox API.

## Product Decisions

- Saved views are URL-backed filters, not persisted server-side records.
- Needs attention includes failed, malformed, raw, unknown, and unreviewed captures.
- Command candidates remain non-executable references; list actions may only copy them.
- Hermes media-cache paths may power previews through the existing media route but are not treated
  as durable vault assets.
- Batch archive remains limited to reviewed captures and retains its confirmation dialog.

## Phase 1 — Triage Navigation

- [x] Add compact saved views for All, Needs attention, Action-backed, Links, Docs, Code,
      Attachments, Todos, and Raw.
- [x] Preserve the active saved view in URL search params.
- [x] Keep text search visible and move lower-frequency facets into a compact advanced filter panel.
- [x] Show the number of active advanced filters and keep Reset available.
- [x] Retain route kind, platform, node status, review state, sort, grouping, and attention facets.

## Phase 2 — Operational Summary

- [x] Replace generic stat boxes with useful queue metrics: captured today, unreviewed, needs
      attention, action-backed, raw/unknown, and attachments.
- [x] Make summary metrics actionable where a corresponding saved view or review filter exists.
- [x] Use restrained semantic emphasis for attention and new-item counts.

## Phase 3 — Capture Rows

- [x] Add route-kind icons and clearer type badges.
- [x] Render image thumbnails through the existing vault media route when available.
- [x] Render code and command previews in monospace with a language hint when available.
- [x] Render link captures as domain plus path rather than an undifferentiated URL string.
- [x] Render attachment file name and MIME metadata when available.
- [x] Keep platform, review state, and received date consistently scannable.
- [x] Add safe inline actions for detail, external source, copy, mark reviewed, and delete.
- [x] Keep Telegram command candidates explicitly non-executable.

## Phase 4 — States and Responsive Layout

- [x] Improve loading, empty-filter, empty-inbox, and failure states.
- [x] Use `Row` / `Col` for page, filter, summary, and list-row structure.
- [ ] Verify dense desktop layout and readable mobile stacking.
- [x] Preserve selected-row styling for future split-view reuse.

## Phase 5 — Validation

- [x] Add focused filter tests for saved-view URL parsing and category matching.
- [x] Run Inbox-focused client tests.
- [x] Run client TypeScript and production build checks.
- [x] Run Markdown lint for this plan.
- [x] Visually verify `/vault/inbox` in the running app at desktop width (Jul 12, 2026).

## Phase 6 — Review-State and Group Polish

- [x] Render saved-view, summary, group, and reviewed-item counts with shadcn `Badge`.
- [x] Make each grouped capture list independently collapsible with shadcn `Collapsible`.
- [x] Reuse semantic info, warning, success, consolidation, and error colors for capture badges.
- [x] Replace the ambiguous check-only row action with an explicit `Mark reviewed` button.
- [x] Explain that reviewed captures stay in Vault and do not enter the knowledge base.
- [x] Add a direct `View reviewed` filter action with the current reviewed count.
- [x] Clarify archive behavior in the Inbox detail confirmation and toast messages.
- [x] Prevent legacy YouTube captures without a provenance URL from treating transcript text as an
      external link.

## Deferred

- Checkbox-based arbitrary multi-select and destructive bulk delete.
- Inbox split view; reuse the list improvements if navigation friction still warrants it.
- Durable vault asset ingestion for Telegram attachments.
- Server-backed user-defined saved views.
- Keyboard shortcuts beyond native link, button, and input behavior.
