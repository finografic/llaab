# Retrieval Evaluation

Measures whether ranking changes actually improve retrieval, instead of relying on a few hand-run
queries and a good feeling.

Phase 2 of [`TODO_KNOWLEDGE_RETRIEVAL_CHAT.md`](../../../../docs/todo/TODO_KNOWLEDGE_RETRIEVAL_CHAT.md).

## Two corpora, two jobs

| Corpus     | Backs                   | Why                                                                                                                   |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Frozen** | The CI regression guard | Fixed content, so any metric change is caused by a ranking change and nothing else. Safe to assert against in a test. |
| **Live**   | Manual measurement      | The real `knowledge/` + `vault/` corpus. Realistic, but grows with every ingest, so its metrics drift on their own.   |

A live baseline would fail for reasons unrelated to ranking, so only the frozen corpus has a
recorded baseline and a test guard.

## Running it

```bash
lab retrieval eval                                  # live corpus, informational
lab retrieval eval --frozen                         # frozen corpus, compared to baseline
lab retrieval eval --frozen --update-baseline       # lock in an improvement
lab retrieval eval --json --out report.json         # full report
```

`--frozen` exits non-zero when a metric falls below baseline.

## Metrics

| Metric          | Answers                                        | Watch it when                                                     |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| **recall@k**    | Did we find the right document at all?         | Evidence goes missing entirely.                                   |
| **precision@k** | How much of what we returned was noise?        | Context is being polluted with weak matches.                      |
| **MRR**         | How high was the first correct hit?            | Only a few results become model context, so the top matters most. |
| **nDCG@k**      | Was the _best_ document ranked above the rest? | A query has several acceptable answers of differing quality.      |

Recall alone is misleading: it cannot tell `[correct, junk, junk]` from `[junk, junk, correct]`.
MRR and nDCG can.

## What ranking metrics cannot see

Metrics score the **ordering of documents**. They are blind to whether the retrieved text actually
contains the answer. Phase 3 demonstrated this concretely: passage-level retrieval changed which
text reaches the model on every long document, and moved recall, MRR, and nDCG by exactly zero —
because both corpora were already at ceiling.

When a change affects context quality rather than document order, assert it directly. See the
`passage extraction on long documents` block in `retrieval-eval.utils.test.ts`.

## Adding a fixture

Do this whenever a real question retrieves the wrong thing. That is the whole point — a bad answer
should become a permanent regression test rather than a one-off fix.

1. Add the query to `fixtures/live-gold-set.json` (real corpus) or `fixtures/frozen-gold-set.json`
   (behaviour worth protecting in CI).
2. Set `relevant` to the tier-qualified references that _should_ rank —
   `knowledge:wikis/foo.md` or `vault:node-id`.
3. Write `notes` explaining **why** those are the right answers. This is the reviewable part; a
   fixture without a rationale cannot be checked by anyone else.
4. For the frozen set, add any documents the query needs to `fixtures/frozen-corpus.json`, then
   re-record with `--frozen --update-baseline`.

### Grades

`grades` assigns per-reference relevance weights for nDCG (default 1). Use it when one document is
the real answer and another is merely supporting:

```json
{ "grades": { "knowledge:wikis/agent-harness.md": 3, "vault:idea.harness-bounds": 1 } }
```

### Known misses

Set `known_miss: true` to record a failure the current ranking genuinely cannot satisfy. Known
misses are reported but **excluded from aggregates**, so a recorded failure cannot depress the
baseline and mask a real regression elsewhere.

Only use it for true ranking failures. If a document ranks correctly but the _snippet_ is wrong,
that is a context-assembly failure and ranking metrics cannot see it — assert it directly, as
`retrieval-eval.utils.test.ts` does for the long-transcript case.

## Rules for the baseline

- Never update the baseline to make a failing guard pass. A drop means ranking got worse.
- Do update it when a change genuinely improves ranking — that locks in the new floor.
- The baseline records corpus size; changing the frozen corpus without re-recording fails the guard
  deliberately.
