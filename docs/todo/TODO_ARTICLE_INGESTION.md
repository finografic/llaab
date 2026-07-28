# TODO — Article Ingestion

> **Status:** In progress. Planning complete (2026-07-28); execution started 2026-07-28.

## Goal

Add a bounded, one-shot path that accepts one public article URL, saves the readable article as a
provenance-rich `ResourceNode`, and then best-effort extracts ideas from the already-saved content.
The same path must work from the existing ingest form and from explicit Hermes `docs:` / `post:`
captures.

The first useful outcome is:

```text
article URL
  → bounded fetch
  → readable Markdown
  → publication SourceNode + article ResourceNode
  → best-effort idea extraction
  → searchable vault evidence
```

## Execution Conventions

- Mark each checkbox `[x]` in this file as the item lands; do not batch-mark at the end.
- Commit once per completed phase, using `feat(ingestion): …` / `feat(server): …` style scopes plus a
  `docs(todo): mark phase N complete` update to this file in the same commit.
- Focused test command: `pnpm vitest run <path>` (root `vitest` workspace). Typecheck a single
  package with `pnpm --filter @llaab/<pkg> typecheck`.
- Formatting: `pnpm format:fix` on touched files; `pnpm format:check` once before branch handoff.
- Do not rebuild the whole workspace between phases. Only run `./scripts/macos/dev-refresh.sh` once
  Phase 4+ changes reach `apps/server` or server-consumed packages.

## File Map

Expected owning files per phase. Anything outside this list is a scope expansion and needs a reason.

| Phase | Files                                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `packages/ingestion/src/fetch/article/__fixtures__/*.html`, `article.contract.ts`, `article.limits.ts`, `article.url.ts` (+ tests)                                         |
| 1     | `packages/ingestion/src/fetch/article/fetch-article.ts`, `article.parse.ts`, `article.markdown.ts`, `index.ts` (+ tests); delete `packages/ingestion/src/fetch/article.ts` |
| 2     | `packages/ingestion/src/pipeline.ts` (article branch → `create-article-nodes.ts`), `packages/schemas/src/resource-node.schema.ts`                                          |
| 3     | `packages/ingestion/src/pipeline.ts` (extraction primitive), `packages/skills/src/ingest-article.ts`, `packages/skills/src/index.ts`                                       |
| 4     | `apps/server/src/routes/ingest.{schema,routes}.ts`, run retry route, `packages/cli` MCP schema/server, discard/run-deletion service                                        |
| 5     | `apps/client/src/forms/IngestForm/**`, `apps/client/src/queries/**`, `RunMonitor`, `RunsTable`, run display helpers                                                        |
| 6     | Hermes route/tool contracts (`docs/integrations/hermes.md` + Hermes repo-side config), inbox provenance wiring                                                             |

## Current Baseline

- `runIngestionPipeline({ sourceType: 'article' })` exists, but
  `packages/ingestion/src/fetch/article.ts` returns placeholder text.
- The article branch creates a `ResourceNode` and runs one LLM extraction only to populate its
  description; it does not use the durable save-first / extract-second skill lifecycle.
- There is no `ingestArticle` skill, `POST /api/ingest/article` route, retry support, or article MCP
  tool.
- `IngestForm` classifies ordinary HTTP(S) URLs as `webpage`, but deliberately disables submission.
- Hermes `docs:` and `post:` inputs are safely captured as inbox links through
  `vault_capture_web_link`; they are not ingested.
- `ResourceNode` already supports `resource_type: article`, `url`, `source_id`, `description`, and
  inherited `related` references.
- `TranscriptSourceTypeSchema` also contains `article`, but an article is not a transcript. This
  plan keeps article content in `ResourceNode` and generalizes only the proven lifecycle boundary.

## Product Decisions

- Ingest exactly one explicitly supplied URL per trigger. No crawl, feed scan, watcher, scheduler,
  or automatic linked-page traversal.
- Store the readable article as a `ResourceNode`, not a `TranscriptNode`.
- Save the article before any LLM call. Extraction failure must leave the fetched article readable,
  searchable, retryable, and discardable.
- Use deterministic HTML parsing for article content and metadata. Do not ask an LLM to clean HTML.
- Use the final canonical URL as durable identity when available; retain the originally requested
  URL as provenance.
