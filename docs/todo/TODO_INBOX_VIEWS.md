# TODO — Inbox Views and Review Workflows

> **Status:** Phases 0–8 complete for MVP inbox views (2026-07-09). Remaining deferred items:
> code-block URL extraction, snippet/docs-attachment promote destinations, registry/run provenance
> cross-links.

## Goal

Build the LLAAB UI layer for reviewing, searching, opening, and eventually promoting everything
captured through the inbox.

The inbox transport is working; this plan covers what happens after capture:

```text
Telegram/manual drop → deterministic route → saved node/capture/run
                                      → list view → detail view → review/promote/archive
```

The UI should make inbox-captured material feel like first-class LLAAB knowledge, not a pile of
hidden markdown files.

## Vocabulary Direction

Current glossary terms already cover most of the domain:

| Term                | Use                                                                  |
| ------------------- | -------------------------------------------------------------------- |
| `node`              | Typed knowledge object stored in the lab                             |
| `resource`          | Useful external thing: article, repo, library, dataset, reference    |
| `source`            | Where knowledge originates                                           |
| `transcript`        | Structured source content, especially YouTube/spoken content         |
| `idea`              | Distilled insight captured from a source or generated during a run   |
| `skill`             | Reusable executable knowledge                                        |
| `run`               | Execution trace                                                      |
| `working vault`     | Volatile inspectable workspace for raw/generated knowledge           |
| `knowledge`         | Promoted, committed, stable layer                                    |
| `promoted artifact` | Mature output moved from working vault data into committed knowledge |

Added to `LLAAB_GLOSSARY.md` on 2026-07-09:

| Term           | Proposed meaning                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `capture`      | Something saved into LLAAB before deeper review, extraction, or promotion                            |
| `inbox item`   | The raw incoming envelope from Telegram/manual/etc., including text, attachments, source, timestamp  |
| `route kind`   | Deterministic classifier result such as `docs_link`, `code_snippet`, `image`, or `command_candidate` |
| `media asset`  | Saved binary/image/file payload associated with a capture                                            |
| `review state` | Human workflow state for a capture: new, reviewed, archived, promoted, failed                        |

Avoid using `artifact` for raw inbox material; the glossary already uses `promoted artifact` for
mature outputs in `knowledge/`.

## Design Principles

- Prefer a shared base list/detail architecture for inbox-derived objects.
- Let type-specific views wrap the shared shell when they need custom parsing, previews, or actions.
- Always provide a default renderer for unknown or unfinished route kinds.
- Unknown captures should render as useful fallback cards, never crash the UI.
- Keep transport separate from content type: Telegram is how something arrived, not what it is.
- Treat deterministic route kind as an initial classification, not an immutable final taxonomy.
- Make review/promote/archive actions explicit and reversible where possible.
- Do not add always-on background processors; any enrichment is user-triggered or one-shot.

## Phase 0 — Vocabulary and Data Contract

Purpose: make the UI nouns precise before building routes.

- [x] Add `capture` to `LLAAB_GLOSSARY.md` (2026-07-09).
- [x] Add `inbox item` to `LLAAB_GLOSSARY.md` (2026-07-09).
- [x] Add `route kind` to `LLAAB_GLOSSARY.md` (2026-07-09).
- [x] Add `media asset` to `LLAAB_GLOSSARY.md` (2026-07-09).
- [x] Add `review state` to `LLAAB_GLOSSARY.md` (2026-07-09).
- [x] Document the distinction between transport (`Telegram`) and stored content type
      (`resource`, `capture`, `media asset`, etc.) (2026-07-09).
- [x] Audit current saved inbox outputs and map each `HermesInboxRouteKind` to the node/capture
      shape it currently writes (2026-07-09).
- [x] Decide whether captures remain `IdeaNode`-backed for now or need a dedicated schema later
      (2026-07-09).

### Phase 0 audit — route kind → write shape (2026-07-09)

Entry path: Telegram/manual → `lab inbox` / MCP → `routeHermesInboxItem` → tool call → LLAAB API.

