# DONE — Canonical Ideas Consolidation

> **Completed:** 2026-06-14 — canonical ideas can be generated from multiple extraction runs,
> stored as first-class vault nodes, and rendered on transcript detail pages.

## Goal

Add a consolidation workflow that combines multiple extraction runs for the same transcript into a single canonical idea set.

The objective is NOT to replace extraction runs.

The objective IS to create a higher-quality, non-duplicative set of canonical ideas derived from all available runs.

---

## Terminology

### Extraction Run

A single ingestion/extraction attempt.

Examples:

- Gemma4:E4B run #1
- Gemma4:E4B run #2
- Gemma4:26B run #1

Runs are immutable.

---

### Candidate Idea

An idea produced by a specific extraction run.

Candidate ideas remain attached to their source run.

Candidate ideas are immutable.

---

### Canonical Idea

A consolidated idea derived from one or more candidate ideas.

Canonical ideas are the primary idea set shown for a transcript.

Canonical ideas may be edited by the user after creation.

---

## User Workflow

### Transcript Page

Existing:

- Summary
- Extraction Runs
- Candidate Ideas

Add:

- Canonical Ideas section
- Consolidate Runs button

---

### Consolidation Flow

User clicks:

```text
Consolidate Runs
```

System:

1. Loads all candidate ideas for the transcript
2. Sends them to consolidation model
3. Receives consolidated canonical ideas
4. Stores canonical ideas
5. Displays canonical ideas in dedicated section

No extraction runs are modified.

---

## Initial UX

Do NOT implement:

- run selection
- checkboxes
- weighting
- advanced options

Use all available runs automatically.

Keep UX to a single button.

---

## LLAAB Implementation Plan

### Current App Context

- Client is Vite + React Router.
- Transcript detail UI lives in `apps/client/src/components/TranscriptsSplitView/components/TranscriptDetail.tsx`.
- Transcript detail data is assembled in `apps/client/src/routes/transcript-detail.tsx`.
- Vault API routes live in `apps/server/src/routes/vault/`.
- Extraction currently stores candidate ideas as normal `idea` nodes under `vault/nodes/ideas/`.
- Extraction runs are represented by `run` nodes whose `produced_node_ids` point at transcript and idea nodes.
- The LLM route key for this work is `consolidate`.

### Phase 1 — UI Entry Point

- Add a disabled transcript-detail action button beside the `Extraction runs` heading.
- Label: `Consolidate Canonical Ideas`.
- Icon: `Sparkles`.
- Color: purple/pink consolidation token.
- Enable the button only after the backend action exists.

### Phase 2 — Storage Shape

Status: implemented in current working tree.

Prefer a dedicated canonical idea node shape over mutating existing extracted idea nodes.

Recommended path:

- Add `CanonicalIdeaNodeSchema` in `packages/schemas`.
- Add `canonical-idea` to the vault node type union.
- Store files under `vault/nodes/canonical-ideas/`.
- Extend node file path utilities in `packages/core`.

Required fields:

- `type: "canonical-idea"`
- `transcript_id`
- `source_candidate_idea_ids`
- `confidence`
- `title`
- `body`
- `tags`
- `created_at`
- `updated_at`

Candidate ideas remain immutable and keep their current `idea` node type.

### Phase 3 — Server Action

Status: implemented in current working tree; needs verification against a real transcript.

Add:

```text
POST /api/vault/transcripts/:id/consolidate
```

Server flow:

1. Load the transcript node.
2. Find all run nodes that produced the transcript id.
3. Collect all produced `idea` nodes from those runs.
4. Build candidate payloads with candidate id, run id, title, body, domain tags, and topic tags.
5. Call `routeLlm("consolidate", prompt, { bypassCache: true })`.
6. Parse and validate the JSON response with Zod.
7. Write `canonical-idea` nodes.
8. Return canonical idea ids plus LLM trace metadata.

Do not include full transcript text in the prompt.

