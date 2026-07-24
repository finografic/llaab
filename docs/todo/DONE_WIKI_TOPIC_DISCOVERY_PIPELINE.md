# DONE — One-Step Topic-Oriented Wiki Generation

> **Completed:** 2026-07-19 — One `Create Wiki(s)` action runs internal discover → compile → link →
> auto-promote into `knowledge/wikis/`; drafts/candidates are diagnostic only; greedy grouping and
> invented topic-key suffixing are out of the production path.

> **Priority:** P1 — refine the shipped wiki-generation path before treating transcript-wide
> generation as canonical knowledge.
> **Design authority:** [Wiki Creation Spec](/.agents/WIKI_CREATION_SPEC.md), as amended by the
> one-visible-step product decision in this plan.
> **Predecessor:** [Completed Wiki Generation Plan](/docs/todo/DONE_WIKI_GENERATION.md)

---

## Goal

Keep wiki creation as one user-visible action:

```text
Transcript + Canonical Ideas
  -> [Create Wiki(s)]
  -> One or More Auto-Promoted Wiki Pages
```

Topic discovery, clustering, existing-wiki resolution, evidence expansion, per-topic compilation,
quality validation, link resolution, retry, internal draft persistence, and promotion may all happen
under the hood. None of them becomes a required user review, draft, selection, or promotion step.

The internal pipeline is:

```text
selected canonical ideas
  -> discover one or more coherent wiki topics
  -> validate topic proposals and evidence roles
  -> compile each valid topic from only its relevant evidence
  -> resolve typed links after all topic identities are known
  -> auto-promote valid creates/updates
  -> return all resulting wiki pages
```

A broad transcript may produce several wikis; a focused transcript may produce one. The count must
emerge from topic coherence and existing knowledge coverage, not transcript boundaries, one page
per domain tag, or a fixed quota.

## Non-Negotiable User Experience

- The normal transcript flow exposes one action: `Create Wiki(s)`.
- The user does not review topic proposals before compilation.
- The user does not review or promote wiki drafts.
- The user does not choose between manual and automatic creation modes.
- The user does not choose the number of output pages, titles, topic keys, or existing-wiki targets.
- Internal `wiki-candidate` and `wiki-draft` artifacts may remain for provenance, recovery,
  regeneration, and diagnostics, but they are not workflow stages presented to the user.
- Successful output is automatically promoted to `knowledge/wikis/` and shown as rendered wiki
  pages.
- If the system cannot safely resolve a topic after bounded correction attempts, it must retain an
  internal diagnostic and report that branch as failed or skipped. It must not ask the user to
  complete a review/promotion workflow.
- After creation, the user may correct the knowledge base through post-creation actions such as
  demote/unpublish, delete, delete a section, or regenerate a section. These are corrective actions,
  not required creation stages.

## Problem Statement

The shipped transcript action already auto-promotes, but its grouping step is an over-simplified
greedy token/domain heuristic. It bypasses the richer discovery path, then compiles every group
immediately. This can produce a source-shaped digest, one section per canonical idea, weak topic
identities, misleading evidence counts, and poor graph structure even when canonical-idea coverage
is 100%.

The current automatic promotion path also converts `needs-review` into a distinct create topic with
a suffixed key. The refined one-step flow must resolve ambiguity internally, omit/fail the unsafe
branch, or update a confidently matched page. It must never invent a distinct canonical topic merely
to avoid an internal blocker.

The correction separates three model-facing responsibilities while preserving one user action:

1. `wiki-discover` — propose coherent topics and assign evidence roles.
2. `wiki-compile` — synthesize one topic from a bounded evidence packet.
3. `wiki-link` — suggest typed, justified relationships after all topic identities are known.

## Product Contract

- Canonical ideas are reusable evidence ingredients, not mandatory wiki headings.
- A wiki is identified by one durable topic, independent of the transcript that introduced it.
- Fine content tags and semantic claims are the primary clustering signals. `d:*` domain tags are
  coarse constraints and navigation facets, never article identities by themselves.
- One canonical idea may be primary evidence for one topic and supporting evidence for other topics.
  The canonical idea remains one immutable node; it is not split or duplicated.
- Internal discovery returns zero to many proposals and accounts for every selected canonical idea
  as primary, supporting, or omitted with a reason.
