# TODO — Inbox Views and Review Workflows

> **Status:** Phase 0 complete (2026-07-09). Phases 1–8 not started.

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

| `HermesInboxRouteKind` | Tool                       | API                        | Stored as                       | Tags (beyond `hermes`, `inbox`)  | Body / payload notes                                     |
| ---------------------- | -------------------------- | -------------------------- | ------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `youtube_url`          | `vault_ingest_youtube`     | `POST /api/ingest/youtube` | `transcript` (+ run)            | (ingest tags)                    | No Hermes body JSON; receipt status `queued`             |
| `npm_package`          | `vault_pin_library`        | `POST /api/registry/pins`  | Registry pin (not a vault node) | n/a                              | Pin name from package; status `pinned`                   |
| `todo`                 | `vault_capture_todo`       | `POST /api/vault/nodes`    | `idea` at `vault/nodes/ideas/`  | `inbox:todo`                     | Body JSON `route_kind`, `source`, optional `payload`     |
| `docs_link`            | `vault_capture_web_link`   | same                       | `idea`                          | `inbox:link`, `inbox:docs`       | `payload.url` (+ label)                                  |
| `post_link`            | same                       | same                       | `idea`                          | `inbox:link`, `inbox:post`       | same                                                     |
| `code_link`            | same                       | same                       | `idea`                          | `inbox:link`, `inbox:code`       | same                                                     |
| `github_repo`          | same                       | same                       | `idea`                          | `inbox:link`, `inbox:github`     | `payload.owner` / `repo` / `url`                         |
| `web_link`             | same                       | same                       | `idea`                          | `inbox:link`                     | `payload.url`                                            |
| `image`                | `vault_capture_attachment` | same                       | `idea`                          | `inbox:image`                    | Binary stays in Hermes media cache; `local_path` in JSON |
| `code_attachment`      | same                       | same                       | `idea`                          | `inbox:attachment`, `inbox:code` | same                                                     |
| `docs_attachment`      | same                       | same                       | `idea`                          | `inbox:attachment`, `inbox:docs` | same                                                     |
| `attachment`           | same                       | same                       | `idea`                          | `inbox:attachment`               | same                                                     |
| `command_candidate`    | `vault_capture_inbox`      | same                       | `idea`                          | `inbox:raw` (today)              | `payload.command`; tag facet is coarse — UI uses body    |
| `code_snippet`         | same                       | same                       | `idea`                          | `inbox:code`, `inbox:snippet`    | raw text + optional language hints in payload            |
| `raw`                  | same                       | same                       | `idea`                          | `inbox:raw`                      | fallback capture                                         |

Provenance fields live in a fenced JSON block in the idea body (`route_kind`, `source.platform`,
`payload`) — not YAML frontmatter. `source.platform` is `telegram` \| `discord` \| `manual` \|
`unknown`. Execution receipt status (`queued` / `saved` / `pinned` / `failed`) is not persisted on
the node today.

List API already supports inbox filtering: `GET /api/vault/nodes?tags=hermes,inbox` (and optional
`type`, `search`, `status`). Client `useVaultNodes` does not yet pass `tags`/`search` — Phase 1
extends that.

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

- [ ] Create a base inbox list route using the existing `PageLayout` + `PageHero` pattern.
- [ ] Create a base inbox detail route using the existing `PageDetail` pattern.
- [ ] Use existing vault/node query patterns before adding new API shapes.
- [ ] Add a shared `InboxCaptureList` component for route-kind-aware rows.
- [ ] Add a shared `InboxCaptureDetail` component for route-kind-aware detail rendering.
- [ ] Add a registry/map from route kind or stored tags to renderer components.
- [ ] Add a default list row renderer for unknown route kinds.
- [ ] Add a default detail renderer for unknown route kinds.
- [ ] Show stable core metadata everywhere: title, route kind, status/review state, source platform,
      received timestamp, target node id, and receipt/result.
- [ ] Ensure default renderers can display raw body/frontmatter without throwing.
- [ ] Add empty, loading, error, and malformed-node states.

Exit criteria: all current inbox captures can be listed and opened, even if a type-specific view
does not exist yet.

## Phase 2 — Filtering, Search, and Routing Facets

Purpose: make the list useful once captures accumulate.

- [ ] Add route-kind filters:
      `youtube_url`, `npm_package`, `command_candidate`, `todo`, `github_repo`, `docs_link`,
      `post_link`, `code_link`, `code_snippet`, `web_link`, `image`, `code_attachment`,
      `docs_attachment`, `attachment`, `raw`.
- [ ] Add source-platform filter: Telegram, manual, Discord, unknown.
- [ ] Add status/review-state filter once review state exists.
- [ ] Add text search across title, body, URL, file name, and route reason.
- [ ] Add date sorting by received/captured timestamp.
- [ ] Add grouped views by route kind.
- [ ] Add grouped views by source platform.
- [ ] Add a quick filter for failed/raw/unknown captures.
- [ ] Preserve filter state using the existing persisted UI state pattern if useful.

Exit criteria: the inbox review page can answer "what came in?", "what failed?", and "what still
needs attention?" quickly.

## Phase 3 — Type-Specific Renderers

Purpose: improve beyond default fallback rendering for each important capture type.

### Resources and Links

- [ ] Add `docs_link` detail renderer with URL, domain, path, title, tags, and future extraction
      actions.