### Phase 4 — Client Data Flow

Status: implemented in current working tree.

Add query/mutation helpers under `apps/client/src/queries/transcripts/`:

- `useTranscriptCanonicalIdeas(transcriptId)`
- `useConsolidateCanonicalIdeas(transcriptId)`

On success:

- invalidate transcript canonical ideas query
- invalidate vault node queries if needed
- optionally select/display canonical ideas immediately

### Phase 5 — Transcript Detail Display

Status: implemented in current working tree; needs browser verification.

Add a `Canonical ideas` section above `Extracted ideas`.

Display:

- title
- body, if present
- domain tags
- topic tags
- confidence
- source candidate count

Keep `Extracted ideas` visible as candidate/run output.

### Phase 6 — Later Editing

Defer these until canonical idea generation exists:

- edit canonical idea
- delete canonical idea
- view source candidates dialog
- rerun consolidation with overwrite/replace choices

### Final Verification

- schema build
- core build
- core typecheck
- server typecheck
- client typecheck
- markdown lint
- first real run wrote canonical idea files

Notes:

- First browser test produced canonical idea files after ~105s of local LLM time, but Vite returned a
  502 before the client received the JSON response.
- Client Vite proxy timeout was extended and canonical idea queries now refresh even if the mutation
  settles with an error.
- Follow-up work for run-file compaction and coverage/quality controls moved to
  [`TODO_CANONICAL_IDEA_QUALITY.md`](./TODO_CANONICAL_IDEA_QUALITY.md).

---

## Data Model

### Candidate Idea

```ts
type CandidateIdea = {
  id: string;
  transcriptId: string;
  runId: string;

  title: string;
  body?: string;

  domains: string[];
  tags: string[];
};
```

### Canonical Idea

```ts
type CanonicalIdea = {
  id: string;
  transcriptId: string;

  title: string;
  body?: string;

  domains: string[];
  tags: string[];

  sourceCandidateIdeaIds: string[];

  confidence?: number;
  createdAt: string;
};
```

---

## Consolidation Prompt

Input:

- transcript title
- transcript summary
- all candidate ideas
- tags
- domains

Do NOT include transcript text.

Goal:

- merge duplicate ideas
- preserve unique ideas
- improve wording
- produce best possible final idea set

Avoid:

- creating ideas unsupported by candidates
- excessive abstraction
- collapsing distinct ideas

---

## Consolidation Output

Return:

```ts
type ConsolidatedIdeaDraft = {
  title: string;
  body?: string;

  tags: string[];
  domains: string[];

  sourceCandidateIdeaIds: string[];

  confidence: "low" | "medium" | "high";
};
```

---

## Consolidation Rules

### Merge

These should merge:

```text
Context window limits hurt performance

LLM performance degrades with excessive context tokens

Dumping entire codebases into context windows causes inefficiency
```

---

### Do Not Merge

These should remain separate:

```text
Bash became the first execution layer for agents
```

and

```text
Bash is insufficient for complex agent workflows
```

Related does not mean duplicate.

---

## Provenance

Every canonical idea must reference the candidate ideas that produced it.

Example:

```ts
{
  title: "Targeted retrieval is superior to context stuffing",

  sourceCandidateIdeaIds: [
    "idea_12",
    "idea_47",
    "idea_81"
  ]
}
```

---

## UI

Display:

```text
Canonical Ideas
```

above or alongside extraction runs.

Each canonical idea should support:

- Edit
- Delete
- View Sources

---

## Model Strategy

V1:

- Use local Gemma4:26B for consolidation

Future:

- Optional remote consolidation
  - GPT-5.5
  - Claude Sonnet

The consolidation layer should be model-agnostic.

---

## Success Criteria

Given 3-5 extraction runs for the same transcript:

- duplicate ideas are merged
- unique ideas are preserved
- canonical idea count is smaller than total candidate idea count
- provenance is retained
- extraction runs remain untouched