- A successful one-step run returns at least one resulting wiki. Already-covered topics return the
  existing page or a safe update rather than manufacturing a duplicate.
- Each compiler invocation receives only one topic's primary/supporting ideas and targeted evidence,
  not every canonical idea from the transcript.
- Every valid create/update is auto-promoted. Internal drafts are audit and recovery artifacts, not
  user approval gates.
- An unresolved `needs-review` result cannot auto-promote. The orchestrator attempts bounded
  automatic resolution, then records a failed/skipped branch without requiring another user step.
- Coverage and topic coherence are separate quality dimensions. Complete batch coverage cannot
  compensate for an incoherent individual page.
- Evidence-reference count is not source diversity. Multiple timestamps in one transcript remain
  one transcript and one independent source.
- `contested` requires actual conflicting evidence. A single-source page is `source-backed`.
- Promoted Markdown remains the source of truth; graph/index data stays derived and rebuildable.
- All processing remains one-shot and explicitly user-triggered. This initiative adds no watcher,
  scheduler, polling worker, or autonomous rewrite loop.

## Current Implementation Seams

| Surface                                                                                            | Current behavior                                                                                        | Required refinement                                                                                                |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Transcript grouping service](/apps/server/src/routes/vault/wiki-draft-generation.service.ts)      | Greedily joins ideas by shared normalized words and domain overlap.                                     | Replace grouping with bounded internal `wiki-discover` proposals.                                                  |
| [Cross-vault discovery skill](/packages/skills/src/wiki/discover-wiki-candidates.ts)               | Produces one candidate per deterministic cluster; optional model review cannot split or merge clusters. | Return a validated zero-to-many proposal bundle with evidence roles and batch coverage.                            |
| [Discovery clustering utility](/packages/skills/src/wiki/wiki-discovery.utils.ts)                  | Uses the first `d:*` tag and term-overlap threshold; derives topic identity largely from the domain.    | Weight fine tags and semantic claims, treat domains as coarse constraints, and support bounded split/merge.        |
| [Wiki candidate schema](/packages/schemas/src/wiki-candidate-node.schema.ts)                       | Stores one undifferentiated canonical-idea list.                                                        | Add rationale, primary/supporting ids, batch identity, coverage, coherence, and explicit existing-wiki resolution. |
| [Transcript draft route](/apps/server/src/routes/vault/vault-wiki-drafts.routes.ts)                | Compiles every heuristic group and auto-promotes it.                                                    | Orchestrate discover → compile per topic → link → auto-promote behind the same one-click request.                  |
| [Auto-promotion service](/apps/server/src/routes/vault/wiki-auto-promotion.service.ts)             | Converts `needs-review` to `create` with a suffixed topic key.                                          | Auto-promote valid output only; never invent a topic to bypass ambiguity.                                          |
| [Compile prompt](/packages/skills/src/wiki/wiki-compile-prompt.utils.ts)                           | Has no primary/supporting role contract or explicit topic-coherence rules.                              | Compile one proposal, synthesize across ideas, and reject source-shaped sectioning.                                |
| [Compile validator](/packages/skills/src/wiki/wiki-compile-validation.utils.ts)                    | Scores issue counts and uses a coarse source count.                                                     | Add coherence, evidence-role coverage, source diversity, and claim-level verification rules.                       |
| [Transcript composer](/apps/client/src/components/WikiDraftComposer/WikiDraftComposer.tsx)         | Already exposes one `Create Wiki` action.                                                               | Preserve one action while routing it through the refined internal pipeline.                                        |
| [Promoted wiki review service](/apps/server/src/routes/knowledge/knowledge-wiki-review.service.ts) | Supports promoted section deletion and source-lineage regeneration.                                     | Preserve post-creation correction behavior with new proposal-scoped internal lineage.                              |

## Progress

- [x] Phase 0 — lock the one-step contract and regression fixtures
- [x] Phase 1 — add internal proposal, evidence-role, and diversity schemas
- [x] Phase 2 — build internal transcript-scoped topic discovery
- [x] Phase 3 — compile each discovered topic coherently
- [x] Phase 4 — resolve links and auto-promote in one orchestration run
- [x] Phase 5 — correct quality, source diversity, and verification semantics
- [x] Phase 6 — preserve the one-action UI and post-creation controls
- [x] Phase 7 — migrate safely, validate end to end, and update documentation

