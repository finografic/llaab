# TODO - Wiki Generation and Knowledge Promotion

> **Status:** Not started.
> **Priority:** P2 - planned. Manual draft compilation and reviewed promotion are the first
> vertical slice; automatic discovery, graph views, and external research follow only after that
> path is reliable.
> **Primary design:** [Wiki Creation Spec](../../.agents/WIKI_CREATION_SPEC.md)

---

## Goal

Turn selected canonical ideas into durable, reviewed, source-backed topic pages under
`knowledge/wikis/`.

```text
manual canonical-idea selection
  -> focused evidence packet
  -> wiki compilation run
  -> vault wiki draft
  -> user review and diff
  -> explicit promotion
  -> knowledge/wikis/<wiki>.md
```

The same compiler will later serve automatic topic discovery. The two entry paths differ only in
how canonical ideas are selected.

## Architectural Decisions

- `vault/` owns generated `wiki-draft` and later `wiki-candidate` nodes, compiler RunNodes,
  validation reports, rejected drafts, and proposed updates.
- `knowledge/wikis/` owns the current reviewed Markdown page. It is committed with the parent
  LLAAB source repository; it is not a vault node and must never resolve through `VAULT_ROOT`.
- A promoted wiki page has a stable `id` and `topic_key`; titles may change without changing its
  identity.
- Creation and update use one compiler. Updates produce a reviewed delta against a recorded base
  revision and content hash.
- Markdown wiki pages and their frontmatter are the source of truth for typed wiki links. Any
  graph/search index is derived and rebuildable.
- Every substantive article section carries stable, machine-resolvable source-reference ids.
- A transcript-derived claim is `source-backed`, not automatically factually verified.
- Promotion writes a validated file but never creates a Git commit or pushes either repository.
- V1 starts with manual selection from one transcript. A single source may create a `seed` page.

## Scope and Non-Goals

V1 includes manual draft generation, review, promotion, and safe update proposals. It does not
include automatic promotion, continuous rewriting, external web research, an external graph
database, unbounded vault context, arbitrary link types, or popularity based on extraction-run
counts.

## Existing Foundations to Reuse

- Canonical consolidation already provides structured LLM output, quality validation, one retry,
  `runSkill`, provider/model trace metadata, coverage audit, and conflict-aware review. Reuse its
  behavior, not its transcript-only data shape.
- `CanonicalIdeaNode` carries `transcript_id`, `source_candidate_idea_ids`, key claims, tags, and
  LLM provenance. It is the primary wiki selection layer.
- `RunNode` and the Run Monitor provide durable process state for compilation, regeneration, and
  eventual discovery. Compilation must not use page-local loading state as its source of truth.
- The transcript detail already has a canonical-ideas section and consolidation controls. It is the
  manual entry point for the first vertical slice.
- The parent/vault split already reserves `knowledge/wikis/` and `knowledge/knowledge-graphs/` for
  promoted artifacts. The nested vault repository remains the home for runtime drafts.

## Progress

- [ ] Phase 0 - establish contracts, fixtures, and performance guardrails
- [ ] Phase 1 - manual wiki-draft compilation from canonical ideas
- [ ] Phase 2 - review and promote a new wiki page
- [ ] Phase 3 - reviewed updates, novelty, and conflict handling
- [ ] Phase 4 - evidence locators and citation enrichment
- [ ] Phase 5 - automatic topic discovery and candidate queue
- [ ] Phase 6 - derived wiki-link graph and browsing
- [ ] Phase 7 - external research and verification adapters

---

## Phase 0 - Contracts, Fixtures, and Guardrails

**Outcome:** The data boundary and test vocabulary exist before the feature writes either
repository.

- [ ] Define a dedicated knowledge-artifact model under
      `packages/schemas/src/knowledge/`; do not add promoted wikis to the vault `LabNode` union.
- [ ] Define and export shared schemas/types for `KnowledgeWikiPage`, `WikiDraftNode`,
      `WikiCandidateNode` (reserved for Phase 5), `WikiSourceRef`, `WikiLink`, section drafts,
      compile input/output, topic resolution, validation warnings, and lifecycle/verification
      enums.
- [ ] Add `wiki-draft` to the vault node type/schema map with required provenance, operation,
      draft status, represented/omitted canonical ideas, base revision/hash, proposed links,
      quality result, LLM trace, and review decision fields.
- [ ] Reserve `wiki-candidate` in the schema only when its Phase 5 persistence contract is ready;
      do not create candidate files during the manual-first phases.
- [ ] Decide and document frontmatter keys and Markdown rendering rules for
      `knowledge/wikis/<id>.md`, including stable section ids, source-reference definitions,
      typed links, `revision`, timestamps, lifecycle, verification state, and aliases.
