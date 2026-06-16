# DONE — Canonical Idea Quality And Run Compaction

> **Status:** Complete (graduated 2026-06-16). Quality score and single-pass consolidation shipped;
> run compaction items below remain reference for future work.

---

## Why

The first real canonical ideas run was successful: it generated a coherent smaller set from multiple
candidate extraction runs.

Two follow-up issues emerged:

- Consolidation missed or underrepresented one strong infrastructure idea:
  lightweight virtualized / multi-tenant agent runtimes.
- Extraction run files duplicate the full transcript body inside run metadata, making each run much
  larger than it needs to be.

The fix is not to delete older candidate ideas or extraction runs. Candidate ideas remain the
evidence layer, and runs remain the reproducibility/provenance layer. The fix is to compact run
artifacts and add quality controls around consolidation coverage.

---

## Progress

- [x] Phase 1 — compact all future run output.
- [x] Phase 2 — migrate existing run files to compact output.
- [x] Phase 3 — add consolidation coverage audit.
- [x] Phase 4 — add schema support for key claims and coverage notes.
- [x] Phase 5 — surface durable coverage/missed-idea review in the transcript UI.
- [x] Phase 6 — add manual promote controls for missed candidate ideas.
- [x] Phase 7 — preserve run delete semantics after compaction.

---

## Phase 1 — Compact All Future Run Output

Status: complete.

Current issue:

- `RunNode.output_summary` stores the full ingest result JSON.
- Ingest result JSON includes `plainText`.
- The final `execute` stage output also includes `plainText`.
- The transcript file already stores that text, so every extraction run repeats the largest payload.

Plan:

- Add a run-output sanitizer in `packages/skills/src/runner.ts`.
- Apply it at the generic run persistence boundary, not only for consolidation.
- Every future `RunNode` should get compact summaries by default, including:
  - original `ingest-youtube` runs
  - extraction follow-on updates
  - consolidation runs
  - future durable processors and control runs
- Before persisting `output_summary`, remove or replace large duplicated fields:
  - `plainText`
  - `transcript`
  - `body`
  - any future full-text transcript aliases
- Preserve compact references:
  - `transcript_id`
  - `transcript_path`
  - `source_id`
  - `source_url`
  - `source_item_id`
  - `produced_node_ids`
  - `title`
  - `author`
- Apply the same sanitizer to persisted `stages[].output` where stage output includes the full text.

Implemented:

- `packages/skills/src/runner.ts` now sanitizes persisted run summaries at the generic runner
  boundary.
- Large `body`, `plainText`, `text`, and `transcript` fields are replaced with compact metadata:
  omitted flag, reason, char count, and preview.
- The same sanitizer applies to initial stage input, final `execute` stage output, and nested
  `runTrace.stages[]` input/output.
- `produced_node_ids` continues to be collected from compact output so delete semantics keep their
  stable source of truth.
- `packages/skills/src/runner.test.ts` covers final output compaction and nested trace stage
  compaction.

Recommended compact `output_summary` shape:

```json
{
  "id": "the-language-holding-our-agents-back",
  "type": "transcript",
  "title": "The language holding our agents back.",
  "transcript_id": "the-language-holding-our-agents-back",
  "transcript_path": "/Users/justin/LLAAB/vault/transcripts/transcript.the-language-holding-our-agents-back.md",
  "source_id": "theo-t3-gg",
  "source_item_id": "TilDSWeiAlw",
  "source_url": "https://www.youtube.com/watch?v=TilDSWeiAlw",
  "produced_node_ids": ["the-language-holding-our-agents-back", "theo-t3-gg"]
}
```

Do not consolidate many extraction run files into one. Each original run should remain its own
immutable record, but every run record should reference transcript/candidate/canonical nodes rather
than embedding full transcript text.

---

## Phase 2 — Migrate Existing Run Files

Status: complete.

Add a one-shot script:

```text
scripts/compact-run-output-summaries.ts
```

Behavior:

- Scan `vault/runs/*.md`.
- Compact all existing run node files, including the original ingestion/extraction runs.
- Parse run frontmatter.
- Decode repeatedly escaped JSON in `input_summary`, `output_summary`, and `stages`.
- Remove duplicated full transcript fields from output summary and stage outputs.
- Keep node ids, paths, URLs, model metadata, durations, run status, and events.
- Rewrite only changed run files.
- Print before/after byte savings.

Implemented:

