# TODO — Knowledge Retrieval and Chat

> **Status:** Phases 0–2 complete (2026-07-28), pending your review of the draft eval fixtures.
> Phases 3–14 not started.

## Goal

Turn `knowledge/` and `vault/` into a retrieval corpus the local model can answer from as if it
were part of its own training data — accurately, with provenance, and without the operator having
to know where anything is filed.

The end state is a system that can be asked an open-ended question and will find the right local
evidence, tell the difference between what it read and what it inferred, cite what it used, and
improve measurably over time as real questions expose real misses.

## Design Position

This plan is deliberately **lexical-first and measurement-first**. Embeddings are a ranking
adapter to be added when fixtures prove a need (Phase 5), not the foundation. The reasoning is in
[`DONE_SEARCH_RETRIEVAL_FOUNDATION.md`](./DONE_SEARCH_RETRIEVAL_FOUNDATION.md) § Embedding
Decision: a vector store adds an index lifecycle, cache invalidation, and a background-job shape
that LLAAB's execution rules do not permit, and it should only be paid for against evidence.

Ordering principle: **measure → improve what is cheap and deterministic → add semantics → improve
the answer → widen the surface → close the loop.** Each phase should be independently shippable
and independently reversible.

## Decisions Needed From You

Every phase below carries a **Depends on** line and a **Your input** line. Legend: 🔴 blocking —
do not start without a decision · 🟡 a preference or budget, best answered from real usage ·
🟢 none, implementation detail.

| Phase | Decision                                                                                 | When it is needed                   |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| 5 🔴  | Spend on embeddings at all; local vs cloud model — cloud sends vault content off-machine | Only once Phase 2 proves a miss     |
| 10 🔴 | Whether chat threads become durable vault nodes, and `ChatNode` vs `RunNode` turns       | Before any durable-session work     |
| 12 🔴 | `/chat` layout, and whether it replaces or complements the Terminal                      | Before UI work                      |
| 4 🟡  | Where the index lives and what triggers a rebuild                                        | At Phase 4 start                    |
| 7 🟡  | Acceptable answer latency budget                                                         | At Phase 7 start                    |
| 8 🟡  | How strictly the system should refuse on weak evidence                                   | Tunable any time                    |
| 11 🟡 | Iteration and token ceiling per agentic question                                         | At Phase 11 start                   |
| 2 🟡  | Which node _should_ rank for a given question                                            | Reviewable after a draft set exists |
| 6 🟡  | Your shorthand versus corpus vocabulary                                                  | Emerges from real misses            |

**Nothing blocking is in the way of starting.** Phases 2, 3, and 8 need no decision from you up
front; Phases 5, 10, and 12 do, and all three are far enough out that the answers will be clearer
by the time they matter.

## Constraints

These are not negotiable and shape every phase below.

- **No background processes.** No watchers, daemons, polling loops, or internal scheduler. Every
  index build, evaluation run, or backfill is a one-shot processor: explicit trigger → run → exit.
  See `.github/instructions/project/agent-execution.instructions.md`.
- **Durable work is a `RunNode`.** Any index build or eval run worth showing status for must be a
  `RunNode` from the moment it starts, with status derived from shared query state. See
  `.github/instructions/project/process-state-architecture.instructions.md`.
- **Retrieval is evidence, not promotion.** A retrieved node is never automatically treated as
  reviewed knowledge. `knowledge/` outranks `vault/` because it was reviewed, not because it
  scored higher.
- **The contract is stable.** `VaultSearchQuery` / `VaultSearchResult` / `VaultContextPacket` are
  the seam. New ranking strategies plug in behind them; consumers (`/api/vault/search`,
  `vault_search` MCP, `chat.ask`) should not need to change shape.
- **Degradation is graceful.** If an index is missing, stale, or corrupt, retrieval falls back to
  the deterministic scan rather than failing. The system must always answer.

## Architecture