| `HermesInboxRouteKind` | Tool                       | API                            | Stored as                                  | Tags (beyond `hermes`, `inbox`)  | Body / payload notes                                     |
| ---------------------- | -------------------------- | ------------------------------ | ------------------------------------------ | -------------------------------- | -------------------------------------------------------- |
| `youtube_url`          | `vault_ingest_youtube`     | `POST /api/ingest/youtube`     | `transcript` (+ run)                       | (ingest tags)                    | No Hermes body JSON; receipt status `queued`             |
| `npm_package`          | `vault_pin_library`        | `POST /api/registry/pins`      | Registry pin (not a vault node)            | n/a                              | Pin name from package; status `pinned`                   |
| `todo`                 | `vault_capture_todo`       | `POST /api/vault/nodes`        | `idea` at `vault/nodes/ideas/`             | `inbox:todo`                     | Body JSON `route_kind`, `source`, optional `payload`     |
| `docs_link`            | `vault_capture_web_link`   | same                           | `idea`                                     | `inbox:link`, `inbox:docs`       | `payload.url` (+ label)                                  |
| `post_link`            | same                       | same                           | `idea`                                     | `inbox:link`, `inbox:post`       | same                                                     |
| `code_link`            | same                       | same                           | `idea`                                     | `inbox:link`, `inbox:code`       | same                                                     |
| `github_repo`          | `vault_pin_repository`     | `POST /api/registry/repo-pins` | Registry repository pin (not a vault node) | n/a                              | Pin full name from `payload.owner` / `repo`              |
| `web_link`             | same                       | same                           | `idea`                                     | `inbox:link`                     | `payload.url`                                            |
| `image`                | `vault_capture_attachment` | same                           | `idea`                                     | `inbox:image`                    | Binary stays in Hermes media cache; `local_path` in JSON |
| `code_attachment`      | same                       | same                           | `idea`                                     | `inbox:attachment`, `inbox:code` | same                                                     |
| `docs_attachment`      | same                       | same                           | `idea`                                     | `inbox:attachment`, `inbox:docs` | same                                                     |
| `attachment`           | same                       | same                           | `idea`                                     | `inbox:attachment`               | same                                                     |
| `command_candidate`    | `vault_capture_inbox`      | same                           | `idea`                                     | `inbox:raw` (today)              | `payload.command`; tag facet is coarse — UI uses body    |
| `code_snippet`         | same                       | same                           | `idea`                                     | `inbox:code`, `inbox:snippet`    | raw text + optional language hints in payload            |
| `raw`                  | same                       | same                           | `idea`                                     | `inbox:raw`                      | fallback capture                                         |

Provenance fields live in a fenced JSON block in the idea body (`route_kind`, `source.platform`,
`payload`) — not YAML frontmatter. `source.platform` is `telegram` \| `discord` \| `manual` \|
`unknown`. Execution receipt status (`queued` / `saved` / `pinned` / `failed`) is not persisted on
the node today. Registry-backed route kinds (`npm_package`, `github_repo`) currently create pins
instead of vault capture nodes, so `/vault/inbox` only shows them after separate provenance
cross-linking exists.

List API already supports inbox filtering: `GET /api/vault/nodes?tags=hermes,inbox` (and optional
`type`, `search`, `status`). Client `useVaultNodes` does not yet pass `tags`/`search` — Phase 1
extends that.

### Route action coverage (2026-07-10)