- Added `scripts/compact-run-output-summaries.ts`.
- Script defaults to dry-run and requires `--write` for vault mutation.
- Existing June 13 ingest run files were compacted from roughly 42 KB each to roughly 5 KB each.
- A follow-up dry-run reported `0` remaining files to compact.

Verification:

- Run detail pages still render.
- Runs table still groups by source URL.
- Delete run logic still finds produced node ids.
- Individual run delete still deletes only the selected run.
- `Run and nodes` delete still preserves shared transcript/source nodes when other runs reference
  them.
- Batch/group delete from `/ingest` still removes every selected original run node and only removes
  produced nodes that are no longer referenced by remaining runs.
- Run Monitor still displays summary and node links.

---

## Phase 3 — Consolidation Coverage Audit

> **Superseded (2026-06):** The second LLM audit pass and `consolidate-audit` task route were
> removed. Consolidation is now single-pass on `consolidate` with deterministic quality validation
> and scoring (`packages/schemas/src/consolidation-quality.ts`). The notes below describe the
> original two-pass design for historical context.

Status: complete.

Problem:

The first canonical output was good, but it underrepresented this distinct idea:

```text
Lightweight virtualized runtimes may replace full machines for agent execution.
```

The model covered typed/sandboxed environments, but not the stronger infrastructure claim around
V8 isolates, virtual file systems, fake Bash layers, lightweight multi-tenant runtimes, and
alternatives to full VMs/Docker containers.

Add a second pass after canonical draft generation:

1. Generate canonical ideas from candidates.
2. Build a coverage map:
   - each candidate idea id must be either covered by at least one canonical idea or explicitly
     omitted with a reason.
3. Ask the consolidation model to audit the map:
   - identify strong candidates that are uncovered or underrepresented
   - suggest additional canonical ideas only when the missed idea is distinct and important
4. Merge approved audit additions into the final canonical set.

Keep the audit model-agnostic and route it through `routeLlm("consolidate", ...)`.

Implemented:

- Consolidation now runs a second audit pass after initial canonical drafts.
- The audit returns a candidate coverage map plus optional distinct missed-idea additions.
- Valid additions are merged into the canonical draft list before node creation.
- Candidate ids marked covered by the audit are merged into the persisted canonical node
  `source_candidate_idea_ids` so saved-file coverage is less noisy.
- If the audit pass fails or returns invalid JSON, consolidation continues with the initial drafts and
  reports the audit warning in the API response.
- Canonical idea nodes can now store `key_claims` and `coverage_notes`.
- The server treats consolidation as a long-running request so Bun does not close the route early.

Still needed:

- Move consolidation to a durable run-monitor task. The current two-pass local model call can take
  many minutes and should not depend on a single browser HTTP request.

---

## Phase 4 — Schema Improvements

Status: partial.

Extend canonical idea output from:

```ts
{
  title;
  body;
  tags;
  domains;
  sourceCandidateIdeaIds;
  confidence;
}
```

to:

```ts
{
  title;
  body;
  tags;
  domains;
  sourceCandidateIdeaIds;
  confidence;
  keyClaims: string[];
  coverageNotes?: string;
}
```

Also store run-level consolidation metadata:

```ts
{
  input_run_ids: string[];
  input_candidate_idea_ids: string[];
  produced_canonical_idea_ids: string[];
  omitted_candidate_idea_ids: Array<{
    id: string;
    reason: string;
  }>;
  coverage_score?: number;
}
```

This metadata can live either on a future consolidation `RunNode` or as a compact sidecar field on
the canonical idea generation response. Prefer a `RunNode` once consolidation runs are durable.

Implemented:

- Canonical idea output now accepts `keyClaims` / `key_claims`.
- Canonical idea output now accepts `coverageNotes` / `coverage_notes`.
- `CanonicalIdeaNode` now stores `key_claims` and `coverage_notes`.

Still needed:

- Durable run-level consolidation metadata for input runs, input candidates, produced canonical
  ideas, omitted candidates, and coverage score.

---

## Phase 5 — UI Controls

Status: complete.

Add lightweight quality controls before edit/delete polish:

- Show a coverage summary near `Canonical ideas`:
  - `4 canonical ideas`
  - `27 / 29 candidate ideas covered`
  - `2 omitted`
- Add a collapsible `Possible missed ideas` panel when the audit finds uncovered strong candidates.
- Each missed idea row should show:
  - candidate title
  - source run/model
  - audit reason
  - optional `Promote to canonical` action later