- [ ] Add a `KNOWLEDGE_ROOT` resolver and small read/list/write/validate utilities separate from
      `VAULT_ROOT`; test that parent knowledge writes cannot traverse into `vault/`, and vault
      helpers cannot write into `knowledge/`.
- [ ] Choose a deterministic content-hash canonicalization rule for wiki Markdown/frontmatter and
      record it beside the schema; hash stability is required for safe update/rebase behavior.
- [ ] Add fixture builders for transcripts, sources, ideas, canonical ideas, existing wiki pages,
      timestamp markers, duplicate topics, conflicts, and manually edited sections.
- [ ] Add a fixture corpus to exercise one-source seed creation, multi-source growth, no-op,
      duplicate-topic, stale-draft, and contested-evidence cases without a live model.
- [ ] Benchmark the existing vault-node reads used by the transcript page and record a baseline.
      Wiki work must not introduce more unbounded `listNodes()` scans in request paths; use typed
      reads/indexes where a selected id or known node type is available.
- [ ] Add a design note to `docs/process/VAULT_KNOWLEDGE_REPOS.md` only if the implemented
      contracts change the existing promotion rules; do not duplicate the full plan there.

**Exit criteria**

- [ ] Schema fixtures validate through Zod and invalid ids, paths, link relations, or source refs
      fail deterministically.
- [ ] A test proves knowledge and vault writes stay in their respective repositories.
- [ ] The Markdown contract can round-trip a wiki page without losing frontmatter or body.

---

## Phase 1 - Manual Wiki-Draft Compilation

**Outcome:** A user can select canonical ideas from one transcript and create a validated,
reviewable `wiki-draft` in the vault. No knowledge file is written.

### Compiler and Evidence

- [ ] Create a server-owned wiki compiler service rather than adding long-lived compiler logic to
      a route barrel or transcript component.
- [ ] Implement manual source selection input: canonical idea ids, optional target wiki id, and
      optional suggested title.
- [ ] Resolve selected canonical ideas by id and verify they belong to the selected transcript for
      the first UI flow; keep the compiler contract able to accept cross-transcript selections
      later.
- [ ] Expand each canonical idea to a focused evidence packet: candidate-idea lineage, parent
      transcript, linked source, title/author/URL, relevant excerpt, and available timestamp
      locator. Deduplicate overlapping evidence and exclude whole transcripts by default.
- [ ] Build deterministic topic resolution for the no-existing-wiki case: normalize/validate a
      suggested topic key and return `create`, `no-op`, or `needs-review` before calling the model.
- [ ] Add `wiki-compile` to the LLM routing/configuration layer and invoke it through the existing
      control/provider path, with an explicit model override only where existing LLM conventions
      support one.
- [ ] Define a compact structured compiler prompt and Zod output contract. Require operation,
      topic identity, title/aliases, summary, stable sections, source refs, proposed links,
      coverage, omitted-idea reasons, unresolved questions, contested claims, and change summary.
- [ ] Validate model output before any write: only requested canonical ids may appear, every
      substantive section needs source refs, refs must resolve, ids must not be invented, section
      and reference ids must be unique, and links remain draft warnings until Phase 2 validates
      promoted targets.
- [ ] Compute deterministic quality score and warnings from coverage, citation completeness,
      source diversity, coherence, duplication risk, link validity, novelty, and conflicts.
- [ ] Permit one quality-triggered retry, record both attempts in the RunNode, and never promote
      automatically after either attempt.
- [ ] Render validated structured output into the proposed complete Markdown body and persist a
      `wiki-draft` node under the nested vault repository with full LLM/run provenance.

### Server API and Durable State

- [ ] Add a typed route/schema for
      `POST /api/vault/transcripts/:id/wiki-drafts` and a direct service entry point suitable for
      future non-UI callers.
- [ ] Execute compilation through `runSkill` (for example, `compile-wiki-draft`) so it appears in
      the shared Run Monitor from the moment it starts.
- [ ] Persist entry path, selected canonical/transcript/source counts, proposed operation, topic
      identity, target wiki id, quality score, warnings, produced draft id, model/provider, token
      counts, duration, and terminal decision in the RunNode.
- [ ] Return structured result data sufficient for the UI to navigate to the new draft rather than
      relying on a fresh full-vault scan.
- [ ] Add route/unit tests for invalid selection, missing canonical ideas, one-source seed draft,
      invented ids, missing citations, failed quality retry, and a successful persisted draft.

### Client Entry Flow

