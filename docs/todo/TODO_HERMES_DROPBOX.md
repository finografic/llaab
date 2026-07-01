# TODO — Hermes Dropbox Inbox

> **Status:** Not started.

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

- [ ] Confirm the first inbox integration is **Telegram bot DM**.
- [ ] Keep Discord as the existing operator console, not the primary dropbox.
- [ ] Decide whether Discord gets a later `#inbox` fallback channel.
- [ ] Define the default fallback behavior for unknown input: raw inbox capture.
- [ ] Define the receipt style: one short confirmation with target/action/id.
- [ ] Confirm no inbox path can run shell commands or arbitrary file writes.
- [ ] Confirm inbox writes require `LLAAB_API_KEY` through MCP child env or server API only.

Exit criteria: the inbox has a clear product contract and security boundary.

## Phase 1 — Message Surface Setup

Purpose: add the lowest-friction input channel.

- [ ] Create a private Telegram bot for Hermes inbox use.
- [ ] Store Telegram token only in `~/.hermes/.env`.
- [ ] Restrict allowed Telegram user IDs to the owner account.
- [ ] Configure Hermes Telegram gateway support if available in the installed Hermes version.
- [ ] If Hermes lacks Telegram support, add a thin local Telegram bridge process outside
      `apps/server`.
- [ ] Document live Telegram config facts in `docs/integrations/hermes.md` without secrets.
- [ ] Verify a plain Telegram DM reaches Hermes or the bridge.

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

- [ ] Define a `HermesInboxItem` schema for raw incoming messages.
- [ ] Define a `HermesInboxRoute` result schema: `kind`, `confidence`, `action`, `payload`.
- [ ] Implement deterministic URL and prefix classifiers first.
- [ ] Use model classification only when deterministic rules return ambiguous.
- [ ] Add explicit routing for YouTube URLs.
- [ ] Add explicit routing for npm package URLs.
- [ ] Add explicit routing for `npx` / `npmx` command-like notes.
- [ ] Add explicit routing for `todo:` notes.
- [ ] Add fallback route for unknown inputs.

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
| `vault_capture_todo`       | Store short todo note                             | Soon         |
| `vault_capture_web_link`   | Store blog/docs/GitHub URL pending later workflow | Soon         |
| `vault_capture_attachment` | Store file/screenshot metadata                    | Later        |

- [ ] Audit existing CLI MCP tool registration.
- [ ] Add `vault_capture_inbox` as the safe fallback write.
- [ ] Add or expose `vault_ingest_youtube` only after direct API smoke test.
- [ ] Add or expose `vault_pin_library` for npm/npx-style links.
- [ ] Keep tool allowlist narrow in `~/.hermes/config.yaml`.
- [ ] Do not expose terminal/file/browser tools to the inbox channel.
- [ ] Unit/smoke test each tool handler outside Telegram first.

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

- [ ] Reply once per received item.
- [ ] Include the resulting vault node id or run id when available.
- [ ] Log route decisions in Hermes logs.
- [ ] Persist enough metadata to debug bad routes later.
- [ ] Avoid verbose summaries unless the user asks.
- [ ] Record failures as inbox items with `status: failed` or equivalent.

Exit criteria: every inbox drop gets a short, useful receipt and leaves an audit trail.

## Phase 5 — YouTube and Library MVP

Purpose: ship the first useful dropbox behavior using currently viable workflows.

- [ ] Telegram DM with YouTube URL starts the existing ingest pipeline.
- [ ] Telegram DM with npm package URL creates a pinned library entry.
- [ ] Telegram DM with `npx ...` or `npmx ...` captures a pinned command/library candidate.
- [ ] Duplicate YouTube URLs follow existing dedupe behavior.
- [ ] Duplicate library pins are idempotent.
- [ ] Unknown links save as raw inbox items instead of failing.
- [ ] Receipts include the created/updated target.

Exit criteria: the inbox is useful for YouTube and npm/npx captures from the phone.

## Phase 6 — Attachments and Notes

Purpose: broaden capture without overbuilding the processing pipelines.

- [ ] Capture screenshots/photos as raw inbox attachment items.
- [ ] Capture uploaded files as raw inbox attachment items.
- [ ] Preserve original filename, MIME type, size, and source message timestamp.
- [ ] Decide whether binaries live in vault assets, an inbox attachments folder, or app storage.
- [ ] Capture `todo:` notes as typed todo nodes or inbox items tagged `todo`.
- [ ] Add manual review UI/search path for raw inbox items.

Exit criteria: files, screenshots, and short todo notes are never lost, even before specialized
pipelines exist.

## Phase 7 — Cost Controls

Purpose: keep casual inbox usage cheap.

- [ ] Route deterministic classifications without LLM calls.
- [ ] Use local/cheap model only for ambiguous classification.
- [ ] Use stronger remote models only for synthesis or risky mutation decisions.
- [ ] Add config comments documenting model tier expectations.
- [ ] Log when an inbox item escalates beyond deterministic routing.
- [ ] Define an acceptable smoke-test cost target.

Exit criteria: routine inbox drops do not use the premium Hermes default model.

## Phase 8 — Manual Validation

Run these from phone and desktop once the MVP is wired:

- [ ] Send a YouTube URL.
- [ ] Send an npm package URL.
- [ ] Send an `npx` command note.
- [ ] Send an `npmx` command note.
- [ ] Send a GitHub repo URL.
- [ ] Send a docs/blog URL.
- [ ] Send `todo: test Hermes dropbox`.
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