Do not block normal consolidation on perfect coverage. The first goal is visibility, not making the
workflow heavyweight.

Implemented:

- Transcript detail shows the latest mutation coverage summary after consolidation completes.
- Transcript detail derives a saved-file coverage summary from `source_candidate_idea_ids` after
  reload.
- Transcript detail prefers persisted transcript `canonical_coverage` metadata after reload.
- Transcript detail shows a collapsible `Possible missed ideas` panel when the audit returns missed
  candidate ideas.
- Transcript detail shows persisted missed candidate ideas after reload.
- Transcript detail shows uncovered candidate ideas after reload when saved canonical nodes do not
  reference every candidate.
- Canonical idea cards show persisted key claims and coverage notes.
- Consolidation mutation schedules delayed query invalidations after errors so late-written
  canonical files can appear without manual refresh.
- Consolidation persists compact coverage metadata on the transcript node.
- Missed/uncovered idea rows show source run model and provider metadata (and run timestamp) when
  the candidate's extraction run is known.

Still needed:

- Persist consolidation as a dedicated run node when consolidation moves to background execution.

---

## Phase 6 — Manual Promote Controls

Status: complete.

Add a `Promote to canonical` action to missed/uncovered candidate idea rows so a strong candidate
that the audit flagged (or that simply isn't referenced by any canonical idea yet) can become its
own canonical idea without rerunning consolidation.

Implemented:

- New endpoint `POST /api/vault/transcripts/:id/canonical-ideas/promote` with body
  `{ candidateId: string }`.
- The endpoint creates a `canonical-idea` node from the candidate idea (title, body, tags, domains),
  marks it `confidence: "medium"` with a `coverage_notes` note that it was promoted manually, and
  updates the transcript's `canonical_coverage` to mark the candidate covered and drop it from
  `missed_candidate_idea_ids`.
- Returns `404` if the transcript or candidate idea is not found, and `400` if the candidate is
  already covered by a canonical idea.
- Transcript detail UI shows a `Promote to canonical` button on every row in the
  `Possible missed ideas` and `Uncovered candidate ideas` panels (audit results, persisted missed
  ideas, and persisted-uncovered fallback), with per-row pending state and success/error toasts.
- Promotion invalidates canonical idea and transcript queries so the new canonical idea and updated
  coverage appear without a full reload.

---

## Phase 7 — Run Deletion Semantics

Status: complete.

The `/ingest` runs table supports deleting:

- one child/original run row
- a grouped batch of runs for the same source URL
- the run only
- the run plus produced nodes

Run compaction must not break any of those paths.

### Required invariants

- `RunNode.produced_node_ids` remains the source of truth for delete behavior.
- Compacting `output_summary` or `stages[].output` must never remove `produced_node_ids`.
- Deleting one original extraction run must not delete shared transcript/source nodes when other
  runs still reference them.
- Batch delete may delete every selected original run node, but must still check node references
  across all remaining runs before deleting produced nodes.
- Candidate idea nodes may be deleted only when no remaining run references them and no canonical
  idea uses them as a source.
- Canonical idea nodes should not be silently deleted when deleting one candidate extraction run,
  unless all of their `source_candidate_idea_ids` are removed or the user explicitly chooses to
  delete canonical outputs too.

### Implementation notes

- Keep delete logic based on graph references, not run-file size or output summary shape.
- Add a helper such as `getNodeReferenceCounts(allRuns)` so both individual and batch delete share
  the same reference-count behavior.
- Extend delete checks to include canonical idea provenance:
  - `canonicalIdea.source_candidate_idea_ids`
  - `canonicalIdea.transcript_id`
- Consider returning a delete preview before destructive group delete:
  - runs to delete
  - produced nodes to delete
  - produced nodes preserved because they are shared
  - canonical ideas affected or preserved

Implemented:

- Individual run delete still uses `produced_node_ids` as its delete source.
- Individual `Run and nodes` delete now preserves candidate ideas referenced by canonical ideas.
- Individual `Run and nodes` delete now preserves transcripts referenced by canonical ideas.
- Individual `Run and nodes` delete now preserves sources referenced by remaining transcripts.
- Shared produced-node reference helpers now centralize the checks for remaining runs, canonical
  ideas, and transcripts.
- New endpoint `POST /api/vault/runs/delete-preview` accepts a batch of run ids and returns the
  nodes that would be deleted, nodes that would be preserved (with reasons), and any canonical
  ideas affected by the delete.
- Both `DeleteRunAction` (single run, "Run and nodes" step) and `DeleteRunGroupAction` (batch
  delete) fetch and render this preview before the user confirms a destructive delete.

Still needed:

- Canonical idea handling for future consolidation run deletes (no consolidation `RunNode` exists
  yet — see Phase 3 "Still needed").

### Deletion test matrix

- Delete one run from a group of seven runs:
  - selected run file is removed
  - shared transcript remains
  - source remains
  - candidate ideas from that run are removed only if unreferenced and not used by canonical ideas
  - canonical ideas remain
- Delete all runs in a source group with `Run and nodes`:
  - all selected run files are removed
  - transcript/source are removed only if no other remaining run references them
  - canonical ideas for that transcript are either deleted explicitly or reported in the preview
- Delete run only:
  - no produced nodes are removed
  - canonical ideas remain
- Delete a consolidation run in the future:
  - canonical ideas are removed only with explicit `Run and nodes`
  - candidate extraction runs remain untouched

---

## Quality Guardrails

Use these controls to reduce missed strong ideas:

- Require explicit coverage or omission for every candidate idea.
- Let the model create more than four canonical ideas when an uncovered idea is distinct.
- Add prompt language for infrastructure primitives:
  - runtime substrate
  - virtualization
  - isolation
  - multi-tenancy
  - agent execution environments
- Preserve high-signal minority ideas even if they appear in only one extraction run.
- Treat high source count as evidence, not as the only promotion criterion.
- Prefer a second audit pass over making the initial prompt too complex.

---

## Done Means

- New runs no longer embed full transcript text in run summaries or execute-stage outputs.
- Existing run files can be compacted with an idempotent one-shot script.
- Individual and batch run deletion behave the same before and after compaction.
- Consolidation produces coverage metadata.
- The missed virtualized-runtime idea class would be flagged or promoted.
- Transcript detail UI shows canonical ideas plus coverage status.

---

## Summary — Phases 1-7 Complete (2026-06-14)

All seven phases are implemented and typechecked.

- **Run compaction (Phases 1-2):** the generic skill runner sanitizes `output_summary` and
  `stages[].output` before persisting run nodes, stripping duplicated transcript text while
  keeping references (`transcript_id`, `transcript_path`, `source_id`, `produced_node_ids`, etc.).
  A one-shot `scripts/compact-run-output-summaries.ts` migrated existing run files (roughly 42 KB
  to roughly 5 KB each) with no change to delete behavior.
- **Coverage audit (Phase 3):** consolidation runs a second audit pass that maps every candidate
  idea to `covered` / `omitted` / `missed`, optionally adds distinct missed ideas to the canonical
  draft set, and merges covered candidate ids back into `source_candidate_idea_ids`. Audit failures
  degrade gracefully with a warning instead of failing the run.
- **Schema (Phase 4):** `CanonicalIdeaNode` stores `key_claims` and `coverage_notes`. Durable
  run-level consolidation metadata (input runs, omitted candidates, coverage score) remains future
  work pending a dedicated consolidation `RunNode`.
- **Transcript UI coverage (Phase 5):** transcript detail shows a coverage summary
  (covered/omitted/missed/total), a collapsible "Possible missed ideas" / "Uncovered candidate
  ideas" panel sourced from the live audit or persisted `canonical_coverage`, and each missed/
  uncovered row now shows the source extraction run's model, provider, and timestamp when known.
- **Manual promote (Phase 6):** added `POST /api/vault/transcripts/:id/canonical-ideas/promote`
  (`{ candidateId }`) which turns a missed/uncovered candidate idea into its own
  `confidence: "medium"` canonical idea and updates the transcript's coverage record. Every missed/
  uncovered row in the transcript UI has a "Promote to canonical" button with per-row pending state
  and toast feedback.
- **Delete preview (Phase 7):** added `POST /api/vault/runs/delete-preview` (`{ ids }`), returning
  nodes to delete, nodes preserved with reasons, and any affected canonical ideas. Both the single
  run "Run and nodes" dialog and the batch group-delete dialog render this preview before the user
  confirms a destructive delete.

Remaining future work (not blocking): move consolidation to a durable run-monitor task with its own
`RunNode`, and once that exists, extend delete-preview/produced-node handling to cover consolidation
run deletes.
