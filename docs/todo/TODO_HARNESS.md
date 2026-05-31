# TODO — Harness Integration

> **Status:** Phase 1 spike complete (2026-05-31). Real-flow validation and priority decision still pending.

## Summary

LLAAB now has a published external package available:

- `@finografic/ai-harness@0.1.0`

That package currently provides:

- explicit pipeline primitives
- deterministic step composition
- a real debug pipeline (`typecheck -> parse -> slice -> structure`)

It does **not** yet provide the full runtime features originally imagined for LLAAB:

- token counting
- chunking long inputs
- structured context assembly for model calls
- deterministic model routing

So the LLAAB plan needs to split into two layers:

1. **consumer adoption now**
2. **full runtime harness later**

---

## Where harness sits in LLAAB

Harness should not sit as one universal wrapper above every ingestion pipeline stage.

The better mental model is:

> harness sits at the **control boundary around model-facing work**

That means:

- fetch/clean/structure/store stages stay deterministic and local to each pipeline
- harness wraps the preparation and shaping that happens **before** `control.execute()` or other
  model-facing execution
- the exact usage can differ by task, but the conceptual position stays the same

For ingestion, the first important insertion point is:

```txt
fetch
→ clean
→ structure
→ harness prep
→ control.execute / routeLlm
→ parse / validate
→ store / link / trace
```

For short inputs, harness can collapse to a very small prep layer.
For long transcripts, it becomes much more substantial.

---

## Current LLAAB reality

Today, transcript extraction in LLAAB already has a clear boundary:

- `packages/ingestion/src/extract/llm-extract.ts`
- `packages/control/src/orchestrator.ts`

Current behavior:

- truncates input by character count
- sends the prepared text into `routeLlm(...)`
- validates through `control.execute(...)`

This means harness adoption should start **there**, not as a generic top-of-system rewrite.

---

## Phase 1 — Adopt the released package

Goal: prepare LLAAB to install and use `@finografic/ai-harness` intentionally, without forcing
the package to solve all runtime harness concerns immediately.

### Current status

- dependency adoption in `@llaab/ingestion`: done
- first extraction-boundary spike in `llm-extract.ts`: done
- real transcript-flow validation: pending

### Tasks

- Add `@finografic/ai-harness` as a dependency in the workspace(s) that will consume it first.
  Status: done in `@llaab/ingestion`.
- Decide the first consumer package.
  Status: `@llaab/ingestion` chosen for the first integration spike.
- Add a small local spike or adapter around transcript extraction that proves the package can be
  used cleanly inside LLAAB.
  Status: done via local extraction-prep pipeline before `control.execute(...)`.
- Keep the current truncation-based extraction path intact unless the package exposes a clearly
  better replacement.
  Status: done — current semantics preserved.
- Validate the integration against real transcript ingestion and extraction runs.
  Status: pending.

### Success condition

- LLAAB imports the released package
- the package is exercised in a real consumer path
- the integration boundary is proven without destabilizing extraction

---

## Phase 2 — Define the runtime harness boundary

Goal: formalize the exact point where LLAAB transitions from deterministic preprocessing into
model-facing preparation.

### Tasks

- Define what belongs in deterministic ingestion vs harness prep vs control execution.
- Decide whether harness prep should live closer to:
  - `packages/ingestion`
  - `packages/llm`
  - `packages/control`
- Document the handoff contract between:
  - structured input
  - harness-prepared context
  - `control.execute(...)`

### Design rule

Do **not** spread harness logic across multiple layers without a clear contract.

---

## Phase 3 — Extend ai-harness for real LLAAB runtime needs

This is the larger feature set originally described in the old harness notes.

### Needed capabilities

#### 1. Token counting and chunking

- `countTokens(text, model?)`
- `chunkText(text, opts)`
- overlap support
- model-aware chunk limits

#### 2. Context assembly

- build a structured `Context`
- assemble instructions, constraints, examples, and input data
- respect input/output budget boundaries

#### 3. Deterministic routing

- choose provider/model/maxTokens based on task type and input size
- start with config-driven routing only

### First concrete driver

- transcript extraction for long YouTube ingestions

This replaces the current character-count truncation with a real preparation layer.

---

## Priority recommendation

Harness is now strong enough to move **up** in priority, but not as the full original concept.

Recommended ordering:

1. **Now:** validate the installed package in the real transcript extraction flow
2. **After that:** decide and document the exact runtime boundary
3. **Then:** extend the package for token-aware extraction prep

That means:

- harness consumer adoption can reasonably move to **P1**
- full token-aware runtime harness should remain **P2** until the package grows past its current
  debug-pipeline-only shape

---

## What not to do yet

- do not rewrite all ingestion pipelines around harness at once
- do not move fetch/clean/structure logic into the harness package
- do not add LLM-based routing
- do not over-generalize before the transcript extraction path proves the contract
