# LLAAB — Control Layer Phase 2 Plan

**Goal:** Evolve LLAAB from "structured notes + direct LLM usage" into a controlled execution system where LLM output is governed, validated, logged, and only then admitted into the vault.

**Why this matters:** The current repo already has typed nodes and schema validation, but LLM-backed extraction is still called directly from ingestion, run logging is not persisted, and there is no mutation layer for safely updating existing nodes. The control layer closes those gaps and makes execution inspectable, repeatable, and trustworthy.

---

## Architectural decision

The control-layer document is directionally correct, but the implementation should land in a practical order:

1. **Mutation layer first** — `writeNode()` and `updateNode()` in `@llaab/core`
2. **Run observability next** — richer `run` schema + persisted run nodes
3. **Minimal control gateway** — a small `@llaab/control` package with `execute<T>()`
4. **First integration point** — route ingestion extraction through control
5. **Lightweight provenance now** — structural source links today, heavier relationship graph later

This gets the architecture right without overbuilding the final system too early.

---

## Current gaps

| Area        | Current state                                                                   | Risk                                         |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| LLM usage   | `packages/ingestion/src/extract/llm-extract.ts` calls `@llaab/llm` directly     | no governing layer, no retry/decision policy |
| Run logging | `packages/skills/src/runner.ts` returns an in-memory record only                | execution is not persisted or inspectable    |
| Node writes | `createNode()` exists, but there is no `writeNode()` / `updateNode()`           | existing nodes cannot be safely evolved      |
| Provenance  | `source` nodes exist, but most node types do not encode structural source links | weaker retrieval, lineage, and trust         |

---

## Scope for this phase

### In scope

- add a new `@llaab/control` package
- add `writeNode()` and `updateNode()` to `@llaab/core`
- expand `RunNodeSchema` for stages, decisions, and LLM traces
- persist `run` nodes in `vault/runs`
- route ingestion extraction through `control.execute()`
- add lightweight provenance fields where they improve structural traceability
- add tests for the new architectural seams

### Explicitly deferred

- vector DB / embedding work
- graph visualization
- multi-agent abstractions
- weighted trust scoring
- full relationship-edge store
- repo-wide retrieval engine redesign

---

## Target shape

```txt
skill definition
→ runner
→ control.execute()
    → context shaping
    → optional LLM call
    → schema validation
    → policy decision
→ node creation / update
→ persisted run node
```

---

## File map

### Create

- `packages/control/package.json`
- `packages/control/tsconfig.json`
- `packages/control/src/index.ts`
- `packages/control/src/orchestrator.ts`
- `packages/control/src/types.ts`
- `packages/control/src/orchestrator.test.ts`
- `packages/core/src/utils/write-node.utils.ts`
- `packages/core/src/utils/update-node.utils.ts`
- `packages/core/src/utils/write-node.utils.test.ts`
- `packages/skills/src/runner.test.ts`

### Modify

- `package.json`
- `turbo.json` or workspace config if needed for new package
- `packages/core/src/index.ts`
- `packages/core/src/utils/create-node.utils.ts`
- `packages/schemas/src/run-node.schema.ts`
- `packages/schemas/src/idea-node.schema.ts`
- `packages/schemas/src/skill-node.schema.ts`
- `packages/schemas/src/transcript-node.schema.ts`
- `packages/schemas/src/resource-node.schema.ts`
- `packages/schemas/src/index.ts`
- `packages/skills/src/runner.ts`
- `packages/ingestion/src/extract/llm-extract.ts`
- `packages/ingestion/src/pipeline.ts`

---

## Testing strategy

The current root script expects `vitest`, but it is not installed. Before writing feature code:

1. add a test runner that matches the existing root script (`vitest`)
2. write failing tests for the smallest contracts first

Initial tests:

- `writeNode()` writes a validated node back to its deterministic file path
- `updateNode()` preserves `id` / `type` and refreshes `updatedAt`
- `control.execute()` retries invalid output according to policy
- `runSkill()` persists a `run` node with status, stage info, and produced node ids

---

## Implementation tasks

### Task 1 — Test harness and mutation-layer tests

- install and wire `vitest`
- write failing tests for `writeNode()` and `updateNode()`
- verify the tests fail for the expected missing-implementation reason

### Task 2 — Core mutation layer

- extract shared node serialization from `create-node.utils.ts`
- implement `writeNode(node)`
- implement `updateNode(filePath, updater)`
- export both from `@llaab/core`

### Task 3 — Run schema hardening

- add `stages`
- add `decisions`
- add optional `llm` trace object
- keep the schema compatible with non-LLM runs

### Task 4 — Persisted run nodes

- refactor `runSkill()` to create and write a real `run` node
- keep the returned record ergonomic for callers

### Task 5 — Minimal control package

- define `ControlExecuteInput<T>`
- define `ControlPolicy`
- implement `execute<T>()` with:
  - executor callback
  - validation
  - retry / reject logic
  - decision trace output

### Task 6 — Ingestion integration

- route `llmExtract()` through `control.execute()`
- capture structured control metadata for logging
- ensure invalid output never enters node creation

### Task 7 — Lightweight provenance

- add `sourceId?: NodeId` to the externally-derived node types that benefit now
- set it in ingestion where a `source` node is known or created
- treat this as the short-term bridge to richer graph edges later

### Task 8 — Verification and docs

- run targeted tests
- run typecheck
- update high-signal docs if implementation meaningfully changes developer guidance

---

## Invariants to preserve

- no unvalidated LLM output enters the vault
- `id` and `type` are stable once a node exists
- `updatedAt` changes on mutation writes
- control owns validity decisions, not skills
- if execution matters, it must be persisted as a `run`

---

## Recommended checkpoint order

Use these as safe pause markers if session budget gets tight:

1. **CHECKPOINT 1** — plan doc + test harness + failing mutation tests
2. **CHECKPOINT 2** — mutation layer green
3. **CHECKPOINT 3** — richer run schema + persisted run nodes
4. **CHECKPOINT 4** — minimal control package + ingestion integration
5. **CHECKPOINT 5** — provenance pass + final verification

---

## One-line takeaway

The LLM should stop being an ungoverned helper call and start being a controlled subsystem whose output is validated, recorded, and admitted into the vault only through explicit system gates.