- Reuse an existing article for the same canonical URL. Refreshing an existing article is a later
  explicit action under Source Auto-Follow, not implicit ingest behavior.
- Keep generic unprefixed Hermes links as safe inbox captures. Only explicit `docs:` and `post:`
  routes auto-start article ingestion.
- Preserve the originating inbox capture and relate it to the article/run. Do not replace or delete
  the capture after success.
- Keep remote PDF, Office, image-only, paywalled, authenticated, and JavaScript-only pages out of
  scope. They need different parsing or access contracts.

## Fetch and Safety Contract

The fetcher must enforce these limits in one owning module, with constants covered by tests:

| Concern         | Required behavior                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Protocol        | Accept `http:` and `https:` input; require `https:` after redirects unless the original site cannot upgrade |
| URL credentials | Reject URLs containing a username or password                                                               |
| Network targets | Reject localhost, loopback, private, link-local, multicast, and reserved IP ranges                          |
| DNS             | Resolve the hostname and reject the request if any resolved address is disallowed                           |
| Redirects       | Follow manually, revalidating every target; maximum 5 redirects                                             |
| Timeout         | Abort the complete fetch after 20 seconds                                                                   |
| Response size   | Reject bodies larger than 5 MiB while streaming; do not trust `Content-Length` alone                        |
| Content type    | Accept HTML/XHTML only; report PDFs and other document types as unsupported                                 |
| User agent      | Send a stable LLAAB user agent and normal HTML `Accept` header                                              |
| Article text    | Require at least 200 non-whitespace characters after readability extraction                                 |
| Stored content  | Cap normalized Markdown at 500,000 characters and report truncation in metadata                             |
| Errors          | Return typed, operator-safe failure codes without embedding response bodies or secrets                      |

DNS validation must happen immediately before each request, including redirects. Tests must cover
IPv4 and IPv6 loopback/private targets, redirect-to-private targets, oversized streamed responses,
timeouts, unsupported MIME types, and malformed HTML.

## Article Contract

Replace the string return from `fetchArticle` with a typed result:

```ts
interface FetchedArticle {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  publishedAt?: string;
  language?: string;
  markdown: string;
  plainText: string;
  contentHash: string;
  truncated: boolean;
}
```

Typed failures are a discriminated result, never a thrown string. The failure code set is closed:

```ts
type ArticleFetchFailureCode =
  | 'invalid_url' // unparseable, non-http(s), or credentials embedded
  | 'blocked_target' // localhost/loopback/private/link-local/multicast/reserved after DNS
  | 'insecure_redirect' // downgrade to http: across a redirect
  | 'too_many_redirects'
  | 'timeout'
  | 'network_error'
  | 'http_error' // non-2xx; carries status only, never the body
  | 'unsupported_content_type' // PDF, Office, image, JSON, …
  | 'response_too_large'
  | 'not_readable'; // parsed, but under the minimum article-text threshold

interface ArticleFetchFailure {
  ok: false;
  code: ArticleFetchFailureCode;
  message: string; // operator-safe; no response bodies, headers, or secrets
  requestedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
}
```

`fetchArticle` returns `{ ok: true } & FetchedArticle | ArticleFetchFailure`. Callers map the code to
a run-event message; the skill never surfaces raw exception text to the UI.

Implementation direction:

- Parse HTML with a server-safe DOM adapter.
- Use `@mozilla/readability` for the primary article selection.
- Convert the selected article HTML to Markdown with `turndown`.
- Normalize whitespace, links, headings, images, and tracking parameters deterministically.
- Resolve metadata in this order: Readability result, Open Graph/article metadata, standard HTML
  metadata, then safe hostname/title fallbacks.
- Resolve relative links against `finalUrl`.
- Remove scripts, styles, forms, navigation, cookie banners, and non-content embeds.
- Compute `contentHash` from normalized `plainText`, not raw HTML.

Dependency choice should be confirmed with a small fixture spike before the implementation phase.
The preferred stack is `@mozilla/readability`, `linkedom`, and `turndown`; do not introduce a
headless browser for the MVP.

Install into `@llaab/ingestion` only (it currently has no DOM dependency):

```bash
pnpm --filter @llaab/ingestion add @mozilla/readability linkedom turndown
pnpm --filter @llaab/ingestion add -D @types/turndown
```