| Route kind          | Immediate action        | Current status | Follow-up                              |
| ------------------- | ----------------------- | -------------- | -------------------------------------- |
| `youtube_url`       | Start YouTube ingest    | Active         | Persist inbox → run provenance         |
| `npm_package`       | Pin package registry    | Active         | Persist inbox → package pin provenance |
| `github_repo`       | Pin repository registry | Active         | Persist inbox → repo pin provenance    |
| `todo`              | Save inbox capture      | Active         | Promote to task/reference later        |
| `docs_link`         | Save inbox capture      | Active         | Add docs extraction workflow           |
| `post_link`         | Save inbox capture      | Active         | Add article extraction workflow        |
| `code_link`         | Save inbox capture      | Active         | Extract first useful code block        |
| `web_link`          | Save inbox capture      | Active         | Improve deterministic categorization   |
| `image`             | Save media capture      | Active         | Add vault asset pipeline               |
| `code_attachment`   | Save media capture      | Active         | Promote snippets/references            |
| `docs_attachment`   | Save media capture      | Active         | Promote docs/skills/prompts            |
| `attachment`        | Save media capture      | Active         | Add attachment subtype routing         |
| `command_candidate` | Save safe reference     | Active         | Promote to command reference/skill     |
| `code_snippet`      | Save snippet capture    | Active         | Promote to knowledge/skill/reference   |
| `raw`               | Save fallback capture   | Active         | Review and reroute manually            |

### Schema decision (2026-07-09)

**Keep captures `IdeaNode`-backed for now.** Do not introduce a dedicated `CaptureNode` schema
until review/promote volume justifies it.

Rationale:

- Hermes already writes almost all drops as `type: idea` with stable `hermes`/`inbox` tags.
- YouTube and npm are intentional exceptions (`transcript` / registry pin) and should appear in
  inbox UI as related outcomes, not force a new node type.
- `route_kind` + transport provenance are recoverable from body JSON; UI parsers own that contract.
- Node `status` (`seed` / `growing` / `mature` / `archived`) is the generic lifecycle — **not**
  inbox triage. Phase 4 may add `review_state` via tags (e.g. `inbox:reviewed`) or an optional
  schema field later; do not overload `status`.

Exit criteria: route kinds, captures, resources, and inbox items have stable language before UI
work starts.

## Phase 1 — Base List/Detail Architecture

Purpose: create the reusable UI shell for every inbox-derived type.

- [x] Create a base inbox list route using the existing `PageLayout` + `PageHero` pattern
      (`/vault/inbox`, 2026-07-09).
- [x] Create a base inbox detail route using the existing `PageDetail` pattern
      (`/vault/inbox/:id`, 2026-07-09).
- [x] Use existing vault/node query patterns before adding new API shapes
      (`useVaultNodes({ tags: ['hermes', 'inbox'] })`, 2026-07-09).
- [x] Add a shared `InboxCaptureList` component for route-kind-aware rows (2026-07-09).
- [x] Add a shared `InboxCaptureDetail` component for route-kind-aware detail rendering
      (2026-07-09).
- [x] Add a registry/map from route kind or stored tags to renderer components
      (`inbox-capture-renderers.tsx`, 2026-07-09).
- [x] Add a default list row renderer for unknown route kinds (2026-07-09).
- [x] Add a default detail renderer for unknown route kinds (2026-07-09).
- [x] Show stable core metadata everywhere: title, route kind, status/review state, source platform,
      received timestamp, target node id, and receipt/result (receipt not persisted on nodes yet;
      status shown as node lifecycle, 2026-07-09).
- [x] Ensure default renderers can display raw body/frontmatter without throwing (2026-07-09).
- [x] Add empty, loading, error, and malformed-node states (2026-07-09).
- [x] Add Vault nav item for Inbox (`nav-menu.config.ts` + `NAV_MENU_DESIGN.md`, 2026-07-09).

Exit criteria: all current inbox captures can be listed and opened, even if a type-specific view
does not exist yet.

## Phase 2 — Filtering, Search, and Routing Facets

Purpose: make the list useful once captures accumulate.

- [x] Add route-kind filters:
      `youtube_url`, `npm_package`, `command_candidate`, `todo`, `github_repo`, `docs_link`,
      `post_link`, `code_link`, `code_snippet`, `web_link`, `image`, `code_attachment`,
      `docs_attachment`, `attachment`, `raw` (2026-07-09).
- [x] Add source-platform filter: Telegram, manual, Discord, unknown (2026-07-09).
- [x] Add status/review-state filter once review state exists (node `status` filter for now;
      dedicated review state still Phase 4, 2026-07-09).