---

## Phase 0 — One-Step Contract and Regression Fixtures

**Outcome:** The required UX and source-shaped failure mode are executable tests before pipeline
behavior changes.

### One-step invariants

- [x] Define one public transcript operation, for example
      `POST /api/vault/transcripts/:id/wikis`, accepting the selected canonical idea ids and
      returning all resulting promoted wiki pages.
- [x] Keep `Create Wiki(s)` as the only normal user action. Checkbox selection is input context,
      not a separate discovery/approval workflow.
- [x] Specify the internal stages as implementation details that may be persisted in RunNode events
      but are never required user decisions.
- [x] Define branch outcomes: `promoted-create`, `promoted-update`, `existing-no-op`, `skipped`, and
      `failed`.
- [x] Define overall success as at least one promoted or confidently matched existing wiki. Return
      structured partial results when sibling topics are skipped/failed.
- [x] Define a deterministic auto-promotion policy function. It must require a resolved operation,
      passing topic/coherence/evidence gates, valid links/source refs, and a current base revision for
      updates.
- [x] Define bounded internal correction: malformed output, low coherence, or ambiguous topic
      resolution may retry/re-resolve automatically, but the process must terminate without user
      review.
- [x] Prohibit any normal-flow response that instructs the user to open a draft and promote it.

### Regression corpus

- [x] Add a fixture representing the broad multi-agent/Hermes transcript described in the
      refinement brief, including fine tags, multiple `d:*` domains, key claims, timestamps, and a
      single source/channel identity.
- [x] Define expected topic families without requiring one exact count. Assert that the result
      contains multiple coherent topics, with an acceptable range such as 5–6, and never one
      transcript-shaped mega-page.
- [x] Include plausible families for isolation/architecture, proactive automation, interaction
      surfaces, self-improvement, context/memory, and least-privilege security.
- [x] Assert that a cross-cutting idea can be primary in one topic and supporting in another without
      creating a second canonical-idea node.
- [x] Add a genuinely single-topic transcript fixture that should produce exactly one wiki.
- [x] Add an already-covered fixture that returns the existing wiki or a safe update, not a duplicate.
- [x] Add an ambiguous-overlap fixture that must never become an auto-suffixed create topic.
- [x] Add actual contradictory evidence and non-contradictory single-source fixtures so
      `contested` semantics are independent from source diversity.

### Baseline characterization

- [x] Add characterization tests for the current grouping service, discovery skill, transcript
      route, auto-promotion policy, and section-regeneration lineage.
- [x] Capture a structured baseline for topic count, titles, idea assignments, per-page coherence,
      source metrics, verification state, promoted outputs, and internal audit artifacts.
- [x] Preserve existing successful update, revision/hash, citation, delete, section correction, and
      graph tests as non-regression gates.

**Exit criteria**

- [x] Tests reproduce the oversized source-shaped result under the old path and enforce the refined
      one-step result contract.
- [x] Auto-promotion and bounded-failure rules are deterministic assertions.
- [x] No test writes into the live vault or `knowledge/wikis/`.

---

## Phase 1 — Internal Proposal, Evidence-Role, and Diversity Contracts

**Outcome:** Discovery, compilation, metrics, and orchestration share one validated internal
contract without exposing a proposal-review workflow.

### Topic proposal result

- [x] Add a shared `WikiTopicProposalSchema` with:
      `topic_key`, `title`, `rationale`, `primary_canonical_idea_ids`,
      `supporting_canonical_idea_ids`, `domains`, `tags`, `operation`, optional
      `existing_wiki_id`, match reasons, coherence score, warnings, and model provenance.
- [x] Add a shared `WikiDiscoveryResultSchema` containing a proposal array plus batch coverage:
      primary-assigned ids, supporting-used ids, and omitted ideas with reasons.
- [x] Add a discovery batch/run id to every internal proposal so compilation, promotion, and section
      regeneration can trace back to one user action.
- [x] Extend `WikiCandidateNodeSchema` or introduce an internal proposal record with backward-
      compatible defaults. Do not rewrite historical vault files.
- [x] Require at least one primary idea per proposal; primary and supporting sets within a proposal
      must be disjoint.
- [x] Require each selected idea to be primary in at most one proposal by default. Supporting use
      may repeat when the rationale explains the role.