- [ ] Add `post_link` detail renderer with article/blog-oriented labels.
- [ ] Add `github_repo` detail renderer with owner, repo, URL, and future repo-ingest actions.
- [ ] Add `web_link` generic fallback renderer.
- [ ] Add npm package/pinned-library cross-linking from inbox captures to registry/pinned views.

### Code and Snippets

- [ ] Add `code_snippet` detail renderer with syntax-highlighted code where language is known.
- [ ] Add `code_link` detail renderer for GitHub blobs and docs/code-reference URLs.
- [ ] Add `code_attachment` detail renderer with file name, language, local path, and preview when
      text is available.
- [ ] Normalize JSX/JSX-like display language to `tsx`.
- [ ] Add copy/open actions where safe.

### Media and Attachments

- [ ] Add `image` renderer with thumbnail/preview, file metadata, and local path.
- [ ] Add `attachment` renderer for non-image files.
- [ ] Add `docs_attachment` renderer for Markdown/docs uploads.
- [ ] Separate visual labels for image, document, archive, and unknown file attachments.
- [ ] Avoid assuming Hermes media-cache paths are permanent until a vault assets pipeline exists.

### Notes and Commands

- [ ] Add `todo` detail renderer with concise note body and source metadata.
- [ ] Add `command_candidate` detail renderer for `npx`, `npmx`, and `pnpm dlx` references.
- [ ] Make command candidates clearly non-executable from Telegram captures.
- [ ] Add a future action placeholder for "promote to reference/skill/prompt" where appropriate.

Exit criteria: common capture categories have useful, purpose-built detail views while unknown
types still fall back gracefully.

## Phase 4 — Review Workflow

Purpose: turn inbox review from passive browsing into a lightweight triage loop.

- [ ] Add review states if the data model supports it: new, reviewed, archived, promoted, failed.
- [ ] Add archive/unarchive action for captures that no longer need attention.
- [ ] Add mark-reviewed action.
- [ ] Add failed-capture view.
- [ ] Add "open target node" action when a capture produced a node/run/pin.
- [ ] Add "open source" action for URL-backed captures.
- [ ] Add "promote" placeholders for resources, snippets, docs, and skills.
- [ ] Add batch archive for reviewed captures.
- [ ] Add safe bulk action confirmations.

Exit criteria: the user can clear the inbox without deleting useful captured knowledge.

## Phase 5 — AI-Assisted Categorization and Enrichment

Purpose: add intelligence only where deterministic routing is not enough.

- [ ] Keep deterministic route kinds as the first pass.
- [ ] Add opt-in AI categorization for ambiguous captures.
- [ ] Suggest tags for links, attachments, snippets, and notes.
- [ ] Suggest whether a link is docs, post/article, repo, package, or generic resource.
- [ ] Suggest whether Markdown attachments are docs, skill drafts, prompts, instructions, or notes.
- [ ] Extract first useful code block from arbitrary docs/blog/code-reference URLs.
- [ ] Infer code language beyond deterministic file extension/URL hints.
- [ ] Suggest canonical destination: working vault, resource, skill, prompt, instruction,
      `knowledge/`, or archive.
- [ ] Log model usage and cost for enrichment actions.
- [ ] Never run enrichment automatically on casual inbox drops.

Exit criteria: AI helps triage and enrich captures without increasing routine inbox cost.

## Phase 6 — Promotion Paths

Purpose: connect inbox captures to the larger vault/knowledge lifecycle.

- [ ] Promote docs/post links to `ResourceNode` or the chosen resource shape.
- [ ] Promote GitHub repos to resource/source records once repo ingestion exists.
- [ ] Promote useful code snippets into references, prompts, skills, or `knowledge/` as appropriate.
- [ ] Promote Markdown docs attachments into the right destination after user confirmation.
- [ ] Link promoted outputs back to their original inbox capture.
- [ ] Preserve provenance from Telegram/source message through promoted node/artifact.
- [ ] Coordinate with `TODO_VAULT_KNOWLEDGE_SPLIT.md` before writing to `knowledge/`.

Exit criteria: inbox captures can mature into durable LLAAB knowledge without losing provenance.

## Phase 7 — Navigation and Information Architecture

Purpose: make the new views discoverable without cluttering the app.

- [ ] Decide whether `/inbox` is a top-level route or grouped under Vault/Registry/Pipeline.
- [ ] Add nav entry only after the base list/detail route is useful.
- [ ] Cross-link captures from existing node detail pages when provenance is known.
- [ ] Cross-link from pinned libraries to their originating inbox capture where available.
- [ ] Cross-link from runs to the inbox item that triggered them where available.
- [ ] Add route handles/title metadata consistent with current router patterns.
- [ ] Keep page headings in the canonical `PageLayout` + `PageHero` pattern.

Exit criteria: inbox review is easy to reach and connected to existing LLAAB surfaces.

## Phase 8 — Validation

Purpose: prove that the UI can handle current and future captures safely.

- [ ] Seed/test with examples for every current `HermesInboxRouteKind`.
- [ ] Verify all examples render in the base list.
- [ ] Verify all examples open in detail view.
- [ ] Verify unknown/malformed captures render fallback UI instead of errors.
- [ ] Verify filters and search work on current Telegram test captures.
- [ ] Verify archive/review state persists if implemented.
- [ ] Verify route changes do not affect Telegram inbox capture behavior.
- [ ] Run focused TypeScript checks for touched packages/apps.
- [ ] Run focused UI tests if route/component test patterns exist.
- [ ] Run markdown lint for this TODO when updated.

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
