# DONE — Hermes Dropbox Inbox

> **Completed:** 2026-07-09 — Telegram inbox/dropbox MVP shipped with deterministic routing,
> narrow write tools, short receipts, safe command-candidate capture, attachments, and manual
> validation complete.

## Goal

Add a zero-friction personal inbox for Hermes and LLAAB: send a bare link, file, screenshot, or
short note from phone or desktop, and have the system route it to the right LLAAB workflow with a
short receipt.

Target experience:

```text
Share URL/file/note → Hermes inbox gateway → deterministic router → LLAAB MCP/API tool
                                      → vault node / ingest run / pinned package / todo
```

Primary recommendation:

- **Telegram bot DM** for the dropbox inbox.
- **Discord** stays the Hermes operator console for coding tasks, threads, discussion, and
  approvals.

## Source Docs

| Doc                                                          | Role                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| [`TODO_HERMES_LAYER.md`](./TODO_HERMES_LAYER.md)             | Current Hermes phase plan, MCP boundary, cost controls     |
| [`docs/integrations/hermes.md`](../integrations/hermes.md)   | Live Hermes install/config facts                           |
| [`TODO_REGISTRY_LIBRARIES.md`](./TODO_REGISTRY_LIBRARIES.md) | Registry/package pinning direction for npm/npx-style links |
| [`TODO_INBOX_VIEWS.md`](./TODO_INBOX_VIEWS.md)               | Follow-up views, review flows, and richer routing          |
| [`ROADMAP.md#next`](./ROADMAP.md#next)                       | Near-term manual validation and follow-ups                 |

## Principles

- Inbox capture must be **faster than opening the LLAAB app**.
- Bare messages should work; no required prompt wrapper.
- Prefer deterministic routing over agent interpretation for known patterns.
- Use cheap/local routing for classification and receipts.
- Escalate to stronger models only for ambiguous, multi-source, or mutation-risk cases.
- LLAAB owns durable memory and writes; Hermes is the gateway/orchestrator.
- Do not add always-on workers inside `apps/server`; Hermes remains a separate long-running
  integration process.
- Unknown inputs should still be safely captured as raw inbox items.

## Phase 0 — Product Shape and Safety

Purpose: define the inbox behavior before wiring another messaging surface.

- [x] Confirm the first inbox integration is **Telegram bot DM** (2026-07-07).
- [x] Keep Discord as the existing operator console, not the primary dropbox (2026-07-07).
- [x] Defer any Discord `#inbox` fallback channel; Discord remains the operator console for the MVP
      (2026-07-08).
- [x] Define the default fallback behavior for unknown input: safe vault capture, not agent chat
      execution (2026-07-08).
- [x] Define the receipt style: one short confirmation with target/action/id (2026-07-08).
- [x] Confirm no inbox path can run shell commands or arbitrary file writes (2026-07-08).
- [x] Confirm inbox writes require `LLAAB_API_KEY` through MCP child env or server API only
      (2026-07-08).

Exit criteria: the inbox has a clear product contract and security boundary.

## Phase 1 — Message Surface Setup

Purpose: add the lowest-friction input channel.

- [x] Create a private Telegram bot for Hermes inbox use (2026-07-07).
- [x] Store Telegram token only in `~/.hermes/.env` (2026-07-07).
- [x] Restrict allowed Telegram user IDs to the owner account (2026-07-07).
- [x] Configure Hermes Telegram gateway support if available in the installed Hermes version
      (2026-07-07).
- [x] Confirm native Hermes Telegram support works; no thin local bridge needed yet (2026-07-07).
- [x] Document live Telegram config facts in `docs/integrations/hermes.md` without secrets
      (2026-07-07).
- [x] Verify a plain Telegram DM reaches Hermes or the bridge (2026-07-07).

Exit criteria: phone/desktop Telegram message can reach the local Hermes inbox path.

## Phase 2 — Inbox Router Contract

Purpose: make routing predictable and cheap.

Supported first-pass inputs:

| Input shape                 | Intended action                                          |
| --------------------------- | -------------------------------------------------------- |
| YouTube URL                 | Start YouTube ingestion                                  |
| `npmjs.com/package/...` URL | Pin/register package                                     |
| `npx ...` / `npmx ...` note | Capture command/library candidate                        |
| GitHub repo URL             | Capture repo candidate until repo workflow exists        |
| Blog/docs URL               | Capture web reference until article/docs workflow exists |
| File attachment             | Capture file reference until file pipeline exists        |
| Screenshot/photo attachment | Capture image reference until screenshot pipeline exists |
| `todo: ...` text            | Capture todo item                                        |
| Unknown text or URL         | Capture raw inbox item                                   |

- [x] Define a `HermesInboxItem` schema for raw incoming messages (2026-07-07).
- [x] Define a `HermesInboxRoute` result schema: `kind`, `confidence`, `action`, `payload`
      (2026-07-07).
- [x] Implement deterministic URL and prefix classifiers first (2026-07-07).
- [x] Reserve model classification for deterministic misses; current router falls back to raw
      capture without invoking a model (2026-07-07).
- [x] Add explicit routing for YouTube URLs (2026-07-07).
- [x] Add explicit routing for npm package URLs (2026-07-07).
- [x] Add explicit routing for `npx` / `npmx` command-like notes (2026-07-07).
- [x] Add explicit routing for `todo:` notes (2026-07-07).
- [x] Add fallback route for unknown inputs (2026-07-07).

Exit criteria: a message can be classified without invoking an expensive reasoning model in normal
known cases.

## Phase 3 — LLAAB Tool Surface

Purpose: expose only the write tools the inbox needs.

Candidate MCP/API tools:

| Tool                       | Purpose                                           | Required now |
| -------------------------- | ------------------------------------------------- | ------------ |
| `vault_capture_inbox`      | Store raw inbox item with metadata                | Yes          |
| `vault_ingest_youtube`     | Trigger existing YouTube ingestion pipeline       | Yes          |
| `vault_pin_package`        | Save npm/npx package as pinned registry package   | Yes          |
| `vault_capture_todo`       | Store short todo note                             | Yes          |
| `vault_capture_web_link`   | Store blog/docs/GitHub URL pending later workflow | Yes          |
| `vault_capture_attachment` | Store file/screenshot metadata                    | Yes          |

- [x] Audit existing CLI MCP tool registration (2026-07-07).
- [x] Add `vault_capture_inbox` as the safe fallback write (2026-07-07).
- [x] Add or expose `vault_ingest_youtube` only after direct API surface review (2026-07-07).
- [x] Add or expose `vault_pin_package` for npm/npx-style links (2026-07-07).
- [x] Add `vault_capture_todo` for `todo:` notes (2026-07-07).
- [x] Add `vault_capture_web_link` for blog/docs/GitHub URLs (2026-07-07).
- [x] Add `vault_capture_attachment` for file/screenshot metadata only (2026-07-07).
- [x] Keep tool allowlist narrow in `~/.hermes/config.yaml` (2026-07-07).
- [x] Do not expose terminal/file/browser tools to the inbox channel (2026-07-07).
- [x] Unit/smoke test each tool handler outside Telegram first (2026-07-07).

Exit criteria: the inbox router can call a minimal allowlisted LLAAB tool set.

## Phase 4 — Receipts and Observability

Purpose: make the inbox feel reliable without requiring follow-up questions.

Receipt examples:

```text
✅ Ingested YouTube video: <title or video id>
✅ Pinned npm package: <package>
✅ Captured todo: <short title>
✅ Saved inbox item: <raw item id>
❌ Failed YouTube ingest: <reason>
```

- [x] Reply once per received item (2026-07-07).
- [x] Include the resulting vault node id or run id when available (2026-07-07).
- [x] Log route decisions in Hermes logs (2026-07-07).
- [x] Persist enough metadata to debug bad routes later (2026-07-07).
- [x] Avoid verbose summaries unless the user asks (2026-07-07).
- [x] Record failures as inbox items with `status: failed` or equivalent (2026-07-07).
- [x] Use Hermes default Telegram reactions for progress: `eyes` while running, `thumbs up` on
      success, `thumbs down` on failure (2026-07-08).
- [x] Send one final explicit receipt message instead of an intermediate `Received...` message
      (2026-07-08).

Exit criteria: every inbox drop gets a short, useful receipt and leaves an audit trail.

## Phase 5 — YouTube and Library MVP

Purpose: ship the first useful dropbox behavior using currently viable workflows.

- [x] Add a one-shot `lab inbox "<message>"` executor for Hermes/Telegram wiring (2026-07-07).
- [x] Return a short failure receipt when `LLAAB_API_KEY` is not configured yet (2026-07-07).
- [x] Install matching `LLAAB_API_KEY` values in repo `.env` and `~/.hermes/.env` (2026-07-07).
- [x] Verify `lab inbox` can create a real inbox todo node through the API (2026-07-07).
- [x] Verify `lab inbox` can pin an npm package through the API (2026-07-07).
- [x] Verify MCP write tools can read `LLAAB_API_KEY` from local env files (2026-07-07).
- [x] Telegram DM with YouTube URL starts the existing ingest pipeline (2026-07-08).
- [x] Telegram DM with npm package URL creates a pinned package entry (2026-07-07).
- [x] Telegram DM with `npx ...` or `npmx ...` captures a command/library candidate
      (2026-07-09).
- [x] Route `pnpm dlx ...` as a safe command candidate rather than executing it (2026-07-09).
- [x] Retest Telegram DM with `pnpm dlx ...` after command-candidate routing fix (2026-07-09).
- [x] Add package pin support for `https://npmx.dev/package/{package}` URLs (2026-07-09).
- [x] Retest Telegram DM with `https://npmx.dev/package/{package}` after npmx.dev package URL
      support (2026-07-09).
- [x] Route GitHub repository URLs with `github_repo` metadata and GitHub-specific receipt text
      (2026-07-09).
- [x] Retest Telegram DM with a GitHub repo URL after GitHub-specific capture update (2026-07-09).
- [x] Add explicit `docs:` and `post:` URL prefixes for docs/article/blog captures (2026-07-09).
- [x] Retest Telegram DM with `docs:` and `post:` URL prefixes (2026-07-09).
- [x] Duplicate YouTube URLs follow existing dedupe behavior (2026-07-09).
- [x] Duplicate package pins are idempotent in the inbox/MCP execution path (2026-07-07).
- [x] Unknown generic links save as web-link inbox items instead of failing in the `lab inbox`
      executor (2026-07-08).
- [x] Receipts include the created/updated target when available (2026-07-07).

Exit criteria: the inbox is useful for YouTube and npm/npx captures from the phone.

## Phase 6 — Attachments and Notes

Purpose: broaden capture without overbuilding the processing pipelines.

- [x] Capture screenshots/photos as raw inbox attachment items in the `lab inbox` executor
      (2026-07-07).
- [x] Capture uploaded files as raw inbox attachment items in the `lab inbox` executor
      (2026-07-07).
- [x] Preserve cached filename, MIME type, size, local path, and source message timestamp
      (2026-07-07).
- [x] Keep binaries in the Hermes local media cache for now; store metadata/local path in the vault
      inbox item until a vault assets pipeline exists (2026-07-07).
- [x] Route screenshot/photo attachments as `image` captures with image-specific receipts and tags
      (2026-07-09).
- [x] Route `docs:` attachment captions as docs attachments with docs-specific receipts and tags
      (2026-07-09).
- [x] Route `code:` inputs as snippet/code captures for code files, GitHub blob URLs, code-reference
      links, and obvious pasted JSX/TSX snippets (2026-07-09).
- [x] Capture `todo:` notes as typed todo nodes or inbox items tagged `todo` (2026-07-07).
- [x] Defer manual review UI/search path to `TODO_INBOX_VIEWS.md` (2026-07-09).
- [x] Defer AI-assisted inbox categorization for links and attachments to `TODO_INBOX_VIEWS.md`
      (2026-07-09).
- [x] Defer AI-assisted snippet extraction from arbitrary docs/blog/code-reference links to
      `TODO_INBOX_VIEWS.md` (2026-07-09).

Exit criteria: files, screenshots, and short todo notes are never lost, even before specialized
pipelines exist.

## Phase 7 — Cost Controls

Purpose: keep casual inbox usage cheap.

- [x] Route deterministic classifications without LLM calls (2026-07-07).
- [x] Avoid model use for ambiguous classification in the MVP; deterministic misses fall back to
      capture (2026-07-08).
- [x] Reserve stronger remote models for later synthesis or risky mutation decisions; no current
      inbox route invokes them (2026-07-08).
- [x] Document model tier expectations in this plan: routing is deterministic and model-free for
      the MVP (2026-07-08).
- [x] Log deterministic inbox route decisions before execution (2026-07-07).
- [x] Define an acceptable smoke-test cost target: zero LLM calls for Phase 8 routing/manual
      validation, except any downstream YouTube extraction workflow the user intentionally starts
      (2026-07-08).

Exit criteria: routine inbox drops do not use the premium Hermes default model.

## Phase 8 — Manual Validation

Run these from phone and desktop once the MVP is wired:

- [x] Send a YouTube URL (2026-07-08).
- [x] Send an npm package URL (2026-07-07).
- [x] Send an `npx` command note (2026-07-09).
- [x] Send an `npmx` command note (2026-07-09).
- [x] Send a `pnpm dlx` command note after routing fix (2026-07-09).
- [x] Send a GitHub repo URL after GitHub-specific capture update (2026-07-09).
- [x] Send a docs/blog URL with `docs:` or `post:` prefix (2026-07-09).
- [x] Send `todo: test Hermes dropbox` (2026-07-07).
- [x] Send a screenshot (2026-07-09).
- [x] Send a small file (2026-07-09).
- [x] Confirm all receipts are short and useful (2026-07-08).
- [x] Confirm unknown inputs are captured, not dropped (2026-07-09).
- [x] Confirm unauthorized Telegram user is rejected (2026-07-09).
- [x] Confirm Discord operator console still works unchanged (2026-07-09).

Exit criteria: Telegram works as a reliable LLAAB dropbox and Discord remains the agent console.

## Follow-Up

The MVP is complete. Follow-up product work is tracked in
[`TODO_INBOX_VIEWS.md`](./TODO_INBOX_VIEWS.md).