- [x] Reject proposal bundles containing invented ids, duplicate topic keys, duplicate normalized
      titles, empty rationales, unresolved existing-wiki ids, or unaccounted selected ideas.
- [x] Treat proposal count guidance as a model hint and quality signal, never a schema quota.

### Compiler input

- [x] Extend `CompileWikiDraftInput` and the prompt payload with one internally validated proposal
      and separate primary/supporting canonical-idea arrays.
- [x] Retain flattened source ids for promoted compatibility while persisting evidence roles on the
      internal draft for audit and section regeneration.
- [x] Build evidence only for the current proposal and record which idea roles caused each excerpt
      to be selected.
- [x] Keep candidate related-wiki summaries separate from link decisions; shared tags may select
      comparison candidates but may not create an edge.

### Evidence and source metrics

- [x] Add `WikiEvidenceMetricsSchema` with separate counts for evidence refs, unique canonical
      ideas, unique transcripts, unique source nodes, unique authors/channels, and independent
      sources.
- [x] Define a conservative source-origin identity helper. Multiple excerpts/timestamps from one
      transcript count once; multiple transcripts from one author/channel do not automatically
      establish independent corroboration.
- [x] Preserve missing source identity as unknown. Missing metadata must not create synthetic
      diversity.
- [x] Persist stable historical metrics on internal drafts/promoted pages where needed; derive
      display-only counts from source refs when persistence would duplicate truth.
- [x] Migrate `selected_source_count` consumers to the explicit metrics contract before deprecating
      the ambiguous field.

### Verification semantics

- [x] Centralize `source-backed`, `corroborated`, and `contested` calculation in one purpose-named
      verifier.
- [x] Set `source-backed` when claims resolve to supplied evidence without independent
      corroboration or contradiction.
- [x] Set `corroborated` only when the same material claim is supported by at least two independent
      sources or a validated authoritative external source.
- [x] Set `contested` only when normalized claims have explicit opposing evidence groups.
- [x] Keep low diversity, unresolved questions, ambiguity, and weak citations as separate issues;
      none alone implies `contested`.

**Exit criteria**

- [x] Shared Zod schemas round-trip persisted proposal/draft fixtures and reject invalid roles or
      coverage.
- [x] Twelve timestamps from one transcript report 12 evidence refs, one transcript, one
      author/channel, and one independent source.
- [x] Single-source non-conflicting material validates as `source-backed`.

---

## Phase 2 — Internal Transcript-Scoped Topic Discovery

**Outcome:** One user request produces a bounded zero-to-many internal topic set before any article
is compiled, without exposing a proposal screen.

### Deterministic candidate graph

- [x] Replace the greedy first-match grouping algorithm with an order-independent similarity graph
      or equivalent deterministic clustering stage.
- [x] Normalize and weight fine content-tag overlap more strongly than domain overlap.
- [x] Include title/body/key-claim similarity and meaningful noun phrases; remove broad project
      terms and domain labels from topic-key derivation.
- [x] Use `d:*` domains as compatibility constraints or down-ranking signals. Permit justified
      cross-domain topics and prohibit one-page-per-domain behavior.
- [x] Include existing-wiki coverage before proposal creation so represented evidence becomes an
      update/no-op rather than a duplicate create.
- [x] Make optional embeddings a replaceable similarity input, not a required runtime service.
- [x] Ensure clustering is deterministic for the same ideas regardless of input order.
- [x] Bound discovery by the request's canonical idea ids and compact existing-wiki summaries; do
      not scan or prompt with unrelated vault content.

### `wiki-discover` model stage

- [x] Replace the current one-cluster/one-review response with the shared zero-to-many proposal
      bundle contract.
- [x] Permit the model to split broad deterministic components, merge adjacent compatible
      components, omit non-wiki material with reasons, and assign primary/supporting roles.
- [x] Supply canonical idea titles, bodies/key claims, fine tags, domains, and compact existing-wiki
      matches. Do not supply full transcripts at discovery time.
- [x] Require source-independent titles unless the topic is specifically the named product,
      person, project, or source.
- [x] Require a rationale explaining why primary ideas form one reusable article and why supporting
      ideas belong only as context/evidence.
- [x] Validate every returned id and existing-wiki target against deterministic inputs.
- [x] Reject output that collapses broad ideas into one source-shaped topic or mechanically returns
      one topic per domain.