**Phase 0 spike outcome (2026-07-28): `linkedom` confirmed.** Both `linkedom` and `jsdom` were run
against all eight fixtures with Readability; extracted text was byte-identical on every fixture that
yields an article, and both returned `null` on the same two that do not. `linkedom` imported in ~72 ms
versus ~419 ms and parsed a 97 KB document in ~6 ms versus ~40 ms, with no native bindings. `jsdom`
was installed for the comparison and removed. Two findings fed back into the implementation:

- Turndown must be configured with `bulletListMarker: '-'`; its default `*` does not match the
  Markdown style used elsewhere in the vault.
- Readability reads `document.baseURI` / `documentURI` to resolve relative references, and `linkedom`
  does not derive them from a response. The parser must define both from `finalUrl` before parsing,
  or every relative link is stored unresolved.

An unclosed `<title>` is _not_ a parser deficiency to work around: title content is RCDATA, so a
conforming parser (browsers, `jsdom`, and `linkedom` alike) treats the rest of the document as title
text and reports an empty body. That page is a legitimate `not_readable` failure and has its own
fixture.

## Persistence Contract

### Publication `SourceNode`

Create or reuse one publication source keyed by normalized site origin:

- `type: source`
- `source_kind: publication`
- title from `siteName`, falling back to hostname
- canonical site origin in `url`
- `platforms: ['website']`
- one primary `website` profile
- `related` includes ingested article IDs

An existing source must be updated idempotently without replacing richer reviewed metadata.

### Article `ResourceNode`

Persist:

- `type: resource`
- `resource_type: article`
- title from fetched metadata unless the operator supplied an override
- `url` as canonical URL
- `source_id` as the publication source
- `description` from deterministic excerpt first, then the extraction summary when extraction
  succeeds
- tags containing `d:ingest`, deterministic auto-tags, manual tags, and Hermes provenance tags
- `related` containing the originating inbox capture ID when applicable

Extend `ResourceNodeSchema` only for article provenance that cannot be represented by existing base
fields:

- `requested_url`
- `author`
- `site_name`
- `source_published_at`
- `fetched_at`
- `content_hash`
- `content_truncated`

Store the body as readable Markdown:

```text
# Article title

[canonical source URL]
author / published / fetched metadata when known

## Article

cleaned article content
```

Do not store raw HTML in the node body. Raw-response archival is outside this phase.

## Extraction Boundary

Generalize `extractKnowledgeFromTranscript` into a saved-node extraction primitive that accepts a
node ID, node path, plain text, and manual tags. Keep the transcript-named export as a compatibility
wrapper so YouTube and podcast behavior does not change.

The generalized primitive must:

- update summary/tags/LLM trace fields on either a transcript or resource
- create `IdeaNode`s with `source_id` and `related` pointing to the saved source node
- write extracted idea IDs back to the saved source node
- return a source-neutral result shape while preserving the existing transcript result contract
- remain best-effort after persistence

Article-derived ideas become searchable vault evidence immediately. Promotion through the current
canonical-idea/wiki workflow remains transcript-oriented and is not broadened in this phase; that
requires a separate generic evidence-reference decision.

## Phase 0 — Fixtures and Contracts

- [x] Add representative local HTML fixtures: semantic article, Open Graph-only metadata,
      relative links, noisy navigation, malformed HTML, unterminated title, no readable article, and
      redirect target. Oversized bodies and unsupported content types are response-level conditions
      with no HTML to fixture; they are synthesized in the Phase 1 fetch tests.
- [x] Add the `FetchedArticle` contract and typed fetch failure codes.
- [x] Add centralized article fetch limits and URL/network validation helpers.
- [x] Confirm the Readability/DOM/Markdown dependency stack against the fixtures.
- [x] Record canonical URL normalization and the network-target policy in tests.
- [ ] Record the exact metadata precedence and truncation behavior in tests — deferred to Phase 1,
      where the parser that owns both actually exists. Phase 0 pinned the inputs those rules read.

Exit criteria: article extraction and safety behavior are deterministic without live network calls.
**Met.** 36 tests across `article.url.test.ts`, `article.limits.test.ts`, and
`article.stack-spike.test.ts`; no network access, no vault writes.