```text
question
  │
  ├─ query understanding      (Phase 6) rewrite / expand / decompose
  │
  ├─ candidate retrieval
  │    ├─ lexical BM25        (Phase 4) over persisted inverted index
  │    ├─ semantic kNN        (Phase 5) over persisted vectors
  │    └─ graph expansion     (Phase 9) links, tags, provenance edges
  │        └─ fused via RRF   (Phase 5)
  │
  ├─ rerank                   (Phase 7) top-N reordered by a cheap model
  │
  ├─ context assembly         (Phase 0) bounded packets, tiered knowledge/vault
  │
  ├─ answer                   (Phase 8) grounded, cited, calibrated refusal
  │
  └─ feedback                 (Phase 13) misses become eval fixtures → Phase 2
```

Corpus tiers stay fixed throughout: **KNOWLEDGE** (`knowledge/`, reviewed and canonical) outranks
**VAULT** (`vault/`, raw captures) outranks **model training knowledge**, which is only used to
fill gaps and must be labelled as such.

---

## Phase 0 — Deterministic retrieval contract

- [x] First-class search result shape with score, snippet, matched fields, and provenance.
- [x] `searchVaultNodes` / `rankVaultSearchNodes` with title, tag, and body scoring.
- [x] Bounded context assembly (`buildVaultContextPackets`) with per-packet and total budgets.
- [x] Context kinds separating direct source, derived summary, operational, execution history.
- [x] `GET /api/vault/search`, `/vault/search` UI, and `vault_search` MCP surface.
- [x] Ranking fixtures covering title/tag/body, tie-breaks, filters, provenance, and no-match.
- [x] Explicit embedding deferral with a written decision gate.

Detail: [`DONE_SEARCH_RETRIEVAL_FOUNDATION.md`](./DONE_SEARCH_RETRIEVAL_FOUNDATION.md)

## Phase 1 — Conversational surface (`chat.ask`)

- [x] `chat.ask` command in the typed command bus with capability mapping.
- [x] `searchKnowledgeDocs` — the `knowledge/` counterpart to `searchVaultNodes`.
- [x] Two-tier context assembly with explicit KNOWLEDGE → VAULT → model precedence.
- [x] `Outside the vault:` fallback so synthesized answers stay distinguishable from grounded ones.
- [x] Streamed answer with `chat.context` and `chat.sources` meta events.
- [x] Terminal rendering of clickable, provenance-linked sources.
- [x] `--scope`, `--limit`, `--model`, `--reset` flags; in-process session memory.
- [x] Stopword and punctuation handling in the shared tokenizer (found by live validation).

Detail: `.agents/handoff.md` § Apps → `@llaab/client`.

---

## Phase 2 — Retrieval evaluation harness

**Depends on:** nothing — startable now.
**Your input:** 🟡 **partial, and not blocking.** The harness, metrics, CLI, and baseline can be
built and seeded without you. What only you can supply is judgement: for a given question, which
node _should_ have ranked first. Plan is to ship a draft fixture set for you to correct rather than
block on it.

**Why first:** every later phase is a ranking change, and without a measurement baseline each one
is a guess. This phase is small, has no UI, and unblocks Phases 3–7. It also operationalises the
embedding decision gate that Phase 0 wrote down but left unmeasured.

- [x] Define a gold query set in `packages/core/src/retrieval/fixtures/` — real questions paired
      with the node ids or knowledge paths that _should_ rank. Two sets: `frozen-gold-set.json`
      against a fixed corpus, `live-gold-set.json` against the real vault.
- [x] Implement `recall@k`, `precision@k`, `MRR`, and `nDCG@k` with graded-relevance support.
- [x] Add a one-shot `lab retrieval eval` CLI command printing per-query and aggregate scores, plus
      a diff against the last recorded baseline.
- [x] Record baselines in a committed JSON file so ranking regressions show up in review.
- [x] Add a vitest guard asserting aggregate metrics do not fall below the recorded baseline.
- [x] Document how to add a fixture when a real question retrieves the wrong thing —
      `packages/core/src/retrieval/README.md`.
- [ ] **Review the draft fixtures.** Every `notes` line in `live-gold-set.json` is marked DRAFT and
      states why that document is the right answer. Correct anything you disagree with — a wrong
      fixture is worse than no fixture, because it locks in a wrong target.
- [ ] Replace the drafts with real questions that actually failed, as they accumulate from usage.

**Findings from the first run (2026-07-28).** On the live corpus, 8 of 8 substantive queries rank
their expected document **first** — MRR 0.889, nDCG@k 1.0 across all k. Two consequences:

1. **The Phase 5 embedding gate is not met and is not close.** There is currently no paraphrase
   miss or mis-ranking to justify a vector store. Do not start Phase 5 on principle.
2. **The result is weaker than it looks.** The corpus is 14 wikis, and the queries were written by
   someone who already knew the answers — selection bias in the fixture author's favour. The set
   needs real failed questions before its scores mean much. Precision@10 of 0.24 also shows a
   long weak tail being retrieved, which is what Phases 3–4 address.

**Exit criteria:** a ranking change can be stated as "recall@5 went from X to Y" rather than "it
feels better".

## Phase 3 — Passage-level retrieval

**Depends on:** Phase 2 (soft) — buildable without it, but you cannot prove it helped without it.
**Your input:** 🟢 **none.** Chunk size, overlap, and aggregation are tunable implementation
details validated against fixtures, not preferences.

**Why:** today a whole transcript is scored as one unit and represented by a ~180-character
snippet. A 90-minute transcript that mentions the answer once ranks the same as a focused wiki, and
the assembled context packet may not even contain the relevant sentence. This is the single largest
quality lever available without embeddings.

- [ ] Chunk markdown on heading and paragraph boundaries with a bounded size and small overlap,
      preserving heading breadcrumbs so a passage carries its own context.
- [ ] Rank at passage level, then aggregate to a document score (best passage + saturating bonus
      for multiple hits) so multi-mention documents rank above single-mention ones.
- [ ] Return the best-matching passages as the context packet content instead of a radius snippet.
- [ ] Keep transcript timestamp markers (`<!-- t:… -->`) attached to passages so a cited answer can
      deep-link into the transcript at the right moment.
- [ ] Extend fixtures with passage-level expectations; confirm Phase 2 metrics improve.

## Phase 4 — BM25 ranking and a persisted lexical index

**Depends on:** Phase 2 (hard — BM25 parameter tuning is meaningless without metrics); Phase 3
(soft — index passages once, rather than indexing documents then re-indexing passages later).
**Your input:** 🟡 **one decision.** Where the index lives and how it is triggered — a `lab index
build` you run manually, a step folded into ingestion, or a `/crons` recipe. This is an operational
preference about your workflow, not a technical constraint.

**Why:** current scoring adds a flat constant per matching term. It has no notion of term rarity
(`LLAAB` and `agent` score identically), no document-length normalization (long transcripts win by
volume), and no term saturation (ten mentions of one word beat one mention each of three). It also
rescans and re-parses the corpus on every query.

- [ ] Replace additive constants with BM25: IDF weighting, term saturation (`k1`), and length
      normalization (`b`), with field boosts preserving title > tag > body.
- [ ] Support quoted phrase matching and negation, and prefix matching for partial terms.
- [ ] Build a persisted inverted index (`~/.llaab/retrieval-index/`) via a one-shot
      `lab index build`, wrapped in a durable `RunNode`.
- [ ] Detect staleness by file mtime plus content hash; support incremental rebuild of changed
      files only.
- [ ] Fall back to the live scan when the index is missing or stale, and surface index age in
      `/vault/search` and `chat.context`.
- [ ] Confirm Phase 2 metrics improve and query latency drops on the full corpus.

## Phase 5 — Hybrid retrieval with embeddings

**Depends on:** Phase 2 (hard — this is the gate), Phase 3 (hard — embed passages, not documents),
Phase 4 (hard — fusion needs a strong lexical list to fuse with).
**Your input:** 🔴 **required, and this is the big one.** Whether to spend on embeddings at all,
and if so whether the embedding model stays local (free, offline, weaker) or goes cloud (better
recall, per-query cost, sends vault content off-machine). That last point is a privacy decision
about your own captures and is explicitly yours to make, not mine.

**Gate:** only start once Phase 2 fixtures contain repeatable misses matching the failure classes
named in the Phase 0 decision gate — paraphrase misses, conceptually-related evidence outranked by
unrelated exact matches, or evidence buried in long bodies.

- [ ] Add an embedding boundary to `@llaab/llm` alongside `routeLlm` / `streamLlm`, routed like any
      other task so the provider stays swappable.