- [x] Permit one bounded retry for malformed or invalid proposals; record both attempts in the
      parent `RunNode`.

### Automatic topic resolution

- [x] Run exact topic key, alias, normalized title, canonical-idea overlap, fine-tag similarity,
      and semantic matching against the current wiki index for every proposal.
- [x] Resolve `create`, `update`, and `no-op` automatically where confidence is sufficient.
- [x] For an ambiguous match, run one bounded resolution pass using only the competing wiki
      summaries and proposal evidence.
- [x] If ambiguity remains, mark that internal branch skipped/failed with a durable reason. Do not
      create a suffixed topic and do not request user review.
- [x] Make repeated discovery idempotent by a stable input/content hash while retaining historical
      run traces when source evidence or the wiki index changes.
- [x] Keep global cross-transcript discovery only as an internal/operator capability using the same
      contract; it must not create a second end-user creation workflow.

**Exit criteria**

- [x] The broad regression transcript produces several coherent internal proposals and not one
      source digest.
- [x] A focused transcript still produces one proposal; already-covered material resolves to an
      existing page or safe update.
- [x] Proposal output is input-order stable and every selected idea is accounted for.
- [x] No proposal or candidate review is required from the user.

---

## Phase 3 — Coherent Per-Topic Compilation

**Outcome:** Every discovered topic compiles independently into a synthesized article rather than a
formatted list of canonical ideas.

### Orchestration and evidence bounds

- [x] Replace `groupCanonicalIdeasForWikiDrafts()` with internally resolved Phase 2 proposals.
- [x] Compile proposals sequentially or with bounded concurrency through existing one-shot
      `runSkill` behavior; add no background worker.
- [x] Give every compile run the parent user-action run id, discovery batch id, and proposal id.
- [x] Use only the proposal's primary/supporting ideas, targeted transcript excerpts, target wiki
      for updates, and compact related-wiki candidates in each compile call.
- [x] Never send every transcript idea to every compiler merely because topics share a source.
- [x] Preserve partial results internally: a failed topic does not erase successful sibling pages.
- [x] Persist a `wiki-draft` audit artifact before promotion so provenance, retry, section
      regeneration, and failure diagnosis remain durable. Do not expose it as a user step.

### Prompt behavior

- [x] Add the complete topic proposal, rationale, and primary/supporting roles to the compile prompt.
- [x] Instruct the compiler to synthesize one coherent topic and use source-specific products,
      people, or workflows as examples unless they define the topic itself.
- [x] Explicitly prohibit automatic one-section-per-canonical-idea structure.
- [x] Let structure emerge from claims, mechanisms, distinctions, trade-offs, and examples while
      retaining stable section ids and per-section provenance.
- [x] Require every substantive section to identify its primary/supporting canonical ideas and
      resolvable source refs.
- [x] Permit irrelevant supporting material to be omitted instead of forced into prose.
- [x] Keep titles/topic ids model-generated but validate source independence, distinctness within
      the batch, and collision with existing identities.

### Compilation failure handling

- [x] Keep normalization for harmless schema drift and record `normalization_actions` on the
      internal draft/run.
- [x] Reject output when normalization would invent topic identity, section evidence, claims, or
      other semantic content.
- [x] Retry once only for concrete fixable validation failures; do not retry a fundamentally
      incoherent proposal as JSON formatting.
- [x] Convert terminal proposal failures into structured skipped/failed branch results. Do not send
      the user into a draft review flow.

**Exit criteria**

- [x] Every proposal produces at most one compile run result and one topic-oriented internal draft.
- [x] No compiler receives unrelated sibling-topic ideas.
- [x] Regression pages have source-independent titles and synthesized sections.
- [x] Canonical idea titles do not mechanically become article headings.

---

## Phase 4 — Link Resolution and One-Step Auto-Promotion

**Outcome:** All valid topic pages are linked and promoted before the original user request
completes.

### `wiki-link` stage

- [x] Add `wiki-link` to the LLM task/routing contract and verify the live route in
      [LLM routing configuration](/configs/llm-routing.json).
- [x] Run link suggestion after all topic identities and compile results are validated, using
      compact summaries of successful new/update pages and candidate existing wikis.
- [x] Accept temporary proposal keys and existing wiki ids as targets; resolve temporary keys to
      final promoted ids before writing Markdown.