- [x] Add text search across title, body, URL, file name, and route reason (2026-07-09).
- [x] Add date sorting by received/captured timestamp (2026-07-09).
- [x] Add grouped views by route kind (2026-07-09).
- [x] Add grouped views by source platform (2026-07-09).
- [x] Add a quick filter for failed/raw/unknown captures (2026-07-09).
- [x] Preserve filter state using URL search params (`kind`, `platform`, `status`, `q`, `sort`,
      `group`, `attention`, 2026-07-09).

Exit criteria: the inbox review page can answer "what came in?", "what failed?", and "what still
needs attention?" quickly.

## Phase 3 — Type-Specific Renderers

Purpose: improve beyond default fallback rendering for each important capture type.

### Resources and Links

- [x] Add `docs_link` detail renderer with URL, domain, path, title, tags, and future extraction
      actions (2026-07-09).
- [x] Add `post_link` detail renderer with article/blog-oriented labels (2026-07-09).
- [x] Add `github_repo` detail renderer with owner, repo, URL, and future repo-ingest actions
      (2026-07-09).
- [x] Add `web_link` generic fallback renderer (2026-07-09).
- [x] Add npm package/pinned-library cross-linking from inbox captures to registry/pinned views
      (2026-07-09).

### Code and Snippets

- [x] Add `code_snippet` detail renderer with language-labeled code block and copy action
      (monospace preview; no new highlighter dependency, 2026-07-09).
- [x] Add `code_link` detail renderer for GitHub blobs and docs/code-reference URLs (2026-07-09).
- [x] Add `code_attachment` detail renderer with file name, language, local path, and preview when
      text is available (2026-07-09).
- [x] Normalize JSX/JSX-like display language to `tsx` (2026-07-09).
- [x] Add copy/open actions where safe (2026-07-09).

### Media and Attachments

- [x] Add `image` renderer with thumbnail/preview, file metadata, and local path (2026-07-09).
- [x] Add `attachment` renderer for non-image files (2026-07-09).
- [x] Add `docs_attachment` renderer for Markdown/docs uploads (2026-07-09).
- [x] Separate visual labels for image, document, archive, and unknown file attachments
      (2026-07-09).
- [x] Avoid assuming Hermes media-cache paths are permanent until a vault assets pipeline exists
      (2026-07-09).

### Notes and Commands

- [x] Add `todo` detail renderer with concise note body and source metadata (2026-07-09).
- [x] Add `command_candidate` detail renderer for `npx`, `npmx`, and `pnpm dlx` references
      (2026-07-09).
- [x] Make command candidates clearly non-executable from Telegram captures (2026-07-09).
- [x] Add a future action placeholder for "promote to reference/skill/prompt" where appropriate
      (2026-07-09).

Exit criteria: common capture categories have useful, purpose-built detail views while unknown
types still fall back gracefully.

## Phase 4 — Review Workflow

Purpose: turn inbox review from passive browsing into a lightweight triage loop.

- [x] Add review states if the data model supports it: new, reviewed, archived, promoted, failed
      (tag convention `inbox:*` via `inbox-review.utils.ts` + `PATCH /api/vault/nodes/:id`,
      2026-07-09).
- [x] Add archive/unarchive action for captures that no longer need attention (2026-07-09).
- [x] Add mark-reviewed action (2026-07-09).
- [x] Add failed-capture view (attention filter `failed` + review-state filter, 2026-07-09).
- [x] Add "open target node" action when a capture produced a node/run/pin (2026-07-09).
- [x] Add "open source" action for URL-backed captures (2026-07-09).
- [x] Add "promote" placeholders for resources, snippets, docs, and skills (2026-07-09).
- [x] Add batch archive for reviewed captures (2026-07-09).
- [x] Add safe bulk action confirmations (`AlertDialog`, 2026-07-09).

Exit criteria: the user can clear the inbox without deleting useful captured knowledge.

## Phase 5 — AI-Assisted Categorization and Enrichment

Purpose: add intelligence only where deterministic routing is not enough.

