# LLAAB — Architectural Priorities

> **Reference document** — ranked architectural improvements from an external LLM-system analysis,
> filtered for LLAAB. Informed the control-layer work completed in April 2026.
>
> **Living implementation tracker:** [`docs/05_CONTROL_LAYER_AND_EXECUTION_MODEL.md`](./05_CONTROL_LAYER_AND_EXECUTION_MODEL.md)
> **Active backlog:** [`docs/todo/ROADMAP.md`](./todo/ROADMAP.md)

This document summarizes the most important architectural improvements suggested by the external LLM-system analysis, filtered through the actual needs and current state of LLAAB.

The goal here is not to collect every interesting idea.
It is to rank the improvements that would most improve LLAAB as a real local-first lab.

---

## Core Judgment

The outside analysis makes several strong points.

The two most important for LLAAB are:

1. **LLMs should be treated as constrained, untrusted compute primitives**
2. **A control layer is missing from the current mental model and should become explicit**

The control-layer point is especially important.

Without it, LLAAB risks drifting into a vague pattern like:

```txt
input -> context -> model -> output
```

That is too thin for a serious system.

For LLAAB, the more useful system model is:

```txt
input
-> control
-> retrieval / context assembly
-> model
-> control
-> storage / output / next action
```

That framing fits LLAAB better because the project is not trying to be “an AI app.”
It is trying to become a lab where knowledge, execution, and refinement all remain inspectable.

---

## Ranked Improvements

## 1. Add an explicit control layer

**Priority:** highest — **implemented** (`packages/control`, 2026-04-08)

This is the most important improvement to lock into the architecture now.

Why it matters:

- it gives LLAAB a place to decide whether to call the model at all
- it gives LLAAB a place to validate model output before it becomes trusted state
- it gives LLAAB a place to retry, branch, reject, or downgrade behavior
- it prevents “LLM output leaks directly into the system” design

What this means in LLAAB terms:

- ingestion should not move directly from `llmExtract()` to stored truth without checks
- future skill execution should not treat model output as automatically valid
- the control layer should own routing, validation, retry rules, and failure handling

Suggested first implementation moves:

1. define a small orchestration boundary for LLM-backed flows
2. separate deterministic stages from model stages explicitly
3. require post-model validation before node creation or mutation
4. log decisions through runs

---

## 2. Treat all LLM output as untrusted until validated

**Priority:** very high — **implemented** for ingestion extraction (`control.execute()` + schema validation)

This is already partially aligned with LLAAB’s philosophy, but it should become stricter.

Why it matters:

- LLAAB is trying to produce structured knowledge, not just plausible text
- once model output enters the vault, it becomes part of the lab’s memory
- bad memory is more dangerous than a bad one-off response

What this means in practice:

- model output should pass schema validation
- model output should often pass deterministic checks beyond schema validation
- some outputs should be stored as provisional or candidate state before promotion

Good design stance:

```txt
model output = proposal
validated output = admissible system state
```

---

## 3. Strengthen the retrieval and context-assembly layer

**Priority:** very high — **open** (ROADMAP P3)

The external analysis is correct that “reasoning operates on context” and that retrieval is a system concern, not intelligence.

For LLAAB, this matters because the project’s long-term value depends on selecting the right local knowledge, not dumping everything into prompts.

Why it matters:

- the vault will grow
- source backlog will grow
- context quality will matter more than raw model quality
- local-first systems pay a real cost for noisy context

What to improve:

1. define what context belongs to each workflow
2. avoid large undifferentiated prompt stuffing
3. distinguish:
   - direct source material
   - derived summaries
   - operational instructions
   - execution history
4. decide when retrieval should happen:
   - before model call
   - after deterministic cleaning
   - after failed validation

This is especially relevant once YouTube ingestion begins producing many transcript nodes.

---

## 4. Make deterministic boundaries first-class

**Priority:** high — **implemented** in ingestion pipeline stages

The manifesto already leans this way, but the system should make the boundary more explicit:

- deterministic fetch
- deterministic clean
- deterministic structure
- probabilistic extract
- deterministic validate
- deterministic store

Why it matters:

- it makes failures easier to localize
- it makes pipelines easier to debug
- it protects the vault from vague model behavior

This improvement pairs naturally with the control layer.

---

## 5. Upgrade run logging into real observability

**Priority:** high — **implemented** (`RunNode` persistence via `runSkill`; P2 adds LLM metadata to frontmatter)