- [ ] Add `Create / Update Wiki` beside the canonical-ideas section in transcript detail, using
      the established canonical-idea controls and durable run state.
- [ ] Let the user select one or more canonical ideas, set an optional title, and choose a new
      topic; do not expose heat scoring, research settings, or raw model controls in V1.
- [ ] Add client query/mutation hooks with targeted invalidation for transcript canonical ideas,
      wiki drafts, and the Run Monitor.
- [ ] Surface pending, failed, validation-warning, and completed states without losing progress on
      navigation or page remount.

**Exit criteria**

- [ ] A selected canonical-idea set creates a `seed` draft in `vault/` with complete provenance.
- [ ] No Phase 1 action writes `knowledge/`.
- [ ] The draft is backed by a visible RunNode and all fixture tests pass without live inference.

---

## Phase 2 - Review and Promotion of New Wiki Pages

**Outcome:** A reviewed create draft becomes one validated Markdown page in
`knowledge/wikis/`; the user can inspect exactly what will be promoted.

### Knowledge Repository Operations

- [ ] Implement validated knowledge wiki list/read/write operations using the Phase 0 frontmatter
      contract and `KNOWLEDGE_ROOT`.
- [ ] Add a deterministic wiki index built from `knowledge/wikis/*.md` for id, topic key, aliases,
      lifecycle, source counts, and link targets. It may be in memory or cached, but must be
      rebuildable from files.
- [ ] Reject duplicate id/topic key, invalid source refs, malformed Markdown/frontmatter, and links
      to absent promoted pages before a promotion write.
- [ ] Implement promotion as a single explicit write with revision `1`, a reviewed timestamp, and
      `source-backed` verification by default. Do not stage, commit, or push Git changes.
- [ ] Mark accepted vault draft metadata after a successful promotion and retain it as immutable
      provenance; failed promotion leaves the draft reviewable and unaccepted.
- [ ] Add typed routes for `GET /api/knowledge/wikis`, `GET /api/knowledge/wikis/:id`, and
      `POST /api/vault/wiki-drafts/:id/promote`.

### Review UX

- [ ] Build a wiki-draft detail route that displays proposed title/summary, operation, rendered
      article, selected canonical ideas, transcript/source refs, quality score, warnings,
      unresolved questions, contested claims, proposed links, and model metadata.
- [ ] For a create draft, show a clear new-page preview and the target path under
      `knowledge/wikis/`.
- [ ] Add explicit `Promote`, `Reject`, `Edit Draft`, and `Regenerate` actions. Rejection changes
      only draft status; it does not delete evidence or RunNode history.
- [ ] Add a read-only wiki index and wiki-detail route for promoted pages with title, summary,
      lifecycle, verification state, source count, linked-page count, and last updated time.
- [ ] Use existing page/detail layouts, shadcn primitives, Lucide icons, and `Row`/`Col` structural
      layout rules. Keep the article/review interface operational and dense rather than landing-page
      styled.

### Tests

- [ ] Test create promotion, duplicate topic rejection, malformed draft rejection, invalid source
      ref rejection, accepted/rejected draft transitions, and no Git command invocation.
- [ ] Add client tests for review-state rendering and mutation invalidation where local patterns
      exist.
- [ ] Add a manual test: generate a draft, inspect it, promote it, refresh the app, and verify the
      page persists in `knowledge/wikis/` while the vault keeps the draft provenance.

**Exit criteria**

- [ ] A user can manually turn canonical ideas from one transcript into one reviewed, committed-by-
      user knowledge Markdown page.
- [ ] Promotion never writes a vault file as the canonical wiki or mutates Git state.
- [ ] Every promoted section has resolvable provenance.

---

## Phase 3 - Reviewed Updates, Novelty, and Conflicts

**Outcome:** New evidence produces a safe update proposal rather than an uncontrolled rewrite.

- [ ] Extend topic resolution in priority order: exact topic key, alias, normalized title, tag/domain
      overlap, represented canonical-idea overlap, then optional semantic similarity.
- [ ] Resolve `create`, `update`, `no-op`, and `needs-review` before compilation; never silently
      create a near-duplicate page.
- [ ] For `update`, include only the existing wiki's compact metadata, relevant sections, and new
      evidence in the compiler input; do not send every wiki body or the full vault.
- [ ] Add deterministic novelty analysis. Accept proposed changes only for new supported claims,
      meaningful corrections, contradictions, new distinctions/mechanisms, materially stronger
      support, relevant relationships, or obsolete-content removal.
- [ ] Persist `base_revision`, `base_content_hash`, structured section-level patch, proposed
      rendered result, and change summary in the wiki draft.