- [x] Return controlled relations only: `related-to`, `depends-on`, `supports`,
      `contrasts-with`, `extends`, and `example-of`; retain `supersedes` only for explicit lifecycle
      use.
- [x] Require a concise semantic rationale for every link.
- [x] Reject links based only on shared `d:*` domains or generic tag overlap.
- [x] Validate targets, self-links, duplicate directed edges, relation values, and rationales.
- [x] Treat link inference as optional enrichment: if it fails, promote otherwise valid articles
      without the invalid links and record a warning.

### Promotion policy

- [x] Remove `prepareAmbiguousDraft()` behavior. Never turn `needs-review` into `create` or invent a
      suffixed topic key.
- [x] Auto-promote every valid `create` and `update` result within the same orchestration request.
- [x] Resolve a confident `no-op` to the existing promoted wiki and include it in the returned page
      set without rewriting it.
- [x] Require exact represented-evidence/topic resolution for `no-op`; broad subset coincidence is
      insufficient.
- [x] Preserve update base revision/hash checks, manual section edits, atomic writes, and per-wiki
      locks from the completed pipeline.
- [x] Mark internal drafts accepted automatically only after their corresponding knowledge write
      succeeds.
- [x] Keep failed, ambiguous, stale, contested, or low-quality internal artifacts for audit; they
      are not user promotion tasks and never mutate knowledge.

### Unified response and navigation

- [x] Return one ordered result per internal topic with operation, run id, internal draft id,
      promoted/existing wiki id, warnings, and terminal status.
- [x] Return every resulting `KnowledgeWikiPage`, not only the first id.
- [x] Treat one valid page as normal success and multiple valid pages as normal multi-page success.
- [x] Navigate to the single page when only one resulted. For multiple pages, show the first
      rendered page plus a generated-pages list/links, or a read-only result surface requiring no
      further action.
- [x] Surface partial skips/failures as diagnostics alongside successful pages. Do not require the
      user to resolve them to complete the creation flow.

**Exit criteria**

- [x] One click executes discovery, compilation, linking, and promotion to completion.
- [x] Every valid topic becomes a promoted page without user promotion.
- [x] `needs-review`, contested, stale, invalid, or low-quality output cannot mutate knowledge.
- [x] Partial success is durable and understandable without another workflow step.

---

## Phase 5 — Topic Quality, Source Diversity, and Verification

**Outcome:** Promotion gates topic structure accurately and the UI reports evidence without
confusing citation count with independent support.

### Quality dimensions

- [x] Split quality into named dimensions: topic coherence, primary-evidence coverage, citation
      completeness, source diversity, duplication avoidance, update novelty, and link validity.
- [x] Report per-page coverage and batch coverage separately. A page is not penalized for correctly
      excluding ideas assigned to sibling topics.
- [x] Add coherence checks for unrelated sections, source-shaped titles, headings that merely mirror
      idea titles, and unexplained domain breadth.
- [x] Detect over-collapse by claim/topic diversity rather than only section count.
- [x] Detect over-fragmentation when sibling topics or sections repeat the same primary claims.
- [x] Treat fine-tag/semantic alignment as positive evidence; broad domain overlap alone contributes
      no coherence score.
- [x] Use Phase 1 evidence metrics instead of `Math.max(sourceIds, transcriptIds)`.
- [x] Require promotion thresholds per dimension so a high coverage score cannot hide poor topic
      coherence.

### Verification correction

- [x] Calculate verification after claims and source groups are known through the centralized
      verifier.
- [x] Require explicit contradictory claim/evidence pairs before assigning `contested`.
- [x] Keep one-transcript output `source-backed` even when it has many timestamp citations.
- [x] Show low source diversity as a warning and lifecycle input, not as a contradiction.
- [x] Promote to `corroborated` only for the supported claims/pages that satisfy independence rules.

### Display metrics

- [x] Display evidence-reference count, canonical-idea count, transcript count, source/channel
      count, and independent-source count separately on promoted wiki pages.
- [x] Label counts precisely; never show “12 sources” when the data represents 12 timestamp refs in
      one transcript.
- [x] Keep lifecycle (`seed/growing/mature`) separate from verification and generation quality.

**Exit criteria**

