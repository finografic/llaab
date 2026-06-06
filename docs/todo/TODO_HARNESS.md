# TODO — Harness Integration

> **Status:** Phase 1 validation complete (2026-06-07). Token-aware harness extension is promoted
> ahead of Terminal Panel.

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

Validation result (2026-06-07): real YouTube ingest + `extract-transcript-ideas` was run in a
temp vault with local Ollama. The persisted RunNode includes useful harness stage payloads:
`truncate-extraction-input` records input length, max chars, prepared length, and truncation;
`build-extraction-context` records prepared length, truncation state, constraint count, and
instruction presence. Extraction succeeds, but the 6 000-character cap retained only 6 039 of
19 207 chars (`31.4%`) while using 1 537 of 8 192 prompt-context tokens (`18.8%`). Verdict:
current prep is stable enough to keep local for now, but blind character truncation is the next
quality blocker; token-aware chunking/context assembly should move ahead of Terminal Panel.

### Current status

- dependency adoption in `@llaab/ingestion`: done
- first extraction-boundary spike in `llm-extract.ts`: done
- real transcript-flow validation: done — see validation result above

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
  Status: done.

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

1. **Done:** validate the installed package in the real transcript extraction flow
2. **Next:** decide and document the exact runtime boundary
3. **Then:** extend the package for token-aware extraction prep

That means:

- harness consumer adoption is complete
- full token-aware runtime harness should move ahead of Terminal Panel because real validation
  showed silent content loss despite available model context

---

## What not to do yet

- do not rewrite all ingestion pipelines around harness at once
- do not move fetch/clean/structure logic into the harness package
- do not add LLM-based routing
- do not over-generalize before the transcript extraction path proves the contract
