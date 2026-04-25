# Harness Integration — Roadmap Section

> Paste the P2 entry into `_ROADMAP.md` under **P2 — Planned**.
> The detail section below can live at `docs/todo/TODO_HARNESS.md` or stay here as a
> self-contained planning reference until a codebase session fleshes it out.

---

## Problem

`control.execute()` governs the LLM call, but assumes the input already fits in context and
the correct model has already been chosen. Long transcripts will exceed context windows, and
model selection is currently implicit. The harness formalizes the pre-call and post-call
pipeline around `execute()`.

---

## Scope

Three concerns, in priority order:

### 1. Token Counting & Chunking (`@llaab/llm`)

- Add `js-tiktoken` (or `@anthropic-ai/tokenizer`) as a dependency of `@llaab/llm`
- Expose a `countTokens(text, model?)` utility
- Build a `chunkText(text, opts)` function:
  - `maxTokens` — per-chunk ceiling (derived from model context window minus prompt overhead)
  - `overlap` — token overlap between chunks (preserves context at boundaries)
  - returns `{ chunks: string[], tokenCounts: number[] }`
- Chunking is a pure utility — no LLM involvement, no control dependency

### 2. Context Assembly (`@llaab/control`)

- Formalize the `Context` shape already sketched in the control layer doc:

```ts
  interface Context {
    instructions: string;
    data: unknown;
    constraints?: string[];
    examples?: unknown[];
  }
```

- Add a `buildContext()` helper that:
  - accepts raw input + task type + target schema
  - measures token budget (total window minus reserved output tokens)
  - assembles instructions, data, constraints, examples within budget
  - returns a `Context` ready for `execute()`
- This is where prompt templates live — they are structured, not ad-hoc strings

### 3. Deterministic Model Routing (`@llaab/llm`)

- Start with Tier 1: a config map, not an LLM call
- Routing inputs: `taskType` + `inputTokenCount` + `outputSchema complexity`
- Routing outputs: `{ provider, model, maxTokens }`
- Example rules (starting point):
  - `tag` / `classify` → Ollama small (e.g., `llama3.2:3b`)
  - `extract` + input < 4k tokens → Ollama mid (e.g., `llama3.1:8b`)
  - `extract` + input > 4k tokens → Anthropic Claude
  - `reason` / `synthesize` → Anthropic Claude always
- Config lives in `@llaab/llm`, consumed by `control.execute()` when no explicit model is passed
- RunNode traces feed future Tier 2 heuristic tuning (not built now, but the data accumulates)

---

### Integration Point

The harness does NOT replace `control.execute()`. It wraps the preparation layer:

```
input
→ countTokens (llm)
→ chunkText if needed (llm)
→ selectModel (llm, deterministic)
→ buildContext per chunk (control)
→ control.execute() per chunk (existing)
→ merge/validate outputs (control)
→ vault + run logging (existing)
```

For single-chunk inputs (most idea captures, short transcripts), the pipeline collapses to
`buildContext → execute()` — no overhead.

---

### What This Unlocks

- **Step 5** (transcript → idea extraction) becomes viable for long transcripts
- **Agent loop** gets smarter routing without per-skill model hardcoding
- **Run traces** capture token counts and model selection rationale — execution becomes knowledge
- **Future chunked skills**: summarize-then-merge, map-reduce extraction, progressive refinement

---

### What This Does NOT Include

- No LLM-based routing (Tier 3) — deterministic config only
- No vector DB or embedding-based retrieval
- No new package — changes land in `@llaab/llm` and `@llaab/control`
- No UI changes
- Detailed implementation requires a codebase-visible session to align with current file structure

---

### Dependencies

- `js-tiktoken` or `@anthropic-ai/tokenizer` (new dependency, lightweight)
- Existing: `@llaab/llm`, `@llaab/control`, `@llaab/schemas` (Zod types for Context, routing config)

---

### Suggested Priority

**P2** — direction is decided, and the natural trigger is Step 5 (first controlled extraction).
When Step 5 becomes P0, the tokenization + chunking piece moves with it. Model routing can
trail slightly — it's useful but not blocking until you're running mixed local/remote workloads.