## Phase 1 — Bounded Fetch and Parse

- [x] Replace the placeholder `fetchArticle` implementation with bounded fetch, redirect
      validation, streamed size enforcement, and content-type checks.
- [x] Extract title, byline, site, canonical URL, publication date, language, excerpt, readable
      HTML, plain text, and normalized Markdown.
- [x] Resolve relative links and remove unsafe/non-content elements.
- [x] Add focused unit tests for successful parsing and every fetch/safety failure mode.
- [x] Keep all fetch tests fixture-backed; add at most one opt-in live smoke script outside CI
      (`smoke-fetch-article.ts`, run manually with a URL argument).
- [x] Record metadata precedence and truncation behavior in tests (carried over from Phase 0).

Exit criteria: one public article URL produces a bounded, typed, readable result or a useful typed
failure. **Met.** 114 tests pass in `@llaab/ingestion`.

Notes:

- A canonical link is only trusted when it is absolute and same-host as the response. A cross-host
  canonical is a syndication/SEO artefact, so the response URL stays the identity.
- Testing surfaced a leak: a rejected URL carrying credentials was echoed back on the failure and
  would have reached run events. `articleFetchFailure` now redacts userinfo from every URL it stores.
- The package targets Node without the DOM lib, so the parser types against `linkedom`'s document
  type rather than browser globals.
- `createResourceNode` still backs the article branch of `runIngestionPipeline` as an interim
  shortcut, now fed real Markdown. Phase 2 replaces it. The repo branch is untouched.

## Phase 2 — Save-First Article Pipeline

- [ ] Replace the current article `createResourceNode` shortcut with a dedicated article pipeline.
      `createResourceNode` is shared with `sourceType: 'repo'`; leave the repo branch (and the
      `fetchRepo` placeholder) working exactly as-is rather than deleting the shared helper.
- [x] Add canonical-URL deduplication and deterministic content hashing.
- [x] Create/reuse the publication `SourceNode`.
- [x] Save the article `ResourceNode` before extraction begins.
- [x] Return title, source ID, canonical URL, plain text, produced node IDs, reuse state, and
      fetch/store stages in `IngestionResult`.
- [x] Add tests for first ingest, duplicate reuse, source reuse, metadata persistence, and no
      partial nodes after fetch failure.

Exit criteria: article and publication nodes are durable and provenance-linked before any LLM call.
**Met.** 174 tests pass across `@llaab/ingestion` and `@llaab/schemas`.

Notes:

- Tests mock `@llaab/core` rather than writing to a temp vault, matching the existing
  `pipeline.test.ts` convention. The intent — no writes to the real vault — is satisfied either way,
  and one convention beats two.
- Dedupe matches on canonical URL **or** content hash, so an article that moves to a new URL is still
  recognized.
- The publication source is created first and the article second, because the article carries
  `source_id`. The source's `related` list is then appended to, never rewritten, so reviewed metadata
  on an existing source survives.
- `@llaab/schemas` and `@llaab/core` are consumed through TypeScript project references, which
  resolve via `dist`. Schema changes require `pnpm --filter @llaab/schemas build` before dependent
  packages typecheck.
- `createResourceNode` and the `repo` branch are untouched.

## Phase 3 — Generalized Extraction and Skill

- [x] Add the source-neutral saved-node extraction primitive (`extractKnowledgeFromNode`) and retain
      `extractKnowledgeFromTranscript` as a compatibility wrapper.
- [x] Add `packages/skills/src/ingest-article.ts` using `runSkill('ingest-article', ...)`.
- [x] Emit run events for fetch, parse, article save, extraction start, extraction success, and
      extraction warning/failure.
- [x] Append the article, publication, and extracted idea IDs to the run's produced node IDs.
- [x] Preserve the saved article and completed run evidence when idea extraction fails.
- [x] Add skill tests for success, dedupe, `skipExtraction`, and extraction failure.
- [x] Verify YouTube and podcast extraction tests remain unchanged and passing.

Exit criteria: article ingestion is durable, globally observable, and retryable after navigation.
**Met** for the skill layer. Retry dispatch itself is Phase 4. Full repo green: 554 tests, all
package typechecks, lint, and format.

Notes:

- **Zod strips unknown keys.** `ResourceNode` has no `summary` field, so the generalized primitive
  writes `description` for resources and `summary` for everything else. Without that branch the
  article summary would have been silently discarded on write — no error, just missing data.
  `ResourceNode` also gained the `llm_*` trace fields for the same reason.
- `ExtractionResult` now extends the source-neutral `SavedNodeExtractionResult` and keeps
  `transcriptId`, so no existing caller changed.
- `ingest-article` gets a 30-minute stale-run budget: a bounded 20s fetch plus one extraction pass.
- Turndown's typings only accept HTML tag names, so `svg` is removed via a filter function. This only
  surfaced in the client typecheck, which compiles this source with the DOM lib enabled.

## Phase 4 — Server, Retry, and MCP

- [ ] Add `ingestArticleBodySchema` with `url`, optional `title`, optional `tags`, optional
      `skipExtraction`, and optional inbox provenance.
- [ ] Add a thin `POST /api/ingest/article` route that calls the article skill.
- [ ] Export `ingestArticle` through `@llaab/skills`.
- [ ] Add `vault_ingest_article` to the MCP schema and server using the same authenticated API
      boundary as other ingest tools.
- [ ] Generalize `POST /api/runs/:id/retry` to dispatch `ingest-article`.
- [ ] Ensure discard/run deletion handles article resources, publication sources, and extracted
      ideas without deleting shared publication sources still referenced by other articles.
- [ ] Add route, MCP, retry, and produced-node cleanup tests.

Exit criteria: the API and MCP paths share one skill and one persistence contract.

## Phase 5 — Ingest Form and Run Surfaces

- [ ] Make `webpage` an ingestible source kind and add an article mutation hook.
- [ ] Update detected copy, button labels, URL placeholder, queue behavior, and drop-submit behavior
      for articles.
- [ ] Generalize transcript-specific form state/copy to source/content language where article runs
      share the UI.
- [ ] Recognize `ingest-article` in `RunMonitor`, pipeline cards, run display helpers, retry controls,
      and Runs table grouping.
- [ ] Clear the URL field when the durable article run finishes, matching YouTube/podcast behavior.
- [ ] Keep the existing `/ingest` page as the canonical UI; update the stale `/ingest/article`
      navigation target rather than creating a duplicate form.
- [ ] Add focused client tests for classification, submission, queueing, durable-run hydration, and
      completed-form reset.

Exit criteria: paste/drop of an article URL behaves like the existing durable ingest flows without
calling it a transcript.

## Phase 6 — Hermes Docs/Post Integration

- [ ] Add `ingest_article` and `vault_ingest_article` to the Hermes route/tool contracts.
- [ ] Keep unprefixed generic web links on `capture_web_link`.
- [ ] For explicit `docs:` and `post:` URLs, first preserve the existing inbox capture, then start
      article ingestion with that capture ID as provenance.
- [ ] Relate the inbox capture, article resource, publication source, and run without duplicating
      article content in the capture.
- [ ] Return a short receipt using the fetched article title on success.
- [ ] If fetch or parse fails, retain the inbox capture and mark/report the ingestion failure; never
      drop the original link.
- [ ] Add deterministic router, tool-call, CLI execution, receipt, and failure-retention tests.

Exit criteria: explicit Telegram/Hermes article captures become searchable article resources while
remaining auditable from the inbox.

## Phase 7 — Validation and Graduation

- [ ] Run focused tests and typechecks for `@llaab/schemas`, `@llaab/core`,
      `@llaab/ingestion`, `@llaab/skills`, CLI/MCP, server ingest routes, and the client ingest form.
- [ ] Run one real article from `/ingest` and confirm title, readable Markdown, publication source,
      run stages, extracted ideas, search visibility, dedupe, retry, and discard behavior.
- [ ] Run one real `docs:` or `post:` Telegram capture and confirm the inbox item is retained and
      linked to the resulting article.
- [ ] Confirm a blocked/private URL, PDF URL, oversized response, timeout, and unreadable page fail
      with useful messages and no orphaned article nodes.
- [ ] Trigger Rebuild & Reload App after server/package changes, then verify the durable run survives
      navigation.