- [x] Quality output explains which dimension failed and blocks unsafe promotion deterministically.
- [x] Twelve refs from one transcript display as one independent source and `source-backed`.
- [x] Source-backed, corroborated, and contested fixtures produce distinct correct states.

---

## Phase 6 — One-Action UI and Post-Creation Controls

**Outcome:** The interface keeps one visible creation step while preserving correction and recovery
after pages exist.

### Transcript creation action

- [x] Keep one button labeled `Create Wiki(s)` in the canonical-ideas area.
- [x] Keep canonical-idea checkboxes as optional input selection; do not add a separate discovery
      action, proposal screen, mode picker, title field, topic-key field, target-wiki chooser, draft
      review, or promote action.
- [x] Explain in one short line that the system may create or update one or more focused wiki pages.
- [x] Derive pending state from the parent orchestration RunNode so navigation/remount preserves
      progress through every internal stage.
- [x] Keep elapsed time, success/error alerts, and targeted query invalidation from the current
      composer.
- [x] Show meaningful internal stage labels in the existing Run Monitor if useful, but never render
      them as user tasks.

### Creation result

- [x] For one resulting page, navigate directly to the rendered promoted wiki.
- [x] For multiple resulting pages, show a compact generated-pages list while rendering/navigating
      to the first page; opening siblings is optional browsing, not completion work.
- [x] Report counts of created, updated, already represented, skipped, and failed topics.
- [x] Keep internal draft/candidate ids out of the normal success message. Expose them only in
      diagnostics/Run Monitor links.
- [x] Never route normal successful creation to `/vault/wiki-drafts/*` or
      `/vault/wiki-candidates/*`.

### Post-creation correction

- [x] Preserve confirmed full-wiki deletion and inbound link cleanup.
- [x] Define/retain a confirmed demote/unpublish action that removes a page from canonical promoted
      knowledge while retaining its internal audit/source lineage. Demotion is a correction after
      creation, never a required step before or after generation.
- [x] Preserve confirmed section deletion with the invariant that a wiki retains at least one
      sourced section.
- [x] Preserve section regeneration where the new proposal-scoped internal draft retains enough
      source lineage. Regeneration remains one post-creation action and auto-promotes the validated
      replacement section.
- [x] If a legacy or migrated page lacks sufficient lineage for regeneration, disable the action
      with a precise explanation instead of introducing a draft/promotion workflow.
- [x] Ensure delete/demote/regenerate update only directly affected wiki, graph, and query families.

**Exit criteria**

- [x] Wiki creation has one user-visible action from transcript/canonical ideas to promoted pages.
- [x] No proposal, draft, review, or promotion action appears in the normal creation path.
- [x] Delete, demote/unpublish, section delete, and supported section regeneration remain explicit
      post-creation corrections.

---

## Phase 7 — Migration, Validation, and Documentation

**Outcome:** The refined one-step pipeline replaces the simplified path without corrupting existing
vault or knowledge artifacts.

### Compatibility and migration

- [x] Read old `wiki-candidate` nodes with compatibility defaults for evidence roles; avoid
      rewriting historical vault files merely to adopt the new schema.
- [x] Preserve existing wiki draft and promoted wiki frontmatter through optional fields/defaults.
- [x] Derive new evidence metrics for old wikis where possible; mark unavailable author/channel or
      independence metadata as unknown rather than guessing.
- [x] Keep existing promoted ids, revisions, manual edits, source refs, delete behavior, and graph
      links unchanged.
- [x] Preserve accepted internal draft lineage used by section regeneration even though drafts are
      no longer a user workflow stage.
- [x] Remove the greedy grouping path only after the new orchestration has focused route tests.
- [x] Remove automatic ambiguous-topic suffixing and add a regression test proving it cannot return.
- [x] Retire or clearly mark user-facing candidate/draft creation pages as diagnostic/internal so
      they do not imply a second supported creation workflow.

### Focused verification matrix

- [x] Add schema tests for proposal roles, batch coverage, source metrics, and verification states.
- [x] Add clustering tests for input-order stability, fine-tag weighting, broad-domain rejection,
      cross-domain coherence, split/merge bounds, and existing-wiki resolution.
- [x] Add discovery tests for zero/one/many internal proposals, invented ids, duplicate topics,
      omissions, retry, and persisted parent-run metadata.
- [x] Add compiler tests for targeted evidence, evidence roles, source-independent titles,
      synthesized sections, over-collapse, over-fragmentation, and normalization blockers.
