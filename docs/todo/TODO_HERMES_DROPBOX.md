# TODO — Hermes Dropbox Inbox

> **Status:** Phase 8 manual validation ready (2026-07-08). Telegram transport, deterministic
> routing, narrow MCP write tools, receipt formatting, route log events, the `lab inbox` one-shot
> executor, and the local Telegram dispatch bridge are wired. Remaining MVP risk is manual
> phone/desktop validation, with YouTube last because it starts the heavier ingest workflow.

## Goal

Add a zero-friction personal inbox for Hermes and LLAAB: send a bare link, file, screenshot, or
short note from phone or desktop, and have the system route it to the right LLAAB workflow with a
short receipt.

Target experience:

```text
Share URL/file/note → Hermes inbox gateway → deterministic router → LLAAB MCP/API tool
                                      → vault node / ingest run / pinned library / todo
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
| [`TODO_REGISTRY_LIBRARIES.md`](./TODO_REGISTRY_LIBRARIES.md) | Registry/library pinning direction for npm/npx-style links |
| [`NEXT_STEPS.md`](./NEXT_STEPS.md)                           | Near-term manual validation and follow-ups                 |

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
| `npmjs.com/package/...` URL | Pin/register library package                             |
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
| `vault_pin_library`        | Save npm/npx library as pinned registry/library   | Yes          |
| `vault_capture_todo`       | Store short todo note                             | Yes          |
| `vault_capture_web_link`   | Store blog/docs/GitHub URL pending later workflow | Yes          |
| `vault_capture_attachment` | Store file/screenshot metadata                    | Yes          |

- [x] Audit existing CLI MCP tool registration (2026-07-07).
- [x] Add `vault_capture_inbox` as the safe fallback write (2026-07-07).
- [x] Add or expose `vault_ingest_youtube` only after direct API surface review (2026-07-07).
- [x] Add or expose `vault_pin_library` for npm/npx-style links (2026-07-07).
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
Queued YouTube ingest: <title or video id>
Pinned library: npm <package>
Captured todo: <short title>
Saved to inbox: <raw item id>
```

- [x] Reply once per received item (2026-07-07).
- [x] Include the resulting vault node id or run id when available (2026-07-07).
- [x] Log route decisions in Hermes logs (2026-07-07).
- [x] Persist enough metadata to debug bad routes later (2026-07-07).
- [x] Avoid verbose summaries unless the user asks (2026-07-07).
- [x] Record failures as inbox items with `status: failed` or equivalent (2026-07-07).

Exit criteria: every inbox drop gets a short, useful receipt and leaves an audit trail.

## Phase 5 — YouTube and Library MVP

Purpose: ship the first useful dropbox behavior using currently viable workflows.

- [x] Add a one-shot `lab inbox "<message>"` executor for Hermes/Telegram wiring (2026-07-07).
- [x] Return a short failure receipt when `LLAAB_API_KEY` is not configured yet (2026-07-07).
- [x] Install matching `LLAAB_API_KEY` values in repo `.env` and `~/.hermes/.env` (2026-07-07).
- [x] Verify `lab inbox` can create a real inbox todo node through the API (2026-07-07).
- [x] Verify `lab inbox` can pin an npm package through the API (2026-07-07).
- [x] Verify MCP write tools can read `LLAAB_API_KEY` from local env files (2026-07-07).
- [ ] Telegram DM with YouTube URL starts the existing ingest pipeline.
- [x] Telegram DM with npm package URL creates a pinned library entry (2026-07-07).
- [ ] Telegram DM with `npx ...` or `npmx ...` captures a command/library candidate.
- [ ] Duplicate YouTube URLs follow existing dedupe behavior.
- [x] Duplicate library pins are idempotent in the inbox/MCP execution path (2026-07-07).
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
- [x] Capture `todo:` notes as typed todo nodes or inbox items tagged `todo` (2026-07-07).
- [ ] Add manual review UI/search path for raw inbox items.

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

- [ ] Send a YouTube URL.
- [x] Send an npm package URL (2026-07-07).
- [ ] Send an `npx` command note.
- [ ] Send an `npmx` command note.
- [ ] Send a GitHub repo URL.
- [ ] Send a docs/blog URL.
- [x] Send `todo: test Hermes dropbox` (2026-07-07).
- [ ] Send a screenshot.
- [ ] Send a small file.
- [ ] Confirm all receipts are short and useful.
- [ ] Confirm unknown inputs are captured, not dropped.
- [ ] Confirm unauthorized Telegram user is rejected.
- [ ] Confirm Discord operator console still works unchanged.

Exit criteria: Telegram works as a reliable LLAAB dropbox and Discord remains the agent console.

## Later Ideas

- [ ] Add an LLAAB Inbox page for reviewing raw/failed captures.
- [ ] Add swipe/archive semantics for inbox items.
- [ ] Add routing previews before mutation for low-confidence items.
- [ ] Add article/docs extraction workflow.
- [ ] Add GitHub repo ingestion workflow.
- [ ] Add batch receipts for multiple links in one message.
- [ ] Add Siri Shortcuts / iOS Share Sheet shortcut that sends directly to Telegram bot.
- [ ] Add desktop menubar quick drop action.
