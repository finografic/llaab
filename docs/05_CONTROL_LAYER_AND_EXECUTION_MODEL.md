# 🧠 LLAAB — Control Layer & Execution Model

## Purpose

This document consolidates recent architectural improvements and clarifies how LLAAB should evolve from:

```txt
structure-first → execution-capable system
```

It focuses on:

- making the **control layer explicit**
- defining **execution boundaries**
- strengthening **validation and observability**
- establishing a **clear Phase 2 starting point**

---

## 1. Core Architectural Shift

## From

```txt
input → context → LLM → output
```

## To

```txt
input
→ control
    → retrieval / context assembly
    → LLM (optional)
    → validation
    → decision (accept / retry / reject / downgrade)
→ storage (nodes)
→ run logging
```

---

## Key Principle

> The LLM is not the system.
> The control layer is the system.

---

## 2. The Control Layer

## Run Definition

Control = the system layer that governs execution

It is responsible for:

- deciding **if** the LLM should be called
- shaping **what context** it receives
- validating outputs against **schemas**
- handling **failures and retries**
- determining **what becomes system state**

---

## Hard Rule

> **No LLM call is allowed outside the control layer**

---

## Minimal Interface

```ts
interface ControlExecuteInput<T> {
  task: string;
  input: unknown;
  schema: ZodSchema<T>;
  context?: Context;
  policy?: ControlPolicy;
}

async function execute<T>(input: ControlExecuteInput<T>): Promise<T>;
```

---

## Internal Flow

```txt
prepare context
→ call LLM
→ parse output
→ validate (schema)
→ apply policy
    → accept
    → retry
    → downgrade
    → reject
→ return structured result
```

---

## Policy (minimal starting point)

```ts
interface ControlPolicy {
  maxRetries: number;
  onInvalid: 'retry' | 'reject';
  onFailure: 'retry' | 'reject';
}
```

---

## Decision Model

```txt
valid → accept
invalid → retry (≤ N) → reject
low-confidence → downgrade
error → retry or reject
```

---

## 3. Execution Model

## System Flow

```txt
skill (definition)
→ runner (execution steps)
→ control (LLM + decisions)
→ node creation / update
→ run logging
```

---

## Critical Separation

| Layer   | Responsibility    |
| ------- | ----------------- |
| skill   | what to do        |
| runner  | executes steps    |
| control | governs decisions |
| schema  | validates truth   |
| vault   | stores truth      |

---

## Rule

> Skills do not decide validity.
> Control does.

---

## 4. Run Logging (Observability Layer)

## Definition

A `run` is the **execution trace of the system**

Not optional. Not debugging. Core architecture.

---

## Required Shape (example)

```ts
interface RunNode {
  id: string;
  skill_id: string;
  status: 'success' | 'failed' | 'rejected';

  stages: Array<{
    name: string;
    status: 'success' | 'failed';
    input: unknown;
    output: unknown;
    error?: string;
  }>;

  decisions: Array<{
    type: 'accept' | 'retry' | 'reject' | 'downgrade';
    reason: string;
  }>;

  llm?: {
    model: string;
    raw_output: string;
    parsed: boolean;
  };

  createdNodes?: string[];
}
```

---

## Run Logging Purpose

- makes execution **inspectable**
- exposes **failure boundaries**
- enables **system refinement**
- converts execution → knowledge

---

## Run Logging Rule

> If it is not logged as a run, it did not happen.

---

## 5. Schema Role (Strengthened)

## Shift

From:

> validation layer

To:

> **system contract layer**

---

## Context Principle

```txt
LLM output = proposal
Schema-valid output = admissible state
```

---

## Enforcement

- all LLM outputs must pass schema validation
- invalid output must **never enter the vault**

---

## 6. Context & Retrieval (Refined)

## Current Risk

- implicit context assembly
- prompt drift
- noisy retrieval

---

## Target Model

```txt
query
→ node selection
→ relationship expansion
→ context shaping
→ LLM
```

---

## Context Shape (recommended)

```ts
interface Context {
  instructions: string;
  data: unknown;
  constraints?: string[];
  examples?: unknown[];
}
```

---

## Principle

> Context is not “more data”
> It is **selected, structured input**

---

## 7. Known Risks (If Not Addressed)

### 1. Control drift

- LLM calls spread across codebase

### 2. Silent failures

- invalid outputs accepted

### 3. Schema bypass

- “just text” leaks into system

### 4. Context degradation

- prompt stuffing replaces structure

---

## 8. What NOT to Do Yet

- no vector DB expansion
- no graph visualization layer
- no complex agent abstraction
- no multi-agent systems
- no heavy UI work

---

## Reason

> Execution correctness > system surface area

---

## 9. Phase 2 — Concrete Next Steps

Current status:

- `Step 1` — done
- `Step 2` — done
- `Step 3` — done
- `Step 4` — mostly done in behavior; repo-wide enforcement is still a follow-up
- `Step 5` — not implemented yet
- `Step 6` — done
- `Step 7` — done for YouTube transcript deduplication

## Step 1 — Node Mutation Layer

Implemented:

- `writeNode(node)`
- `updateNode(filePath, updater)`

Requirements:

- schema validation before write
- preserve `id`, `type`
- update `updated_at`
- deterministic file output

---

## Step 2 — Persist Run Nodes

Implemented:

- write run records to `vault/runs`
- include:
  - stages
  - decisions
  - optional llm trace support in the schema