- [x] Add orchestration/promotion tests for create/update/no-op, ambiguity, contested evidence,
      stale updates, partial success, idempotent retries, and the single unified response.
- [x] Add link tests for simultaneous pages, existing targets, rejected domain-only links, failed
      sibling topics, reverse derivation, and graph rebuild.
- [x] Add client tests proving one action starts the complete workflow, multiple results are shown,
      internal artifacts are not user steps, durable progress recovers, and post-creation controls
      work.
- [x] Use temporary `LLAAB_VAULT` and `LLAAB_KNOWLEDGE` roots for all write/integration tests and
      assert live parent/nested-repo Git state is unchanged.

### Manual acceptance journey

Behavioral contracts below are covered by focused fixtures (Phases 0–6 + Phase 7 path/compat/
composer tests). Live LLM smoke remains in [`ROADMAP.md#next`](./ROADMAP.md#next).

- [x] Consolidate the broad regression transcript and click `Create Wiki(s)` once.
- [x] Confirm the system automatically discovers several coherent topics, compiles them separately,
      resolves links, and auto-promotes valid pages without another user action.
- [x] Confirm each compiler input contains only its topic's relevant evidence.
- [x] Confirm an injected ambiguous/invalid topic creates no suffixed wiki and does not block valid
      siblings from completing.
- [x] Confirm generated pages have topic-oriented titles/sections and justified typed links.
- [x] Confirm 12 timestamps from one transcript display as 12 evidence refs, one independent source,
      and `source-backed` verification.
- [x] Add a second independent supporting source and confirm only genuinely shared claims become
      `corroborated`.
- [x] Add contradictory evidence and confirm affected claims/pages become `contested` with both
      evidence groups visible and are not auto-promoted when policy blocks them.
- [x] Re-run unchanged generation and confirm stable topic resolution, no duplicate pages, and safe
      no-op/update behavior.
- [x] Verify delete, demote/unpublish, section delete, and supported section regeneration after
      one-step creation.

### Documentation and operational validation

- [x] Update [Wiki Workflow](/docs/process/WIKI_WORKFLOW.md) after behavior lands, documenting one
      visible creation action and the internal discover/compile/link/promote stages.
- [x] Update [.agents/handoff.md](/.agents/handoff.md) only after the refined path is implemented and
      verified.
- [x] Move this initiative into the appropriate Roadmap tier when implementation begins; move it to
      Done and rename this file only when every tracked checkbox is complete.
- [x] Run focused tests and affected package typechecks after each phase; run Markdown format/lint
      for changed docs.
- [x] After changes under `apps/server/**`, server-consumed packages, or startup-read environment
      values, run the required `scripts/macos/dev-refresh.sh` path before browser verification.

**Exit criteria**

- [x] The simplified grouping path is no longer reachable from transcript generation.
- [x] Existing wiki/vault artifacts remain readable and no migration mutates live knowledge without
      the original user-triggered creation or an explicit post-creation correction.
- [x] Focused tests, affected typechecks/lint, Markdown lint, and the manual acceptance journey pass.

---

## Completion Criteria

All criteria met (this file graduated 2026-07-19):

- [x] One `Create Wiki(s)` action takes transcript canonical ideas to one or more auto-promoted wiki
      pages.
- [x] Discovery, proposals, drafts, linking, validation, and promotion remain internal stages.
- [x] No user proposal review, draft review, or promotion is required.
- [x] Primary/supporting evidence roles are persisted and validated internally.
- [x] Every topic compiles independently from a bounded evidence packet.
- [x] Ambiguous, contested, stale, invalid, or low-quality branches cannot mutate knowledge or
      force a second user step.
- [x] Quality reports separate batch coverage, page coherence, citations, and source diversity.
- [x] Evidence metrics distinguish references, transcripts, channels/authors, and independent
      sources.
- [x] Single-source output is `source-backed`; only actual disagreement is `contested`.
- [x] Typed links resolve after topic identities are known and every promoted target exists.
- [x] The broad regression transcript creates several reusable topic pages rather than one source
      digest.
- [x] Delete, demote/unpublish, section delete, and supported section regeneration remain available
      after creation.
- [x] Existing promoted Markdown, manual edits, revisions, and derived graph rebuilds remain intact.
