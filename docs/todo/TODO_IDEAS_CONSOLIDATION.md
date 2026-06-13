# Canonical Ideas Consolidation

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