- [ ] Prefer a local embedding model (LM Studio / Ollama) so retrieval keeps working offline and
      incurs no per-query cost.
- [ ] Embed at passage granularity from Phase 3; persist vectors beside the Phase 4 index with the
      same one-shot build and staleness rules.
- [ ] Fuse lexical and semantic candidate lists with Reciprocal Rank Fusion rather than tuning a
      score-blend weight.
- [ ] Implement as a ranking adapter behind `VaultSearchQuery` / `VaultSearchResult` — no consumer
      changes, and a config flag to disable it entirely.
- [ ] Prove the improvement against Phase 2 baselines; if RRF does not beat BM25 alone, keep BM25
      and record the negative result.

## Phase 6 — Query understanding

**Depends on:** Phase 2 (hard — every step here can make a good query worse; only fixtures catch it).
**Your input:** 🟡 **light but valuable.** The synonym map is generated from `LLAAB_GLOSSARY.md`
and the tag taxonomy, but your personal shorthand is not written down anywhere — the terms you type
versus the terms the corpus uses. Easiest captured from real `chat.ask` misses rather than asked
for up front.

**Why:** the operator asks questions in their own shorthand. The corpus uses the project's
vocabulary. `LLAAB_GLOSSARY.md` and the tag taxonomy already encode that mapping and are unused by
retrieval.

- [ ] Build a deterministic synonym and acronym map from `LLAAB_GLOSSARY.md` and the tag taxonomy;
      expand query terms before ranking.
- [ ] Decompose compound questions ("how does X compare to Y") into sub-queries, retrieve per
      sub-query, and merge — a single embedding of a two-part question retrieves neither part well.
- [ ] Add optional LLM query rewriting for vague questions, cached, with the raw query always
      retained as a fallback candidate list.
- [ ] Detect and route metadata-shaped questions ("what did I ingest last week") to structured
      `listNodes` filters instead of full-text ranking.
- [ ] Every step must be individually disableable and must never make a good query worse — enforce
      via Phase 2 fixtures.

## Phase 7 — Reranking

**Depends on:** Phase 2 (hard — precision gain must be measured against its latency cost), Phase 3
(soft — reranking passages beats reranking whole documents).
**Your input:** 🟡 **one tradeoff.** Your acceptable latency budget for an answer. Reranking buys
precision with seconds, and only you know how long you will tolerate waiting at the terminal.

**Why:** ranking is cheap and shallow; reranking is expensive and precise. Applying the expensive
step to only the top candidates gets most of the precision for a small fraction of the cost.

- [ ] Rerank the top ~30 candidates down to the final context set using a cheap-tier model scoring
      passage-vs-question relevance.
- [ ] Cache rerank scores keyed by question and passage hash.
- [ ] Enforce a latency budget with automatic bypass — chat must stay responsive.
- [ ] Keep reranking off by default for `/vault/search` (browsing wants speed and stable ordering)
      and on for `chat.ask` (answering wants precision).
- [ ] Measure precision gain against Phase 2 and record the latency cost.

## Phase 8 — Grounded answers and citation contract

**Depends on:** nothing — **fully independent of all ranking work, and startable now.** This is the
best candidate to run in parallel with Phases 2–4.
**Your input:** 🟡 **one preference.** How strict refusal should be. A system that refuses when
evidence is weak is trustworthy but terse; one that always attempts an answer is useful but
occasionally confident and wrong. That calibration is a matter of taste and easiest judged from
real answers.

**Why:** the model already emits `[K1]`-style markers spontaneously, but nothing validates them. An
unverified citation is worse than none because it looks trustworthy.

- [ ] Make citation markers contractual: every claim-bearing sentence carries a marker resolving to
      a supplied context packet.
- [ ] Validate markers server-side before emitting `chat.sources`; strip or flag hallucinated ids.
- [ ] Render citations in the Terminal as inline links to the exact passage, not just the document.
- [ ] Report which supplied sources were actually cited so unused context can be trimmed.
- [ ] Add an optional groundedness check — a second cheap pass verifying each claim against its
      cited passage, surfaced as a confidence signal.
- [ ] Calibrate refusal: distinguish "no local evidence" from "weak local evidence" from "grounded",
      and make `Outside the vault:` fire on evidence strength rather than model discretion.

