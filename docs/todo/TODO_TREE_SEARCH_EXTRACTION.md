# TODO — Tree Search Extraction: Multi-Model Adaptive Inference

> **Status:** Proposal — not scoped for implementation.
> **Priority:** P3 (Backlog) — depends on stable multi-provider routing, harness prep, and a
> verifiable scoring function for extraction quality.
> **Source:** Sakana AI, "Wider or Deeper? Scaling LLM Inference-Time Compute with Adaptive
> Branching Tree Search" (AB-MCTS). Paper: https://arxiv.org/abs/2503.04412
> **Framework:** TreeQuest (Apache 2.0) — https://github.com/SakanaAI/treequest
> **Generated:** 2026-06-24

---

## Concept

LLAAB's current extraction pipeline runs a single LLM call per transcript: one model, one
pass, one set of ideas. If the model misses an insight or produces a weak summary, the only
recourse is manual re-extraction with the same or a different model.

AB-MCTS (Adaptive Branching Monte Carlo Tree Search) proposes a fundamentally different
approach: instead of one call, run an adaptive tree search where the system decides at each
step whether to **refine** a promising extraction (go deeper) or **restart** with a fresh
attempt (go wider), and **which model** should take the next step. Thompson sampling balances
exploration and exploitation across both dimensions.

The key insight from the Sakana AI paper: models that perform poorly in isolation can
meaningfully improve a team. DeepSeek-R1 alone scored low on ARC-AGI-2, but when combined
with o4-mini and Gemini-2.5-Pro via Multi-LLM AB-MCTS, the system solved problems that no
individual model could crack. One model generates a wrong-but-useful partial answer; a
different model refines it into a correct solution.

---

## Why this fits LLAAB

LLAAB already has the infrastructure primitives that AB-MCTS requires:

| AB-MCTS requirement    | LLAAB primitive                                        | Status     |
| ---------------------- | ------------------------------------------------------ | ---------- |
| Multiple LLM providers | `LlmProvider` interface (Ollama, LM Studio, Anthropic) | ✅ Done    |
| Model routing          | `routeLlm` with task → tier → provider resolution      | ✅ Done    |
| Execution governance   | `control.execute()` with schema validation and retry   | ✅ Done    |
| Run tracing            | `RunNode` with stages, decisions, LLM metadata         | ✅ Done    |
| Token-aware prep       | Harness prep with chunking and budget validation       | ✅ Done    |
| Output scoring         | `ExtractedKnowledgeSchema` Zod validation              | ✅ Partial |

The missing piece is the **search orchestrator** — the component that decides "refine or
restart, and with which model?" based on accumulated scores across the search tree.

---

## What this would look like in LLAAB

### Current extraction flow (single-pass)

```
transcript body
  → harness prep (token count, chunk if needed)
  → control.execute(routeLlm('extract', ...))
  → validate ExtractedKnowledgeSchema
  → accept or retry once
  → create IdeaNodes
```

### Proposed tree search extraction flow

```
transcript body
  → harness prep (token count, chunk if needed)
  → TreeSearch.run({
      providers: [ollamaProvider, lmStudioProvider],
      models: ['gemma-4-e4b', 'gemma-4-26b-a4b-qat'],
      maxCalls: configurable (e.g. 10, 25, 50),
      scorer: extractionScorer,
      strategy: 'ab-mcts',
    })
    → iteration 1: E4B generates extraction A (score: 0.6)
    → iteration 2: E4B refines A → extraction A' (score: 0.7)
    → iteration 3: 26B generates extraction B (score: 0.8)  ← go wider
    → iteration 4: 26B refines B → extraction B' (score: 0.85)
    → iteration 5: E4B generates extraction C (score: 0.5)  ← go wider
    → iteration 6: 26B refines B' → extraction B'' (score: 0.9) ← go deeper
    → ...
  → select best extraction (B'')
  → create IdeaNodes from best result
  → persist full search tree as RunNode stages
```

### The scoring function problem

AB-MCTS requires a **verifiable scoring function** that can evaluate extraction quality
without human judgment. The ARC-AGI-2 experiments use code execution against test cases —
the score is binary (code passes or fails). Extraction quality is harder to score
automatically.

Potential scoring approaches for LLAAB extraction:

| Approach                    | Score signal                               | Strength          | Weakness                               |
| --------------------------- | ------------------------------------------ | ----------------- | -------------------------------------- |
| Schema validation pass/fail | Binary: did it parse?                      | Already exists    | Too coarse — most extractions parse    |
| Idea count                  | Number of ideas extracted                  | Simple            | More ideas ≠ better ideas              |
| Idea diversity              | Semantic distance between ideas            | Measures coverage | Requires embedding model               |
| Summary quality             | Summary length, specificity                | Easy to measure   | Length ≠ quality                       |
| Cross-model agreement       | Do different models extract similar ideas? | Strong signal     | Expensive (needs multiple extractions) |
| Composite score             | Weighted combination of above              | Balanced          | Requires tuning weights                |

The scoring function is the hardest design decision in this proposal. Without a good scorer,
tree search degenerates into expensive repeated sampling with no adaptive benefit.

---

## Integration with TreeQuest

