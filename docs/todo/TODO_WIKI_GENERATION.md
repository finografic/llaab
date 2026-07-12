# TODO — Wiki Compilation and Knowledge Promotion

> **Status:** Phase 0 complete (2026-07-13). Phases 1–7 not started.
> **Priority:** P2 — planned.
> **Design authority:** [Wiki Creation Spec](../../.agents/WIKI_CREATION_SPEC.md)

---

## Goal

Turn selected canonical ideas into durable, reviewed, source-backed topic pages under
`knowledge/wikis/`.

```text
manual canonical-idea selection
  -> focused evidence packet
  -> wiki compilation RunNode
  -> vault wiki draft
  -> review and diff
  -> explicit promotion
  -> knowledge/wikis/<wiki-id>.md
```

Automatic topic discovery will later feed the same compiler. Manual and automatic entry paths
differ only in how they select canonical ideas.

## Product Contract

- Canonical ideas are atomic source ingredients; wiki pages are maintained topic-level syntheses.
- Generated candidates, drafts, validation reports, and compilation runs live in the nested
  `vault/` repository.
- Reviewed wiki pages live in `knowledge/wikis/` in the parent LLAAB repository.
- No workflow automatically promotes, stages, commits, or pushes either repository.
- Creating and updating a wiki use the same compiler.
- A single transcript may create a `seed` wiki; repeated extraction runs from that transcript do
  not increase topic heat or source diversity.
- Every substantive section resolves to structured source references.
- Transcript provenance means `source-backed`; it does not establish objective truth.
- Existing wiki pages are updated through reviewed deltas, never blind rewrites.
- Manual edits to promoted Markdown are first-class and must survive later compiler runs.
- Promoted Markdown files are the source of truth for wiki content and typed wiki links.
- Any search or graph index is derived, disposable, and rebuildable from those files.

## Architecture Boundaries