## Phase 9 — Graph-aware context expansion

**Depends on:** Phase 2 (hard — expansion adds noise as easily as signal), Phase 3 (soft — expand
to passages rather than whole neighbours).
**Your input:** 🟢 **none.** Hop count and score discount are fixture-tuned.

**Why:** LLAAB already has a knowledge graph — wiki links, shared tags, and canonical-idea →
transcript provenance edges — and retrieval ignores it. The neighbour of a strong hit is often the
actual answer.

- [ ] Expand the candidate set along wiki links and shared tags from the top hits, at a discounted
      score and a bounded hop count.
- [ ] Follow provenance edges so a canonical idea can pull in its supporting transcript passages,
      and a wiki can pull in the ideas it was compiled from.
- [ ] Prefer the canonical artifact when a wiki and its source transcript both match, and cite the
      transcript as supporting evidence rather than duplicating both into context.
- [ ] Reuse `knowledge-wiki-graph.utils.ts` rather than building a second graph representation.

## Phase 10 — Durable chat sessions

**Depends on:** nothing technically — but see below.
**Your input:** 🔴 **required before implementation.** Two decisions that are yours: whether chat
threads become durable vault nodes at all (they are conversations _about_ your knowledge, not
knowledge itself — persisting them grows the vault with material that may never be worth keeping),
and if so whether they are a new `ChatNode` type or turns attached to a `RunNode`. That choice
affects the taxonomy, so it should not be made by default.

**Why:** chat memory is currently an in-process `Map` that dies with the server, is invisible to
every other surface, and violates the spirit of the process-state rule for anything worth keeping.

- [ ] Decide the durable shape — a `ChatNode` thread with turns, or turns attached to a `RunNode`.
- [ ] Persist question, answer, retrieved source ids, scope, model, and token/latency cost per turn.
- [ ] Make threads resumable and addressable so terminal, MCP, and Hermes/Telegram can continue the
      same conversation.
- [ ] Summarize or window long threads so history does not crowd out retrieved context.
- [ ] Keep an explicit ephemeral mode — not every question deserves a durable record.

## Phase 11 — Agentic retrieval loop

**Depends on:** Phase 10 (soft — traces need somewhere durable to live), Phases 3–4 (soft — an
iterative loop over weak ranking just compounds the weakness).
**Your input:** 🟡 **one budget.** The hard cap on iterations and total tokens per question. This
is a cost ceiling, and it is your money and your patience.

**Why:** one-shot retrieval answers one-shot questions. Real questions often need a first search to
discover the right vocabulary, then a second search to find the answer.

- [ ] Expose retrieval to the model as callable tools (`search`, `read`, `expand`) inside a bounded
      loop with a hard cap on iterations and total tokens.
- [ ] Let the model issue follow-up searches, read a specific node in full, and expand along graph
      edges before answering.
- [ ] Stream each retrieval step to the Terminal as a visible reasoning trace, not a black box.
- [ ] Persist the trace on the durable turn from Phase 10 so a bad answer can be diagnosed.
- [ ] Keep single-shot mode as the default; agentic mode is opt-in per question.

## Phase 12 — Chat UI surface

**Depends on:** Phase 10 (hard — a thread list needs durable threads), Phase 8 (soft — source cards
are much better with validated citations).
**Your input:** 🔴 **required.** This is a design surface, and your UI preferences are specific and
well-established. Layout, source-card density, and whether `/chat` replaces or complements the
Terminal as the primary asking surface are all yours to direct.

- [ ] A `/chat` route with threaded conversation, per-turn source cards, and scope controls.
- [ ] Source cards showing tier, score, matched passage, and a link to the node or wiki.
- [ ] Thread list backed by Phase 10 durable sessions with search across past conversations.
- [ ] Inline actions on a good answer — promote to a `knowledge/` draft, capture as an idea.
- [ ] Follows `PageLayout` / `PageHero` and the `Row`/`Col` grid rules; shadcn primitives only.

## Phase 13 — Feedback loop

**Depends on:** Phase 2 (hard — feedback has nowhere to go without a fixture format), Phase 12
(soft — Terminal-only feedback works, but a UI makes it a one-click habit).
**Your input:** 🟡 **ongoing, by design.** This phase _is_ your input, operationalised — it is the
mechanism by which your judgement about wrong answers becomes ranking improvement without you
having to write fixtures by hand.