Sakana AI's TreeQuest framework (Apache 2.0) provides the AB-MCTS algorithm as a reusable
library. Rather than reimplementing the tree search logic, LLAAB could consume TreeQuest
directly.

TreeQuest is Python-based. Integration options:

1. **Python sidecar process** — LLAAB's Bun server spawns a Python process running TreeQuest,
   communicating via JSON over stdin/stdout. TreeQuest calls back to LLAAB's
   `/api/llm/complete` endpoint for each LLM call. Cleanest separation of concerns.

2. **Port to TypeScript** — reimplement the AB-MCTS algorithm in TypeScript using the paper's
   pseudocode. Avoids Python dependency but loses upstream updates.

3. **TreeQuest as MCP server** — wrap TreeQuest in an MCP server that LLAAB can call as a
   tool. Fits the existing MCP architecture but adds latency per call.

Recommendation: option 1 (Python sidecar) for prototyping, with option 2 as a future
graduation path if the approach proves valuable.

---

## Resource and cost implications

### Local inference (Ollama / LM Studio)

- **Cost:** $0.00 per search
- **Time:** at 30s per extraction call, a 25-call search takes ~12 minutes per transcript.
  A 50-call search takes ~25 minutes. This is acceptable for overnight batch processing
  (via cron recipes) but too slow for interactive use.
- **Recommendation:** tree search extraction should be a background job, not a blocking UI
  operation. Queue transcripts for tree search, process via cron, surface results in the
  Activity Monitor.

### Remote inference (Anthropic)

- **Cost:** at Claude Sonnet rates ($3/$15 per 1M tokens), a 25-call search with ~8K prompt
  tokens per call = ~200K input tokens = ~$0.60 per transcript. A 50-call search = ~$1.20.
  Not prohibitive for occasional high-value extractions, but not a default.
- **Recommendation:** remote providers should only participate in tree search when explicitly
  opted in, with cost estimation shown before execution.

### Hybrid (local exploration, remote refinement)

The most interesting configuration: use cheap local models (E4B) for the "go wider" branch
(generating diverse initial extractions) and expensive remote models (Claude) for the
"go deeper" branch (refining the most promising extraction). AB-MCTS's adaptive allocation
naturally shifts budget toward the model that's producing better results.

---

## Prerequisites (must be done first)

- [ ] Stable multi-provider routing with `LlmProvider` interface — ✅ Done
- [ ] LLM metadata in node frontmatter for comparison — ✅ Done
- [ ] Cron recipe infrastructure for background processing — ✅ Done
- [ ] Design and validate the extraction scoring function — **Not started**
- [ ] Evaluate TreeQuest on a small-scale test (5 transcripts, 10 calls each) — **Not started**

---

## Proposed phases (when this work is picked up)

### Phase A — Design the extraction scorer

Define and validate a scoring function for extraction quality. Test it against existing
extraction runs in the vault: do higher-scoring extractions correlate with subjectively
better ideas? This phase produces no infrastructure — just a scorer function and a
validation report.

### Phase B — TreeQuest spike

Run TreeQuest as a standalone Python process against 5 LLAAB transcripts. Use the scorer
from Phase A. Compare the tree search results against single-pass extraction on the same
transcripts. Measure: idea count, idea diversity, summary quality, total time, total tokens.

### Phase C — LLAAB integration

If Phase B shows meaningful improvement:

- Implement the Python sidecar integration
- Add a `tree-search-extract` command to the command bus
- Add a cron recipe for batch tree search extraction
- Persist the full search tree as RunNode stages
- Surface best-extraction results in the transcript detail page

### Phase D — Multi-model adaptive routing

Enable Multi-LLM AB-MCTS with adaptive model selection:

- E4B for fast, diverse initial extractions (go wider)
- 26B for deep refinement of promising extractions (go deeper)
- Anthropic Claude for high-value refinement (opt-in, cost-gated)
- Thompson sampling learns per-transcript which model is most effective

---

## What this does NOT replace

- Single-pass extraction remains the default for interactive ingestion. Tree search is for
  background batch processing of high-value transcripts.
- `control.execute()` remains the governance layer. Tree search calls through control, not
  around it.
- The harness prep pipeline remains the context preparation layer. Tree search operates on
  prepared context, not raw transcript text.
- Human-in-the-loop remains the quality gate. Tree search produces candidates; the user
  decides which ideas to promote from seed to growing/mature.

---

## Related LLAAB items

| Item                                                     | Relationship                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| TODO_ORCHESTRATION_V5 Phase 7 — Capability-based routing | Prerequisite — tree search needs capability queries to select models                                      |
| ROADMAP P3 — Source Auto-Follow                          | Natural pairing — re-ingest followed sources with tree search for deeper extraction                       |
| Cron recipes infrastructure                              | Execution surface — tree search runs as a cron recipe                                                     |
| TOOL_LANDSCAPE_COMPARISON — LM Studio                    | Provider — MLX speed makes local tree search practical                                                    |
| TOOL_LANDSCAPE_COMPARISON — Hermes                       | Architectural parallel — Hermes's skill learning loop is conceptually similar to adaptive model selection |

---

## One-line summary

> Use adaptive tree search to get better ideas from the same transcripts by letting multiple
> models explore and refine extractions, instead of betting on a single pass from one model.