This is not just a feature request.
It is an architectural necessity if LLAAB is going to behave like a lab.

Why it matters:

- no control layer is trustworthy without visible decisions
- no ingestion flow is trustworthy without execution records
- no refinement loop is real without history

What “better than current” looks like:

- persist run nodes
- capture stage-level status
- record inputs, outputs, and created nodes
- record validation failure reasons
- record whether the model was skipped, used, retried, or rejected

The external analysis talks about silent failure.
Run logging is one of the main defenses against that.

---

## 6. Add promotion states between raw capture and trusted knowledge

**Priority:** medium-high — **open** (ROADMAP P3)

This is my own addition, but it follows directly from the outside analysis.

Right now, LLAAB has `seed -> growing -> mature -> archived`.
That is good, but LLM-assisted creation may eventually benefit from an explicit notion of candidate or provisional state.

Why it matters:

- extracted outputs are often not “mature” immediately
- candidate knowledge may need review or further passes
- this gives the control layer a cleaner place to store partially trusted results

This may or may not require a new schema field immediately.
But the concept should be kept in mind.

---

## 7. Design duplicate-handling and canonicalization rules early

**Priority:** medium-high — **mostly implemented** for YouTube; broader dedupe TBD

This becomes important quickly once ingestion starts in earnest.

Why it matters:

- many sources will point to overlapping concepts
- repeated ingests can create transcript duplication
- extracted skills and ideas may collide semantically

For LLAAB, canonicalization is not optional forever.
It is part of keeping the lab coherent.

Good early targets:

- duplicate YouTube ingest behavior
- source-node reuse rules
- transcript canonicalization rules
- future idea/skill extraction dedupe rules

---

## 8. Keep the “LLM as speculative execution engine” mental model

**Priority:** medium — **captured** in `docs/05_CONTROL_LAYER_AND_EXECUTION_MODEL.md`

This is not an immediate code task, but it is an important architectural stance.

The CPU analogy is useful, but incomplete.
CPUs are deterministic.
LLMs are not.

The better mental model is:

| Layer     | Better Framing                                   |
| --------- | ------------------------------------------------ |
| `LLM`     | speculative execution engine                     |
| `Context` | working memory + instruction tape                |
| `RAG`     | non-deterministic or selective I/O fetch         |
| `Tools`   | side-effectful operations with verification cost |

Why it matters:

- it changes how you think about safety
- it changes how you think about retries
- it changes how you think about validation and trust

This should influence architecture, even if it does not appear as a named module.

---

## 9. Delay database and graph expansion until the control path is real

**Priority:** medium — **aligned** with ROADMAP P3 ordering

This is more of a sequencing recommendation than a new idea.

The outside analysis correctly emphasizes system structure around the model.
For LLAAB, that means:

- retrieval discipline
- control
- validation
- observability

should all come before:

- SQLite indexing sophistication
- graph visualization depth
- broader UI exploration

Those later items will be more useful once the execution and ingestion loops are producing trustworthy structure.

---

## What I Would Not Prioritize Yet

These are valid themes, but not the next most important improvements for LLAAB:

| Topic                      | Why Not Yet                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| vector DB depth            | retrieval discipline matters before storage sophistication                        |
| embeddings strategy        | useful later, but premature before core ingestion/control loops mature            |
| vendor/model comparisons   | LLAAB still benefits more from better system boundaries than from model switching |
| prompt micro-optimization  | weak leverage compared with better retrieval and validation                       |
| UI-heavy graph exploration | useful later, but not the most important next architectural move                  |

---

## Recommended Order For LLAAB

If I translate this analysis into an action order for the actual project, I would recommend:

1. complete `writeNode()` and `updateNode()` — **done**
2. persist `run` nodes — **done**
3. introduce a lightweight control/orchestration boundary around LLM-backed flows — **done**
4. harden YouTube ingestion as the first real feature — **done**
5. improve validation and duplicate-handling rules — **partial** (YouTube dedupe done)
6. improve retrieval/context selection — **open** (ROADMAP P3)
7. only then expand indexing, graph views, or deeper LLM features — **aligned**

---

## Short Version

- The outside analysis is directionally very good.
- The most important improvement is the explicit **control layer**.
- The second most important improvement is stricter treatment of **LLM output as untrusted proposals**.
- For LLAAB specifically, the best near-term path is still:
  - node write/update helpers
  - persistent run logging
  - control around ingestion/extraction
  - YouTube ingestion as the first real feature