- [x] Keep deterministic route kinds as the first pass (2026-07-09).
- [x] Add opt-in AI categorization for ambiguous captures (`InboxCaptureEnrichment`, 2026-07-09).
- [x] Suggest tags for links, attachments, snippets, and notes (2026-07-09).
- [x] Suggest whether a link is docs, post/article, repo, package, or generic resource
      (2026-07-09).
- [x] Suggest whether Markdown attachments are docs, skill drafts, prompts, instructions, or notes
      (2026-07-09).
- [ ] Extract first useful code block from arbitrary docs/blog/code-reference URLs
      (deferred — needs fetch/extract pipeline).
- [x] Infer code language beyond deterministic file extension/URL hints (LLM suggestion field,
      2026-07-09).
- [x] Suggest canonical destination: working vault, resource, skill, prompt, instruction,
      `knowledge/`, or archive (2026-07-09).
- [x] Log model usage and cost for enrichment actions (provider/model + token counts in UI,
      2026-07-09).
- [x] Never run enrichment automatically on casual inbox drops (2026-07-09).

Exit criteria: AI helps triage and enrich captures without increasing routine inbox cost.

## Phase 6 — Promotion Paths

Purpose: connect inbox captures to the larger vault/knowledge lifecycle.

- [x] Promote docs/post links to `ResourceNode` or the chosen resource shape
      (`POST /api/vault/nodes/resource` + promote UI, 2026-07-09).
- [x] Promote GitHub repos to resource records (resource_type `repo`; full repo ingestion still
      later, 2026-07-09).
- [ ] Promote useful code snippets into references, prompts, skills, or `knowledge/` as appropriate
      (placeholder only — dedicated destinations later).
- [ ] Promote Markdown docs attachments into the right destination after user confirmation
      (placeholder only).
- [x] Link promoted outputs back to their original inbox capture (`related` + `from-inbox:` /
      `to-resource:` tags, 2026-07-09).
- [x] Preserve provenance from Telegram/source message through promoted node/artifact (capture body + source capture id in resource body, 2026-07-09).
- [x] Coordinate with `TODO_VAULT_KNOWLEDGE_SPLIT.md` before writing to `knowledge/` (promote stays
      in working vault `resource` nodes only, 2026-07-09).

Exit criteria: inbox captures can mature into durable LLAAB knowledge without losing provenance.

## Phase 7 — Registry Pins as Knowledge Resources

Purpose: make curated package/repository pins available to agents as knowledge, not just UI
bookmarks.

Pinned packages and repositories are persistent registry records today. That is useful for manual
lookup, but not enough for LLAAB's knowledge loop: agents should be able to discover and recommend
pinned resources when they relate to extracted ideas, transcripts, topics, skills, or projects.

Target model:

```text
registry pin
  → resource node projection
  → inbox provenance / pin rationale
  → tags, topics, and relationships
  → retrievable agent/LLM context
```

- [x] Treat registry pins as curated resource signals, not merely bookmarks (2026-07-10).
- [x] Create or sync a `ResourceNode` for each pinned npm package on pin/duplicate-pin repair
      (2026-07-10).
- [x] Create or sync a `ResourceNode` for each pinned GitHub repository on pin/duplicate-pin repair
      (2026-07-10).
- [x] Keep the registry JSON stores as the fast pin/unpin source of truth for UI state
      (2026-07-10).
- [x] Make projected resource nodes the knowledge-graph participant for retrieval and relationships
      (2026-07-10).
- [x] Store package/repo metadata on projected resource nodes: name/full name, URL, description,
      ecosystem/language, version/stars/downloads, license, owner/author, and last refreshed time
      (2026-07-10).
- [ ] Preserve pin provenance when available: originating inbox item, source platform, message id,
      timestamp, route kind, and receipt/action result.
- [x] Add an explicit pin rationale field or body section for why this package/repo matters
      (2026-07-10).
- [x] Link projected resources back to the registry pin identity so unpin/update flows can find them
      (2026-07-10).
- [x] Add tags/topics to projected resources through deterministic metadata first, then optional
      AI-assisted enrichment later (2026-07-10).