- [ ] Run touched-file format/lint checks and `pnpm format:check` before branch handoff.
- [ ] Rename this file to `DONE_ARTICLE_INGESTION.md`, move the roadmap item to Delivered, and update
      `.agents/handoff.md` only after all acceptance checks pass.

## Risks and Watch Items

- **Shared `createResourceNode`.** The repo branch depends on it. Regressing repo ingest while
  carving out the article path is the most likely accidental breakage.
- **`extractKnowledgeFromTranscript` signature.** It is exported from `@llaab/ingestion` and consumed
  by skills and the server. The compatibility wrapper must keep the exact current signature and
  `ExtractionResult` shape, or YouTube/podcast runs break silently.
- **Vault writes in tests.** Phase 2+ tests must use a temp vault (`VAULT_ROOT` override), following
  the podcast ingest tests. A test that writes into the real `vault/` is a defect.
- **Publication source reuse.** Two articles from one site must not create two `SourceNode`s, and
  discarding one article must not delete a source another article still references.
- **`@llaab/ingestion` is consumed through `dist`.** After Phase 3, server-side verification needs a
  package rebuild, not just source edits.
- **SSRF surface.** DNS re-resolution before every request (including redirects) is the control that
  actually blocks rebinding. Validating only the initial URL is insufficient and must not be
  simplified away.

## Non-Goals

- Crawling links or ingesting an entire site.
- Scheduled refresh, follow, or change detection.
- Browser automation for JavaScript-rendered pages.
- Authenticated, cookie-backed, or paywalled retrieval.
- PDF, Office, EPUB, image OCR, or attachment ingestion.
- Raw HTML archival.
- Automatic canonical-idea/wiki promotion from article-derived ideas.
- RAG ranking, embeddings, or retrieval-index changes.
- A second article-specific ingest page.

## Acceptance Criteria

- One explicit public article URL can be fetched safely and saved as readable Markdown.
- Fetching is bounded by protocol, network target, redirect, timeout, MIME, and response-size rules.
- Canonical duplicates reuse the existing article instead of creating another resource.
- The article and publication source exist before extraction starts.
- Extraction failure never removes or hides the saved article.
- Runs are durable and globally visible; retry and discard preserve shared-node integrity.
- `/ingest` supports article paste/drop/queue/reset without transcript-specific copy.
- Explicit Hermes `docs:` / `post:` captures ingest articles while retaining inbox provenance.
- Generic links remain capture-only.
- No background processor, watcher, crawler, scheduler, or RAG dependency is introduced.

## First Articles to ingest

- [ ] **Choosing a Claude model and effort level in Claude Code**
      https://claude.com/blog/claude-model-and-effort-level-in-claude-code?utm_content=inline_link&utm_source=it&utm_medium=email&utm_campaign=2026_Q3_RET_MKTG_Claude_Code_Newsletter_July_2026&utm_term=claude_code&utm_campaignId=19112267
- [ ] **Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents**
      https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more?utm_content=inline_link&utm_source=it&utm_medium=email&utm_campaign=2026_Q3_RET_MKTG_Claude_Code_Newsletter_July_2026&utm_term=claude_code&utm_campaignId=19112267

## References

- [`ROADMAP.md`](./ROADMAP.md) — P0 owner and scope boundary.
- [`DONE_PODCAST_INGEST.md`](./DONE_PODCAST_INGEST.md) — closest save-first ingest implementation
  and validation pattern.
- [`DONE_HERMES_DROPBOX.md`](./DONE_HERMES_DROPBOX.md) — current docs/post capture and receipt
  contract.
- [`DONE_SEARCH_RETRIEVAL_FOUNDATION.md`](./DONE_SEARCH_RETRIEVAL_FOUNDATION.md) — deterministic
  search contract that article resources should immediately feed.
- [`TODO_KNOWLEDGE_RETRIEVAL_CHAT.md`](./TODO_KNOWLEDGE_RETRIEVAL_CHAT.md) — parallel retrieval/RAG
  work; article ingestion must not depend on it.
- `ROADMAP.md#document-ingestion` — future upload/parser work; no detail plan exists yet.
- [Process State Architecture](../../.github/instructions/project/process-state-architecture.instructions.md)
  — durable run and shared-query requirements.
- [Agent Execution Rules](../../.github/instructions/project/agent-execution.instructions.md) —
  one-shot execution boundary.