- [ ] Add a diff renderer for existing-wiki updates and show untouched manual sections separately
      from proposed changes.
- [ ] On promote, compare expected revision/hash to the current knowledge file. Reject stale
      drafts, retain them, and offer regenerate/rebase; never apply against a changed page.
- [ ] Preserve untouched sections and manual content. Increment revision, timestamps, provenance,
      and lifecycle only after an accepted write.
- [ ] Apply lifecycle-aware novelty thresholds: permissive useful growth for `seed`, meaningful
      additions for `growing`, and substantial correction/evidence/improvement for `mature`.
- [ ] Handle contradictory evidence as an explicit contested-claim proposal with both evidence
      groups; it cannot silently replace a prior claim.
- [ ] Add `needs-review` UI that presents existing-page context and lets the user choose an update
      target or confirm a genuinely distinct topic.
- [ ] Test no-op from identical evidence, manual-edit preservation, stale hash/revision rejection,
      duplicate topic detection, conflict retention, lifecycle thresholds, and contested claims.

**Exit criteria**

- [ ] A second transcript can generate a reviewed update diff for an existing wiki.
- [ ] Identical evidence produces a no-op or negligible proposal.
- [ ] Manual knowledge edits survive later compilation and stale drafts cannot overwrite them.

---

## Phase 4 - Evidence Locators and Citation Enrichment

**Outcome:** Provenance progresses from transcript-level references to useful claim-level evidence
without inventing precision the current data cannot support.

- [ ] Define a transcript-span resolver that maps candidate/canonical ideas to bounded excerpts and
      stable locators where extraction data permits it.
- [ ] Preserve YouTube timestamp markers and generate deep links only when the timestamp mapping is
      reliable; otherwise retain transcript-level citation with an explicit limitation.
- [ ] Store normalized source refs in frontmatter and render stable reference identifiers in the
      article body without treating raw URLs as the source of truth.
- [ ] Add verification-state semantics and display: `source-backed`, `corroborated`, and
      `contested`. V1-generated transcript claims default to `source-backed`.
- [ ] Add validator checks for source-ref resolution, section citation completeness, duplicate refs,
      unsupported locators, and model-invented URLs or node ids.
- [ ] Add transcript/source/citation affordances to wiki and draft details, including deep links
      where available.
- [ ] Test timestamp extraction, fallback citation behavior, malformed locator rejection, and
      citation rendering round trips.

**Exit criteria**

- [ ] Each substantive wiki section exposes resolvable evidence.
- [ ] The UI never presents a transcript-derived claim as independently verified fact.

---

## Phase 5 - Automatic Discovery and Candidate Queue

**Outcome:** LLAAB can suggest coherent wiki work across transcripts without writing or promoting
knowledge automatically.

- [ ] Add bounded discovery inputs over canonical ideas only; exclude candidate-idea volume,
      repeated extraction runs, duplicate wording, and same-transcript repetitions from demand
      scoring.
- [ ] Implement deterministic pre-clustering using normalized tags/domains, title/body similarity,
      shared key claims, transcript/source diversity, existing-wiki coverage, and optional
      embeddings when an established local capability exists.
- [ ] Apply configurable starting eligibility: at least three relevant canonical ideas across at
      least two transcripts. Keep the thresholds configuration, not constants hidden in a prompt.
- [ ] Add deterministic existing-wiki matching and represented-evidence subtraction before scoring
      a cluster.
- [ ] Compute explainable heat and novelty scores from canonical idea count, unique transcripts,
      unique sources/authors, diversity, recency, graph centrality when available, and unrepresented
      evidence.
- [ ] Add optional `wiki-discover` LLM route only to judge cluster coherence, propose/split/merge
      topics, and identify likely existing pages. The model cannot be the sole clustering system.
- [ ] Persist scored `wiki-candidate` nodes in the vault with supporting ids, discovery inputs,
      match candidates, recommendation, warnings, and model provenance where used.
- [ ] Add candidate list/detail APIs and a queue UI with topic, heat, novelty, transcript/source
      counts, existing wiki match, and create/update recommendation.
- [ ] Let a user explicitly select a candidate and pass its canonical ideas into the same Phase 1
      compiler. Discovery itself cannot generate a promoted page.
- [ ] Add deterministic cluster/score fixtures and tests proving duplicate extraction runs do not
      increase heat.

**Exit criteria**

- [ ] Automatic discovery creates reviewable vault candidates only.
- [ ] Candidate scoring reflects evidence diversity and novelty, not extraction noise.

---

## Phase 6 - Derived Wiki-Link Graph and Browsing

**Outcome:** Promoted wiki frontmatter yields a useful, rebuildable graph without a second graph
source of truth.