- [ ] Connect projected resources to related ideas, transcripts, canonical ideas, skills, agents,
      and topic clusters.
- [ ] Include projected pinned resources in agent/LLM retrieval context.
- [ ] Add retrieval tests or smoke checks proving a topic with related ideas can surface a pinned
      package/repository without the user naming it.
- [x] Decide whether projected resources are updated automatically on pin refresh or via an explicit
      one-shot sync action (initial choice: sync during pin/duplicate-pin repair only, 2026-07-10).
- [x] Add UI cross-links for registry pin → resource node from package/repo detail sidebars
      (2026-07-10).
- [ ] Add resource node → registry detail cross-links.
- [ ] Add inbox item → pin/resource cross-links.
- [x] Show projection status in registry list views: `resource linked`, `needs sync`,
      `missing resource` (2026-07-10).

Exit criteria: a pinned package/repository can be recommended by LLAAB because it is connected to
the same knowledge graph as ideas, transcripts, topics, and skills.

## Phase 8 — Navigation and Information Architecture

Purpose: make the new views discoverable without cluttering the app.

- [x] Decide whether `/inbox` is a top-level route or grouped under Vault/Registry/Pipeline
      (`/vault/inbox` under Vault; matches vault session + node data, 2026-07-09).
- [x] Add nav entry only after the base list/detail route is useful (Vault → Inbox, 2026-07-09).
- [x] Cross-link captures from existing node detail pages when provenance is known
      (`Open inbox capture` on inbox-tagged nodes, 2026-07-09).
- [ ] Cross-link from pinned libraries to their originating inbox capture where available
      (deferred — pins are registry records without stable capture ids today).
- [ ] Cross-link from runs to the inbox item that triggered them where available
      (deferred — YouTube ingest produces transcripts/runs without capture envelope ids).
- [x] Add route handles/title metadata consistent with current router patterns (2026-07-09).
- [x] Keep page headings in the canonical `PageLayout` + `PageHero` pattern (2026-07-09).

Exit criteria: inbox review is easy to reach and connected to existing LLAAB surfaces.

## Phase 9 — Validation

Purpose: prove that the UI can handle current and future captures safely.

- [x] Seed/test with examples for every current `HermesInboxRouteKind` (unit coverage for parse +
      filter paths; live Telegram captures already in vault, 2026-07-09).
- [x] Verify all examples render in the base list (default renderer + live vault captures,
      2026-07-09).
- [x] Verify all examples open in detail view (type registry + fallback, 2026-07-09).
- [x] Verify unknown/malformed captures render fallback UI instead of errors (unit test +
      default detail, 2026-07-09).
- [x] Verify filters and search work on current Telegram test captures (URL params + filter util
      tests, 2026-07-09).
- [x] Verify archive/review state persists if implemented (tag PATCH API, 2026-07-09).
- [x] Verify route changes do not affect Telegram inbox capture behavior (UI/API only; no Hermes
      router edits, 2026-07-09).
- [x] Run focused TypeScript checks for touched packages/apps (2026-07-09).
- [x] Run focused UI tests if route/component test patterns exist
      (`inbox-capture.utils.test.ts`, 2026-07-09).
- [x] Run markdown lint for this TODO when updated (pre-commit md-lint, 2026-07-09).

Exit criteria: the inbox review UI is robust enough to become the default place to inspect inbox
drops.

## Later Ideas

- [ ] Add swipe/archive semantics for inbox items.
- [ ] Add routing previews before mutation for low-confidence items.
- [ ] Add article/docs extraction workflow.
- [ ] Add GitHub repo ingestion workflow.
- [ ] Add batch receipts for multiple links in one message.
- [ ] Add Siri Shortcuts / iOS Share Sheet shortcut that sends directly to Telegram bot.
- [ ] Add desktop menubar quick drop action.
- [ ] Add saved views such as "Needs Review", "Code", "Docs", "Media", and "Failed".
- [ ] Add timeline/activity view of inbox drops across transports.