- integrate into `runner.ts`

---

## Step 3 — Introduce Control Layer

Implemented:

```txt
packages/control/
  orchestrator.ts
```

Surface:

```ts
control.execute();
```

Current enforcement:

- LLM-backed extraction now goes through this
- schema validation required
- retry + decision logic included

## 5.1 — Source Modeling

## Recommended Placement

Add this **directly after Section 5 (Schema Role)** in the doc:

```txt
### 5.1 Source & Provenance Modeling
```

---

## Source & Provenance Modeling

## Problem

Current node model includes:

```txt
id, type, title, tags, related, ...
```

The current repo now has a lightweight provenance bridge via `source_id` on relevant externally-derived node types.

Without structural provenance, this creates risk:

- loss of origin traceability
- weaker retrieval filtering
- harder deduplication
- reduced trust in knowledge

---

## Provenance Principle

> Provenance is not metadata.
> It is **part of the system’s truth model**.

---

## Important Distinction

From your glossary (correctly defined):

```txt
source   = origin (person, channel, repo, publication)
resource = external artifact (article, repo, tool)
```

---

## Correct Design (Do NOT just add `source: string`)

Instead of:

```txt
source: string // ❌ too weak
```

Use:

### Option A (Recommended — Graph-first)

```txt
related: NodeId[] // existing
relationships:
  - type: "derived_from"
    target: source-node-id
```

Meaning:

```txt
idea → derived_from → source
transcript → derived_from → source
skill → derived_from → source
```

---

### Option B (Short-term Hybrid)

If you want a lightweight step:

```txt
source_id?: NodeId
```

BUT:

- must reference a `source` node
- must NOT be free text
- should eventually migrate to relationships

---

## Why This Matters

### 1. Retrieval

```txt
find ideas derived from X
find all nodes from source Y
```

---

### 2. Deduplication

```txt
same source + same content → likely duplicate
```

---

### 3. Trust / Weighting

Future:

```txt
prefer ideas from high-trust sources
```

---

### 4. Lineage

```txt
transcript → idea → skill → run
         ↑ all traceable to source
```

---

## Minimal Rule (Adopt Now)

> Every node that originates from external input
> **must be linked to a `source` node**

Applies to:

- transcript ✅
- resource ✅
- extracted idea ✅
- extracted skill ✅

---

## Example

```txt
source.youtube-channel-xyz
    ↓
transcript.video-abc
    ↓
idea.context-windowing
    ↓
skill.extract-context
```

---

## Future (Do NOT build yet)

- weighted sources
- trust scores
- source clustering
- authority ranking

---

## Summary

- Do NOT add `source: string`
- DO link nodes → `source` nodes
- provenance should be **queryable and structural**
- this becomes critical for retrieval + trust later

---

## Quick Guidance

If you want the **cleanest immediate move**:

- add `source_id?: NodeId` to relevant schemas
- ensure ingestion always sets it
- plan migration → relationship edges later

---

## One-line takeaway

> Nodes don’t “have a source” —
> they are **connected to sources in the graph**

---

## Step 4 — Ban Direct LLM Usage

Refactor:

- ingestion
- skills

Original target:

```ts
llm(...)
```

Current state:

```ts
control.execute(...)
```

Status:

- implemented for ingestion extraction
- nested control decisions now propagate into top-level persisted run summaries
- repo-wide enforcement is still a follow-up step

---

## Step 5 — First Controlled Extraction

Implement:

```txt
transcript → control → idea nodes
```

Flow:

```txt
read transcript
→ build context
→ control.execute (extract ideas)
→ validate
→ create idea nodes
→ log run
```

Status:

- not implemented yet
- current extraction produces validated structured summaries plus control trace
- current ingestion does **not** yet create `idea` or `skill` nodes from transcript extraction

---

## Step 6 — Harden YouTube Ingestion

Full pipeline:

```txt
fetch
→ clean
→ structure
→ control (extract)
→ store nodes
→ log run
```

Status:

- implemented for the YouTube ingestion path
- run traces now aggregate:
  - `fetch:youtube`
  - `clean:transcript`
  - `structure:text`
  - controlled extraction stages
  - storage stages
- top-level run logging receives the nested ingestion trace

---

## Step 7 — Define Duplicate Rules

Target rules:

- one transcript per YouTube source item
- reuse `source` nodes
- prevent duplicate node creation

Decision for YouTube:

- accept a full YouTube URL as input
- extract the canonical `videoId` from that URL
- store `videoId` as the durable source-item identity
- also store the full original URL as metadata
- if the same `videoId` is seen again, short-circuit and return the existing transcript result
- skip expensive stages (`fetch`, `clean`, `structure`, `extract`) on duplicate reuse

Status:

- implemented for the YouTube ingestion path
- duplicate detection uses canonical `videoId` extracted from the supplied YouTube URL
- the original supplied URL is still stored as metadata
- duplicate transcript ingestions short-circuit before expensive stages
- `source` node reuse remains deterministic via `source` node ids

---

## 10. Summary

LLAAB is evolving from:

```txt
structured notes + LLM usage
```

into:

```txt
controlled execution system with persistent knowledge
```

---

## The critical shift

> The system does not trust the LLM.
> The system verifies, controls, and records it.

---

## The most important invariant

> No unvalidated output enters the vault.

---

## The keystone

> `control.execute()` becomes the gateway to all intelligence.

---