- [ ] Finalize the controlled directed relation vocabulary: `related-to`, `depends-on`, `extends`,
      `contrasts-with`, `example-of`, `supports`, and `supersedes`.
- [ ] Validate proposed links during draft review and final links during promotion: targets exist,
      relation is allowed, no duplicate edge, and a broad shared tag alone is not sufficient
      justification.
- [ ] Build graph nodes/edges from `knowledge/wikis/*.md`; derive reverse relations in reads rather
      than storing duplicate reverse edges.
- [ ] Add graph-index diagnostics for broken targets, malformed links, duplicate ids/topic keys,
      and isolated pages. The index must rebuild from knowledge files alone.
- [ ] Add related-page browsing to wiki details before a full visual graph.
- [ ] Add graph/search APIs and then an interactive graph view using a proven graph library only
      after the derived-data contract is stable.
- [ ] Optionally export reviewed graph summaries to `knowledge/knowledge-graphs/`; exports cannot
      become the authoritative edge store.
- [ ] Test graph rebuild, link validation, reverse derivation, invalid-link diagnostics, and export
      reproducibility.

**Exit criteria**

- [ ] Every displayed graph edge resolves to a promoted wiki page.
- [ ] Deleting the derived index and rebuilding from wiki files reproduces the graph.

---

## Phase 7 - External Research and Verification Adapters

**Outcome:** The system can enrich selected wikis with explicit authoritative research while
keeping transcript provenance distinct from verification.

- [ ] Define an opt-in research request and budget/approval policy; research never runs as a hidden
      side effect of manual compilation or discovery.
- [ ] Add a dedicated research adapter/task, separate source-ref kinds for external evidence, and
      persisted research RunNode provenance.
- [ ] Require authoritative-source retrieval, citation validation, and explicit attribution before
      setting a claim or page to `corroborated`.
- [ ] Detect and represent contradictions as contested evidence for review rather than choosing a
      winner automatically.
- [ ] Extend draft review to show transcript-derived and external evidence separately.
- [ ] Add fixture-backed adapter tests, source-quality/error cases, and manual cost/budget testing.

**Exit criteria**

- [ ] External research is explicit, traceable, reviewable, and never silently changes a wiki.

---

## Cross-Cutting Quality and Verification

- [ ] Keep all server write routes schema-validated and route modules thin; place compiler,
      evidence, topic-resolution, knowledge-storage, validation, and graph logic in purpose-named
      services/utilities.
- [ ] Add focused unit tests for schemas, Markdown codec, hash/revision, evidence expansion, topic
      resolution, novelty, quality scoring, and graph derivation.
- [ ] Add server route tests using temporary vault/knowledge roots. Assert writes and Git status are
      scoped to the expected repository.
- [ ] Add integration coverage for create draft -> review -> promote -> update draft -> stale
      rejection -> rebase/regenerate.
- [ ] Add client tests for selection, durable run state, draft review, promotion/rejection, diff,
      and conflict states where the existing test setup supports them.
- [ ] Run the smallest relevant typecheck, lint, formatter, and test commands for each phase; run a
      parent-repo Git status check before and after manual promotion tests.
- [ ] After server, server-consumed package, or root environment changes, use the required
      `scripts/macos/dev-refresh.sh` path before browser verification.

## Manual Acceptance Journey

- [ ] Consolidate one transcript into canonical ideas.
- [ ] Select a subset and create a wiki draft; verify evidence excludes unrelated transcript text.
- [ ] Review the generated article, provenance, quality warnings, and RunNode metadata.
- [ ] Promote a valid create draft and verify exactly one page appears in `knowledge/wikis/`.
- [ ] Make a deliberate manual edit to the promoted page.
- [ ] Select canonical ideas from a second transcript and create an update proposal.
- [ ] Verify the diff preserves the manual edit; promote once and verify revision/hash change.
- [ ] Re-run with unchanged evidence and verify `no-op` or negligible diff.
- [ ] Create overlapping evidence and verify `needs-review`, not a duplicate wiki.
- [ ] Verify a rejected, stale, low-quality, or contested draft remains reviewable and never
      changes promoted knowledge.

## Follow-Up Documentation

- [ ] Update [Vault and Knowledge Repositories](../process/VAULT_KNOWLEDGE_REPOS.md) with the
      implemented wiki-draft -> review -> promotion workflow.
- [ ] Add an operator-facing wiki workflow document once the first vertical slice is stable; keep
      this TODO as the implementation record rather than duplicating operational guidance here.
- [ ] Update the Roadmap priority/link and `ROADMAP.md#next` only when this initiative is
      scheduled or a phase becomes active.