**Why:** this is what makes the system compound. Without it, Phase 2 fixtures are written once and
go stale; with it, every bad answer permanently improves ranking.

- [ ] Per-answer feedback in Terminal and `/chat` — wrong answer, missing source, irrelevant source.
- [ ] Convert a flagged turn into a Phase 2 fixture with one action, capturing the question and the
      node that _should_ have ranked.
- [ ] Track which corrections a ranking change fixes or breaks.
- [ ] Surface recurring misses that share a failure class as evidence for the next phase.

## Phase 14 — Retrieval observability

**Depends on:** whichever retrieval stages exist — it instruments them, so it is worth most after
Phases 4–7 and is partially buildable at any point.
**Your input:** 🟢 **none.**

- [ ] Record a retrieval trace per query — candidates per strategy, fusion, rerank movement, final
      context, and per-stage latency.
- [ ] Expose the trace behind a `--explain` flag on `chat.ask` and a detail view on `/vault/search`.
- [ ] Track token cost per answer by stage so expensive phases can be justified or disabled.
- [ ] Add index freshness and corpus size to the existing status surfaces.

---

## Progress

- [x] Phase 0 — deterministic retrieval contract (2026-07-28)
- [x] Phase 1 — `chat.ask` conversational surface (2026-07-28)
- [x] Phase 2 — retrieval evaluation harness (2026-07-28) — draft fixtures await your review
- [ ] Phase 3 — passage-level retrieval
- [ ] Phase 4 — BM25 ranking and persisted lexical index
- [ ] Phase 5 — hybrid retrieval with embeddings
- [ ] Phase 6 — query understanding
- [ ] Phase 7 — reranking
- [ ] Phase 8 — grounded answers and citation contract
- [ ] Phase 9 — graph-aware context expansion
- [ ] Phase 10 — durable chat sessions
- [ ] Phase 11 — agentic retrieval loop
- [ ] Phase 12 — chat UI surface
- [ ] Phase 13 — feedback loop
- [ ] Phase 14 — retrieval observability

## Suggested Sequencing

Phases are ordered by dependency, not by required execution order. Practical grouping:

| Group          | Phases        | Rationale                                                         |
| -------------- | ------------- | ----------------------------------------------------------------- |
| Measure        | 2             | Small, no UI, gates every ranking change that follows.            |
| Cheap wins     | 3, 4          | Largest quality gain per unit of work; still fully deterministic. |
| Answer quality | 8             | Independent of ranking work; can run in parallel with 3–4.        |
| Semantics      | 5, 6, 7       | Only once 2 proves the need and 3 provides the right granularity. |
| Power surfaces | 9, 10, 11, 12 | Depend on a stable retrieval core being in place.                 |
| Compounding    | 13, 14        | Most valuable after real usage has produced real misses.          |

Phase 2 should be pulled forward regardless of what else is active — it is a few hours of work and
everything after it is guesswork without it.

## Non-Goals (this plan)

- No external web retrieval or live source refresh at query time.
- No vector database service; if Phase 5 proceeds, vectors are local files.
- No background indexing, watchers, or scheduler under any phase.
- No automatic promotion of retrieved vault content into `knowledge/`.
- No multi-user or shared-session chat.

## References

- [`DONE_SEARCH_RETRIEVAL_FOUNDATION.md`](./DONE_SEARCH_RETRIEVAL_FOUNDATION.md) — Phase 0 detail
  and the embedding decision gate this plan operationalises.
- [`ROADMAP.md`](./ROADMAP.md) — initiative priority and delivered history.
- [`docs/ARCHITECTURAL_PRIORITIES.md`](../ARCHITECTURAL_PRIORITIES.md) §3 — retrieval and context
  assembly rationale.
- [`docs/process/VAULT_KNOWLEDGE_REPOS.md`](../process/VAULT_KNOWLEDGE_REPOS.md) — why `knowledge/`
  outranks `vault/`.
- `.github/instructions/project/agent-execution.instructions.md` — one-shot processor rule.
- `.github/instructions/project/process-state-architecture.instructions.md` — durable `RunNode` rule.