| Layer            | Responsibility                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@llaab/schemas` | Vault draft, knowledge wiki, source-ref, link, compile-result, quality, and API contracts                         |
| `@llaab/core`    | Explicit vault and knowledge roots, Markdown codecs, safe file reads/writes, hashing, and indexes                 |
| `@llaab/llm`     | `wiki-compile` and later `wiki-discover` task routing through existing providers                                  |
| `@llaab/skills`  | One-shot compilation/discovery workflows backed by durable `RunNode`s                                             |
| `apps/server`    | Thin validated routes, vault/knowledge authorization boundaries, promotion coordination                           |
| `apps/client`    | Canonical-idea selection, durable run state, draft review, promotion, wiki browsing, and later discovery/graph UX |

### Confirmed current seams

- Vault nodes use `BaseNodeSchema`, `NodeTypeSchema`, `NodeSchema`, `nodeSchemaByType`, and
  `NODE_DIR_MAP`; adding `wiki-draft` requires updating the complete chain.
- `CanonicalIdeaNode` has `transcript_id`, `source_candidate_idea_ids`, `key_claims`, tags,
  confidence, and model metadata. The linked candidate `IdeaNode`s usually have empty bodies, so
  evidence expansion cannot assume they contain transcript excerpts.
- Transcript bodies already contain paragraph-level `<!-- t:H:MM:SS -->` markers. V1 can rank
  bounded paragraphs and preserve their locators without changing ingestion.
- `listNodes({ type })` currently scans every Markdown file under `VAULT_ROOT` before filtering.
  Wiki request paths must use direct file reads or add a type-directory optimization before broad
  discovery is enabled.
- Canonical consolidation currently demonstrates structured JSON, Zod parsing, coverage checks,
  one quality retry, provider trace metadata, and `runSkill`, but most implementation is inside the
  already-large `vault-transcripts.routes.ts`. Wiki logic must not extend that route module.
- `runSkill` creates the durable run before execution and reconciles failed/orphaned runs. Wiki
  compilation must reuse this lifecycle and receive a wiki-specific stale timeout.
- No `KNOWLEDGE_ROOT`, knowledge Markdown codec, knowledge router, or knowledge client query domain
  exists yet.
- Transcript detail already reads durable consolidation state from the Run Monitor, but the
  component is large. Wiki selection belongs in a purpose-named child component, not more inline
  route/component logic.
- `@pierre/diffs` already renders unified patches in the client and should render wiki update diffs
  after a server-side section/patch contract exists.

## Non-Goals

Do not implement initially:

- automatic promotion or automatic Git commits
- continuous background compilation, polling workers, or an LLAAB-owned scheduler
- direct model writes to `knowledge/`
- external web research inside the first compiler
- an external graph database
- full-vault or full-transcript prompt dumps
- topic popularity based on extraction-run or candidate-idea counts
- arbitrary relationship vocabularies
- silent duplicate-topic or evidence-conflict resolution
- automatic deletion of mature content
- one rigid article template for every topic

## Progress

- [x] Phase 0 — contracts, storage boundaries, fixtures, and guardrails (2026-07-13)
- [ ] Phase 1 — manual single-transcript wiki-draft compilation
- [ ] Phase 2 — draft review and promotion of new wiki pages
- [ ] Phase 3 — safe updates, novelty, and conflict handling
- [ ] Phase 4 — claim-level evidence locators and citation enrichment
- [ ] Phase 5 — automatic topic discovery and candidate queue
- [ ] Phase 6 — derived wiki-link graph and browsing
- [ ] Phase 7 — external research and verification adapters

---

## Phase 0 — Contracts, Storage Boundaries, and Guardrails

**Outcome:** The persisted contracts and repository boundary are testable before any feature can
write a draft or promoted page.

### Shared schemas

- [x] Add `WikiDraftNodeSchema` in a purpose-named schema file and add `wiki-draft` to
      `NodeTypeSchema`, `NodeSchema`, `nodeSchemaByType`, and `NODE_DIR_MAP` with storage under
      `vault/nodes/wiki-drafts/`.
- [x] Keep `WikiDraftNode` in the vault `LabNode` union, with persisted snake_case fields and at
      least the authoritative spec fields: topic identity, target wiki, operation, draft status,
      source ids, links, source refs, represented/omitted ideas, base revision/hash, quality,
      warnings, change summary, and LLM metadata.
- [x] Add draft review/provenance fields needed for safe lifecycle transitions: originating
      `run_id`, structured sections/patch, unresolved questions, contested claims, validation
      issues, reviewer edits, promoted wiki/revision, and reviewed timestamp.
- [x] Define `WikiDraftStatusSchema` as `proposed | accepted | rejected | superseded`; regeneration
      creates a new draft and supersedes the old one rather than mutating history in place.
- [x] Add dedicated knowledge schemas under `packages/schemas/src/knowledge/` for
      `KnowledgeWikiPage`, lifecycle, verification status, `WikiSourceRef`, `WikiLink`, and the
      controlled relation vocabulary. Do not add promoted wikis to `LabNode`.
- [x] Define shared compile input/result, section draft, evidence item, topic-resolution, novelty,
      quality, warning, patch, list/detail response, and request-body schemas.
- [x] Keep TypeScript identifiers camelCase and perform explicit boundary mapping to persisted
      snake_case frontmatter.
- [x] Reserve `WikiCandidateNodeSchema` until Phase 5 finalizes its persistence contract; do not
      create placeholder candidate files during the manual phases.
- [x] Apply the taxonomy guide to promoted wiki tags. Lifecycle, verification, provenance,
      confidence, relationships, and topic identity stay in dedicated fields; non-domain idea tags
      remain discovery signals unless the taxonomy contract is deliberately revised first.

### Knowledge root and Markdown codec

- [x] Add an explicit `KNOWLEDGE_ROOT` resolver beside the existing monorepo/vault resolver, with
      an `LLAAB_KNOWLEDGE` override for tests and non-standard layouts.
- [x] Add purpose-named knowledge read/list/write/validate utilities in `@llaab/core`; keep
      `index.ts` files as re-export barrels only.
- [x] Extract or share the existing frontmatter serializer/parser carefully so structured arrays
      of source refs and links round-trip without changing current vault-node serialization.
- [x] Define the canonical file path `knowledge/wikis/<id>.md`; reject absolute paths, separators,
      `..`, symlink escapes, and any resolved path outside `KNOWLEDGE_ROOT/wikis`.
- [x] Define stable section-id encoding in Markdown. Human-readable headings remain editable, while
      deterministic markers preserve section identity for later patches.
- [x] Define citation rendering from stable `source_ref` ids and verify that parsing and rendering
      preserve machine resolution without requiring raw URLs in prose.
- [x] Define the content-hash algorithm and normalization rules. Hash comparison must detect any
      substantive or manual change while avoiding changes caused only by the codec itself.
- [x] Add atomic same-filesystem writes using temporary files plus rename; never leave a partially
      written promoted page.
- [x] Add a per-wiki write lock so simultaneous promotions or updates cannot pass revision checks
      against the same base page.

### Integrity and performance

- [x] Add direct typed reads by known node type/id for selected canonical ideas, candidate ideas,
      transcripts, sources, and drafts; do not begin manual compilation with a full `listNodes()`
      scan.
- [x] Optimize `listNodes({ type })` to scan only `NODE_DIR_MAP[type]`, or add an equivalent typed
      directory reader, before candidate discovery performs vault-wide canonical-idea reads.
- [x] Audit run deletion, transcript discard, recent-activity cleanup, generic node deletion, and
      produced-node previews for the new draft type and its provenance references.
- [x] Decide deterministic deletion behavior for evidence referenced by a proposed or accepted
      draft; at minimum surface a preservation/warning result rather than silently orphaning draft
      provenance.
- [x] Confirm wiki-draft writes use normal vault persistence and do not trigger vault auto-commit.
- [x] Confirm knowledge writes never use `VAULT_ROOT`, the vault Git lock, or nested-vault Git
      commands.

### Fixtures and contract tests

- [x] Add fixture builders for transcripts, timestamped paragraphs, sources, candidate ideas,
      canonical ideas, drafts, existing wiki pages, aliases, links, manual edits, stale revisions,
      duplicate topics, and contradictory evidence.
- [x] Add a deterministic fixture corpus for single-source seed creation, multi-source growth,
      identical-evidence no-op, duplicate-topic review, stale-draft rejection, and contested claims.
- [x] Add round-trip tests for vault drafts and knowledge Markdown, including structured arrays,
      source refs, stable section ids, Unicode prose, and manually edited content.
- [x] Add path-boundary tests proving vault helpers cannot write knowledge files and knowledge
      helpers cannot write vault files.
- [x] Add invalid-contract tests for invented ids, invalid topic keys, duplicate refs/sections,
      unsupported link relations, broken targets, malformed locators, and unsafe paths.

**Exit criteria**

- [x] Both schema families validate independently and no promoted wiki is a `LabNode`.
- [x] Knowledge Markdown round-trips without losing body, frontmatter, stable section ids, links, or
      source refs.
- [x] Repository-boundary, path-traversal, atomic-write, and hash-stability tests pass.
- [x] Manual-phase code can resolve selected evidence without an unbounded vault scan.

---

## Phase 1 — Manual Wiki-Draft Compilation

**Outcome:** A user can select canonical ideas from one transcript and generate a validated,
reviewable `wiki-draft` in the vault. No knowledge file is written.

### Compiler ownership and inputs

- [ ] Implement the compiler as purpose-named modules under `packages/skills/src/wiki/` rather than
      adding logic to `vault-transcripts.routes.ts` or an `index.ts`.
- [ ] Separate source selection, topic resolution, evidence expansion, prompt construction, LLM
      parsing, deterministic validation, quality scoring, Markdown rendering, and persistence into
      independently testable modules.
- [ ] Add a `compileWikiDraft` entry point accepting canonical idea ids, optional target wiki id,
      optional suggested title/topic key, and entry path `manual | automatic`.
- [ ] For the first transcript UI, require selected canonical ideas to belong to the route
      transcript. Keep the compiler contract capable of cross-transcript ids for Phase 3/5.
- [ ] Reject empty selections, duplicate ids, missing nodes, non-canonical node ids, mixed
      transcript ids in the V1 UI request, and selected evidence that cannot resolve its transcript.

### Focused evidence expansion

- [ ] Resolve each selected canonical idea directly, then its
      `source_candidate_idea_ids`, `transcript_id`, transcript `source_id`, and `SourceNode` when
      present.
- [ ] Build an evidence query from canonical title/body/key claims plus candidate-idea titles;
      candidate `IdeaNode.body` must be treated as optional/usually empty.
- [ ] Parse transcript bodies into timestamped paragraph records and rank bounded excerpts with a
      deterministic lexical scorer for V1. Include neighboring paragraphs only within configured
      limits and deduplicate overlap across selected ideas.
- [ ] Preserve transcript title, author, source URL, source id, paragraph locator, and canonical
      lineage in every `WikiEvidenceItem`.
- [ ] Fall back explicitly to transcript-level provenance when no reliable paragraph match exists;
      do not invent a claim-level locator.
- [ ] Enforce evidence-packet item, character, and token budgets. Never send unrelated vault nodes,
      full run Markdown, every wiki body, or full transcripts by default.
- [ ] Add deterministic tests showing relevant paragraphs are selected, unrelated transcript text
      is excluded, timestamp markers survive, and repeated/overlapping excerpts collapse.

### Topic resolution and compilation

- [ ] Normalize and validate `topic_key` independently from title; titles may evolve without
      changing topic identity.
- [ ] For the no-existing-wiki V1 case, resolve `create | no-op | needs-review` deterministically
      before inference. Full existing-wiki resolution arrives in Phase 3.
- [ ] Add `wiki-compile` to every exhaustive LLM task surface: `TaskType`, default routing, routing
      config parsing, server request schemas, CLI route command, `/llm` routing labels, and tests.
- [ ] Route `wiki-compile` through the existing provider/control layer and record the resolved
      provider/model. Do not call a provider directly from the route or client.
- [ ] Define a compact prompt and Zod output contract for operation, topic identity, aliases,
      summary, stable sections, links, source refs, coverage, omitted reasons, change summary,
      unresolved questions, and contested claims.
- [ ] Require structured JSON before rendering Markdown. Strip fences defensively, but reject
      malformed/truncated output rather than guessing missing fields.
- [ ] Validate that every model-produced canonical/transcript/source/wiki id and URL belongs to the
      supplied input or a validated promoted-wiki index.

### Deterministic quality and retry

- [ ] Validate topic key, selected ids, evidence refs, citation completeness, coverage,
      section/ref uniqueness, page-size limits, proposed link targets, and operation consistency
      before writing a draft.
- [ ] Require every substantive section to reference at least one source ref and every selected
      canonical idea to be represented or explicitly omitted with a reason.
- [ ] Compute a 0–100 quality score from evidence coverage, citation completeness, source diversity,
      topic coherence, duplication avoidance, link validity, novelty, and unresolved conflict.
- [ ] Emit structured warnings for single-source dominance, low diversity, over-collapse,
      unrelated-category merges, uncited factual detail, duplicate-topic risk, contested claims,
      weak links, and low-novelty rewrites.
- [ ] Permit one automatic quality-triggered retry with the failed validation feedback. Preserve
      both attempts in RunNode stages/decisions and never promote after either attempt.

### Durable run and draft persistence

- [ ] Run compilation through `runSkill('compile-wiki-draft', ...)` so the RunNode exists before
      evidence expansion or inference begins.
- [ ] Add `compile-wiki-draft` to stale-run timeout configuration and add its API route to Bun's
      long-running-path allowlist.
- [ ] Persist stages for source resolution, evidence expansion, topic resolution, compilation,
      validation, retry, render, and draft write.
- [ ] Persist entry path, operation, topic/target, selected canonical/transcript/source counts,
      quality, warnings, model/provider, duration/tokens, produced draft id, and terminal decision.
- [ ] Set `produced_node_ids` to the draft id and add a Run Monitor link to
      `/vault/wiki-drafts/<id>` rather than the generic node detail route.
- [ ] Persist `create`, `update`, `needs-review`, and useful `no-op` outcomes as reviewable drafts
      when they contain a decision/report; always retain the RunNode outcome.

### Server API

- [ ] Add `vault-wiki-drafts.routes.ts` and `vault-wiki-drafts.schema.ts`; re-export through the
      vault route barrel and wire validation in the vault router.
- [ ] Add `POST /api/vault/transcripts/:id/wiki-drafts` for the first manual entry flow.
- [ ] Add targeted `GET /api/vault/wiki-drafts` and
      `GET /api/vault/wiki-drafts/:id` operations with status/topic/target filters and pagination.
- [ ] Keep handlers thin: validation and HTTP mapping belong in routes; compilation belongs in the
      skill modules.
- [ ] Return the run id and draft id directly so the client can navigate without re-scanning all
      vault nodes.
- [ ] Add route tests for invalid selection, missing lineage, unsafe target, one-source seed draft,
      invented ids, missing citations, failed retry, and successful persistence.

### Transcript client flow

- [ ] Extract a `WikiDraftComposer/` feature component near the transcript detail feature; do not
      expand the existing large `TranscriptDetail.tsx` with compiler state and form logic.
- [ ] Add `Create / Update Wiki` beside Canonical Ideas and allow selecting one or more canonical
      ideas, entering an optional suggested title, and choosing new-topic creation.
- [ ] Do not expose heat scores, research options, prompt text, or raw model controls in V1.
- [ ] Add dedicated `queries/wiki-drafts/` keys/hooks plus targeted invalidation for draft detail,
      draft lists, transcript canonical ideas, runs, and the Run Monitor.
- [ ] Derive in-progress state from the shared Run Monitor using the run skill/input, with the local
      mutation used only to initiate the request.
- [ ] Surface validation warnings, failure, completion, duration, and token progress across route
      navigation/remounts.

**Exit criteria**

- [ ] Selected canonical ideas from one transcript produce a `seed` wiki draft in `vault/` with
      bounded evidence, complete provenance, validation, quality, and model metadata.
- [ ] No Phase 1 operation writes under `knowledge/` or changes Git state.
- [ ] The draft has a durable visible RunNode and fixture-backed tests do not require live inference.

---

## Phase 2 — Review and Promotion of New Wiki Pages

**Outcome:** A reviewed create draft becomes exactly one validated Markdown page in
`knowledge/wikis/`, while the originating vault draft remains as provenance.

### Knowledge repository operations

- [ ] Add a dedicated server route group under `apps/server/src/routes/knowledge/` with
      `knowledge.routes.ts`, `knowledge.schema.ts`, and a wiring-only `index.ts`.
- [ ] Mount the router at `/api/knowledge`; knowledge reads use normal app authentication and do not
      depend on `VAULT_ROOT` or the vault session middleware.
- [ ] Add `GET /api/knowledge/wikis` and `GET /api/knowledge/wikis/:id` with validated pagination,
      lifecycle, tag, verification, and text filters.
- [ ] Build a deterministic index from `knowledge/wikis/*.md` for id, topic key, aliases, lifecycle,
      source counts, represented canonical ideas, and links.
- [ ] Allow request-time caching only with explicit file-state invalidation; no watcher or
      always-on indexing process. Deleting the cache must be harmless.
- [ ] Reject duplicate ids/topic keys, malformed pages, unresolved source refs, duplicate sections,
      and links to absent promoted pages before a promotion write.

### Promotion transaction

- [ ] Add `POST /api/vault/wiki-drafts/:id/promote` behind vault authorization. This is the only V1
      application write into promoted wiki files.
- [ ] Re-read and revalidate the draft and current knowledge index inside the per-wiki lock; never
      promote a stale object supplied by the client.
- [ ] Promote a create draft with revision `1`, `reviewed_at`, lifecycle `seed`, and verification
      `source-backed` unless stronger evidence is already deterministically established.
- [ ] Write the knowledge file atomically, then mark the draft accepted with promoted wiki id and
      revision. Never mark a draft accepted before the knowledge file exists and validates.
- [ ] Make cross-repository recovery idempotent: if the knowledge write succeeds but updating the
      vault draft fails, retry must detect the identical promoted page and repair draft metadata
      without creating revision `2` or a duplicate file.
- [ ] Append promotion/rejection decisions to a durable RunNode or explicit draft review record so
      generation and final human decision are both observable.
- [ ] Do not invoke `git add`, `git commit`, or `git push`. Promotion intentionally leaves a parent
      worktree change for the user to review and commit.

### Draft lifecycle operations

- [ ] Add `POST /api/vault/wiki-drafts/:id/reject`; retain the draft and run history.
- [ ] Add `POST /api/vault/wiki-drafts/:id/regenerate`; create a new run/draft and mark the old draft
      superseded only after the replacement persists.
- [ ] Add a validated edit operation for proposed drafts. Edit structured sections/title/summary
      and regenerate the rendered body so structured content and Markdown cannot silently diverge.
- [ ] Re-run citation, source-ref, link, section-id, page-size, and quality validation after every
      human draft edit.
- [ ] Disallow edits or repeated promotion on rejected/superseded/accepted drafts except explicit
      regeneration into a new proposed draft.

### Review and knowledge UX

- [ ] Add `/vault/wiki-drafts/:id` under `VaultLayout` using `PageDetail` and the established vault
      session boundary.
- [ ] Display title/summary, operation, rendered article, selected canonical ideas, transcript and
      source provenance, quality score/warnings, omitted ideas, proposed links, contested claims,
      unresolved questions, section list, and model/run metadata.
- [ ] For create drafts, show the exact target path and a full new-page preview.
- [ ] Add explicit `Promote`, `Reject`, `Regenerate`, and `Edit Draft` actions with confirmation and
      clear terminal states.
- [ ] Add `/knowledge/wikis` and `/knowledge/wikis/:id` outside `VaultLayout` for promoted list and
      detail views.
- [ ] Show title, summary, lifecycle, verification, source count, linked-page count, represented
      idea count, revision, and last-updated/reviewed timestamps.
- [ ] Add a Knowledge navigation section only after its routes exist and pass client validation;
      keep draft navigation under Vault.
- [ ] Use shadcn primitives, Lucide icons, `PageList`/`PageDetail`, and `Row`/`Col` for structural
      layout. Keep the review surface dense and operational.

### Tests and manual proof

- [ ] Test create promotion, duplicate topic/id rejection, malformed draft rejection, invalid refs,
      accepted/rejected/superseded transitions, concurrent promotion serialization, idempotent
      recovery, and absence of Git command invocation.
- [ ] Add client tests for review states, action availability, invalidation, and navigation where
      local test patterns support them.
- [ ] Manually generate, review, promote, refresh, and verify one page persists under
      `knowledge/wikis/` while its draft and RunNode remain in `vault/`.
- [ ] Verify parent `git status --short` shows only the expected knowledge change and nested vault
      status shows only expected draft/review metadata.

**Exit criteria**

- [ ] A user can turn canonical ideas from one transcript into one reviewed knowledge Markdown
      page without any automatic Git mutation.
- [ ] Every promoted section has resolvable provenance and the page round-trips through the
      knowledge codec.
- [ ] Promotion is atomic per file, serialized per topic, and safely retryable across the two repo
      writes.

---

## Phase 3 — Safe Updates, Novelty, and Conflicts

**Outcome:** New evidence produces a reviewable section-level update or a deterministic no-op,
never an uncontrolled rewrite.

### Topic resolution

- [ ] Resolve existing topics in priority order: exact topic key, alias, normalized title,
      represented canonical-idea overlap, domain/tag overlap, then optional semantic similarity.
- [ ] Return `create | update | no-op | needs-review` before compilation and persist the reasons and
      matched candidates.
- [ ] Never silently create a near-duplicate page. A possible overlap must become `needs-review`
      with both topic identities and evidence visible.
- [ ] Let review choose an existing update target or confirm a genuinely distinct topic key.

### Delta compilation

- [ ] For updates, send only existing page metadata, relevant stable sections, new evidence, and a
      bounded related-wiki summary set. Never send every wiki body or the full vault.
- [ ] Add deterministic novelty analysis for new supported claims, corrections, contradictions,
      distinctions, mechanisms, stronger support, relevant links, and obsolete-content removal.
- [ ] Treat wording-only rewrites and already-represented evidence as `no-op`.
- [ ] Persist `base_revision`, `base_content_hash`, structured section operations, resulting page,
      change summary, and unchanged section ids in the draft.
- [ ] Preserve untouched sections byte-for-byte where the codec allows and preserve human edits in
      any section outside the accepted patch.
- [ ] Render a unified patch for review and reuse `@pierre/diffs` in the client; the structured
      section patch remains the application contract, not pixels or model prose.

### Apply and conflict handling

- [ ] Re-read the promoted file inside the per-wiki lock and compare expected revision/hash before
      applying any update.
- [ ] Reject stale drafts without changing knowledge, retain them in the vault, and offer
      regeneration/rebase against the current page.
- [ ] Apply only accepted section operations, revalidate the complete resulting page, increment
      revision, merge provenance, and update timestamps after the atomic write succeeds.
- [ ] Handle new evidence that contradicts the page as a contested-claim proposal with both source
      groups; never silently replace the existing claim.
- [ ] Apply lifecycle-aware novelty thresholds: useful additions for `seed`, meaningful new
      claims/distinctions for `growing`, and substantial corrections/evidence/improvements for
      `mature`.
- [ ] Define deterministic lifecycle promotion signals using coverage, independent source
      diversity, structure, and unresolved conflict. Lifecycle must not advance from repeated runs
      or manual title changes.

### Tests

- [ ] Test identical-evidence no-op, manual edit preservation, stale revision/hash rejection,
      duplicate-topic review, rebase/regeneration, lifecycle thresholds, contested claims,
      section insertion/update/removal, and idempotent update promotion.
- [ ] Add a two-transcript integration fixture that creates a seed page, manually edits it, proposes
      an update, preserves the edit, and increments revision exactly once.

**Exit criteria**

- [ ] Canonical ideas from a second transcript can generate a reviewable update diff.
- [ ] Identical or non-novel evidence produces `no-op` or a negligible proposal.
- [ ] Manual edits survive, conflicts remain reviewable, and stale drafts cannot overwrite current
      knowledge.

---

## Phase 4 — Claim-Level Evidence and Citation Enrichment

**Outcome:** Provenance progresses from transcript-level references to reliable bounded excerpts
and deep links without inventing precision.

- [ ] Promote the V1 paragraph scorer into a documented transcript-span resolver with stable
      paragraph locators and confidence.
- [ ] Map `<!-- t:H:MM:SS -->` markers to YouTube `t=` deep links only when the source URL and
      locator validate; otherwise keep a transcript-level citation and explicit limitation.
- [ ] Preserve multiple evidence spans for a claim when independent sources corroborate or contest
      it, while deduplicating overlapping excerpts from the same transcript.
- [ ] Render stable source-reference identifiers in article Markdown and keep normalized refs in
      frontmatter as the machine source of truth.
- [ ] Display `source-backed`, `corroborated`, and `contested` accurately. Transcript-derived claims
      default to `source-backed` even when the speaker sounds authoritative.
- [ ] Add draft/wiki UI affordances to open the source, transcript, and timestamped YouTube location.
- [ ] Add validator checks for malformed locators, source/URL mismatch, duplicate refs, missing
      section citations, and model-invented URLs or ids.
- [ ] Test paragraph ranking, timestamp parsing, deep-link generation, fallback citations,
      multi-source refs, malformed locator rejection, and Markdown round trips.

**Exit criteria**

- [ ] Each substantive section exposes resolvable evidence at the best precision the source data
      supports.
- [ ] The UI never presents transcript provenance as independent factual verification.

---

## Phase 5 — Automatic Topic Discovery and Candidate Queue

**Outcome:** An explicit one-shot discovery run suggests coherent wiki work across transcripts
without compiling or promoting knowledge automatically.

### Deterministic discovery

- [ ] Add bounded typed reads over canonical ideas only. Exclude candidate-idea volume, extraction
      run count, duplicate wording, and same-transcript repetition from demand scoring.
- [ ] Deduplicate evidence by canonical idea and transcript before clustering so multiple models or
      consolidation runs cannot inflate heat.
- [ ] Pre-cluster with normalized domain/topic signals, title/body/key-claim similarity,
      transcript/source diversity, existing-wiki coverage, and optional embeddings only when an
      established capability exists.
- [ ] Make the initial eligibility threshold configurable, defaulting to at least three relevant
      canonical ideas across at least two transcripts.
- [ ] Match existing wikis and subtract already-represented evidence before computing novelty.
- [ ] Compute explainable heat and novelty from canonical count, unique transcripts, unique
      sources/authors, source diversity, recency, unrepresented evidence, and graph centrality when
      Phase 6 data is available.

### Optional model review

- [ ] Add `wiki-discover` to the same exhaustive routing/config/UI/CLI surfaces as `wiki-compile`.
- [ ] Limit the LLM role to cluster-coherence judgment, stable title/topic-key proposals,
      split/merge recommendations, and likely existing-wiki matches.
- [ ] Require deterministic cluster inputs and validation; the model cannot be the sole clustering
      mechanism or introduce supporting ids.

### Candidate persistence and UX

- [ ] Finalize `WikiCandidateNodeSchema` and add `wiki-candidate` through the vault node registry and
      `vault/nodes/wiki-candidates/` storage map.
- [ ] Persist supporting canonical/transcript/source ids, deterministic signals, thresholds, heat,
      novelty, existing-wiki matches, recommendation, warnings, and model provenance when used.
- [ ] Add explicit one-shot `POST /api/vault/wiki-candidates/discover` plus paginated candidate
      list/detail routes. Do not add an always-on worker or scheduler.
- [ ] If automated scheduling is desired, expose a one-shot cron recipe that an external scheduler
      may call; the recipe must run and exit.
- [ ] Add `/vault/wiki-candidates` queue/detail views showing topic, scores with explanations,
      transcript/source counts, existing match, and create/update recommendation.
- [ ] Let the user select a candidate and pass its canonical ids into the Phase 1 compiler. Discovery
      itself does not compile or promote a page.
- [ ] Test deterministic clusters/scores, threshold configuration, duplicate-run immunity,
      represented-evidence subtraction, model id validation, and one-shot run persistence.

**Exit criteria**

- [ ] Discovery creates reviewable vault candidates only.
- [ ] Heat measures evidence diversity and unmet knowledge demand, not extraction noise.
- [ ] A candidate enters the existing compiler only through an explicit user action.

---

## Phase 6 — Derived Wiki-Link Graph and Browsing

**Outcome:** Promoted wiki frontmatter yields a validated, rebuildable graph with useful related-page
browsing.

- [ ] Finalize the directed relation vocabulary: `related-to`, `depends-on`, `extends`,
      `contrasts-with`, `example-of`, `supports`, and `supersedes`.
- [ ] Validate suggested links during draft review and final links during promotion: target exists,
      relation is allowed, edge is unique, and a broad shared domain tag is not sufficient evidence.
- [ ] Store one authoritative directed edge and derive reverse views at read/index time.
- [ ] Build graph nodes/edges from validated `knowledge/wikis/*.md`; do not use vault `related`, the
      dormant generic relationship schema, or a separate graph database as the source of truth.
- [ ] Add diagnostics for broken targets, invalid relations, duplicate ids/topic keys, self-links,
      duplicate edges, and isolated pages.
- [ ] Add related-page browsing and link diagnostics to wiki detail before implementing a full graph
      visualization.
- [ ] Add knowledge graph/search API responses, then an interactive graph view using a proven
      library after the index contract is stable.
- [ ] Keep any SQLite/JSON cache disposable and request-triggered; no watcher or permanent indexing
      process.
- [ ] Optionally export reviewed summaries to `knowledge/knowledge-graphs/`; exports are derived
      artifacts and never the authoritative edge store.
- [ ] Test complete rebuild, reverse derivation, invalid-link diagnostics, cache deletion, graph
      filtering, and reproducible exports.

**Exit criteria**

- [ ] Every displayed edge resolves to a promoted wiki page.
- [ ] Deleting all derived graph/index data and rebuilding from wiki files reproduces the graph.

---

## Phase 7 — External Research and Verification Adapters

**Outcome:** A user can explicitly enrich a selected draft/wiki with authoritative external evidence
while keeping transcript provenance and factual verification distinct.

- [ ] Define an opt-in research request, approval policy, provider/tool allowlist, result budget,
      token/cost budget, and cancellation/error behavior.
- [ ] Add a dedicated one-shot research adapter/task and RunNode; research never runs as a hidden
      side effect of compilation, discovery, browsing, or promotion.
- [ ] Add external source-ref kinds and persist retrieval query, provider/tool, timestamps, URLs,
      excerpts, and validation results.
- [ ] Require authoritative-source retrieval, URL/citation validation, and explicit attribution
      before a claim or page may become `corroborated`.
- [ ] Detect contradictory evidence and create a contested proposal for review rather than choosing
      a winner automatically.
- [ ] Display transcript-derived and external evidence separately in draft review and wiki detail.
- [ ] Route research results through the same draft/update/revision workflow; research cannot write
      promoted knowledge directly.
- [ ] Add fixture-backed adapter tests, source-quality failures, unavailable provider behavior,
      budget enforcement, and manual cost/approval testing.

**Exit criteria**

- [ ] External research is explicit, bounded, traceable, source-validated, reviewable, and unable to
      change a promoted wiki without normal promotion.

---

## Cross-Cutting Verification

- [ ] Keep route modules thin and schema-validated; no implementation logic in `index.ts` files.
- [ ] Keep compilation, evidence, resolution, quality, storage, promotion, and graph modules
      independently testable with deterministic fixtures.
- [ ] Add focused tests in `@llaab/schemas`, `@llaab/core`, `@llaab/skills`, server routes, and
      client features as each phase introduces contracts.
- [ ] Use temporary `LLAAB_VAULT` and `LLAAB_KNOWLEDGE` roots in storage/route tests; never write
      fixtures into the live repositories.
- [ ] Assert parent and nested-vault Git status before/after promotion and conflict integration tests.
- [ ] Add an integration journey covering draft creation, review, create promotion, manual edit,
      update draft, stale rejection, regeneration/rebase, accepted update, and no-op rerun.
- [ ] Run the smallest relevant package tests/typechecks during each phase and one workspace-level
      validation pass at the vertical-slice boundary.
- [ ] After changes under `apps/server/**`, server-consumed packages, or startup-read environment
      values, run `mkdir -p "$HOME/Library/Logs/llaab" && ./scripts/macos/dev-refresh.sh` before
      browser verification.
- [ ] Run `node_modules/.bin/md-lint docs/todo/TODO_WIKI_GENERATION.md` after plan updates and lint
      new operator/process documentation as it lands.
- [ ] Verify all structural client layout uses `Row`/`Col`/`Container`, shadcn primitives are reused,
      and no custom icon duplicates Lucide.

## Manual Acceptance Journey

- [ ] Consolidate one transcript into canonical ideas.
- [ ] Select a subset and create a draft; verify the evidence packet excludes unrelated transcript
      paragraphs and preserves available timestamps.
- [ ] Navigate away and back during compilation; verify durable Run Monitor state, elapsed time, and
      final navigation remain correct.
- [ ] Review article sections, source refs, omitted ideas, quality warnings, proposed links, and
      RunNode/model metadata.
- [ ] Reject and regenerate one draft; verify history is retained and the old draft is superseded.
- [ ] Promote a valid create draft; verify exactly one page appears under `knowledge/wikis/` and no
      Git command ran.
- [ ] Make a deliberate manual edit to the promoted Markdown page.
- [ ] Compile canonical ideas from a second transcript against that topic.
- [ ] Verify the diff preserves the manual edit; promote once and verify revision/hash change once.
- [ ] Re-run with unchanged evidence and verify `no-op` or a negligible proposal.
- [ ] Create overlapping topic evidence and verify `needs-review`, not a duplicate page.
- [ ] Change a promoted file after draft generation and verify stale promotion is rejected without
      changing knowledge.
- [ ] Verify rejected, stale, low-quality, and contested drafts remain reviewable and cannot promote
      automatically.
- [ ] Run discovery with duplicate extraction runs and verify heat is unchanged.
- [ ] Delete/rebuild derived graph data and verify nodes/edges match the promoted Markdown files.

## Completion Criteria

The initiative can graduate to `DONE_WIKI_GENERATION.md` when:

- [ ] A user can select canonical ideas from one transcript and generate a source-backed draft.
- [ ] The draft remains in the vault until explicitly promoted.
- [ ] Promotion creates one validated page under `knowledge/wikis/` without Git mutation.
- [ ] A second transcript can produce a proposed update to the same page.
- [ ] The update is a reviewable section-level diff and preserves manual edits.
- [ ] Identical evidence produces a no-op or negligible change.
- [ ] Every meaningful section has machine-resolvable provenance.
- [ ] Multiple extraction runs from one transcript do not inflate heat or diversity.
- [ ] One canonical idea may contribute to multiple wikis when genuinely relevant.
- [ ] Duplicate topic creation is detected before promotion.
- [ ] Wiki links resolve only to existing promoted pages.
- [ ] The graph rebuilds entirely from wiki Markdown files.
- [ ] Low-quality, stale, duplicate, or conflicting drafts never promote automatically.
- [ ] Every compilation, retry, review, rejection, and promotion decision is visible in durable
      metadata.
- [ ] External research, if enabled, remains explicit and cannot bypass review/promotion.

## Documentation Follow-Ups

- [ ] Update [Vault and Knowledge Repos](../process/VAULT_KNOWLEDGE_REPOS.md) with the implemented
      draft/review/promotion behavior after the first vertical slice is stable.
- [ ] Add an operator-facing wiki workflow guide after Phase 2; keep this TODO as the implementation
      record rather than duplicating operational instructions here.
- [ ] Update orchestration/model-routing documentation when `wiki-compile` and `wiki-discover` land.
- [ ] Update the taxonomy guide only if implementation intentionally changes the existing tag
      contract.
- [ ] Update `ROADMAP.md` priority/link only when the initiative moves tiers; update
      `NEXT_STEPS.md` when a phase becomes active or leaves manual validation work.
- [ ] Rename this file to `DONE_WIKI_GENERATION.md`, update its title/status, and move the roadmap
      item to Done only after every tracked completion checkbox is resolved.
