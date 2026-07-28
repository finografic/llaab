# TODO — Create retrieval fixtures via `chat.ask` (2–3 per week)

Short reference for building a useful `live-gold-set` from real Terminal / `chat.ask` misses.

Full technical detail: [`packages/core/src/retrieval/README.md`](packages/core/src/retrieval/README.md).

---

## The loop

1. Ask something via `chat.ask` (or `/terminal`).
2. It retrieves the wrong thing — or misses something you know is there.
3. Add that question as a fixture, with what should have ranked.
4. `lab retrieval eval` now measures it forever.

---

## Where

Prefer **live** fixtures against your actual vault:

`packages/core/src/retrieval/fixtures/live-gold-set.json`

```json
{
  "id": "short-kebab-id",
  "question": "What you actually typed",
  "scope": "all",
  "relevant": ["knowledge:wikis/agent-harness-harness-engineering.md"],
  "notes": "Why this is the right answer."
}
```

---

## Identifier trap — two tiers

| Tier         | Format                                                             | Example                                                                    |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `knowledge:` | Path relative to `knowledge/`, with `.md`                          | `knowledge:wikis/agent-harness-harness-engineering.md`                     |
| `vault:`     | Node id — frontmatter `id:` (filename minus type prefix and `.md`) | `vault:loop-structures-inside-the-harness-enable-long-running-agent-tasks` |

`chat.ask` sources already give you both: knowledge lines print the path; for vault, take the filename and strip `idea.` / `transcript.` and `.md`.

**Prefer `knowledge:` paths** when a knowledge doc is a legitimate answer — they are committed and won’t drift. Use `vault:` when the vault node truly is the answer (transcript, canonical idea with no wiki yet).

As you promote ideas into wikis, some fixtures may need refs updated from `vault:` → `knowledge:`. `lab retrieval eval` will show those as red `gap` lines — not a regression, just a moved target.

---

## Optional fields

| Field                       | When to use                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `grades`                    | One doc is the real answer, another merely supports it — e.g. `{"knowledge:wikis/a.md": 3, "vault:some-id": 1}`. Affects nDCG only. |
| `known_miss: true`          | Ranking genuinely cannot satisfy yet. Reported but excluded from aggregates so it can’t mask a real regression. Use sparingly.      |
| Multiple `relevant` entries | Fine when several docs legitimately answer.                                                                                         |

---

## Running the eval

```bash
lab retrieval eval          # live corpus
```

- `gap` in red → an expected doc didn’t rank
- `#3` → it ranked third

### Caveats

- Don’t touch `frozen-gold-set.json` unless you also add the document to `frozen-corpus.json` and re-record the baseline — that set backs the CI guard.
- The fixtures that help are the ones where **retrieval failed**. Fixtures written knowing the answers tend to all pass — and measure almost nothing.

If you’d rather not hand-write these: paste a question that gave a bad answer and have an agent add the fixture (including working out the refs).

---

## How many fixtures?

**~20–25 total** is enough within reason. Count matters less than mix.

Why ~20: aggregates are means, so one query moving swings everything by `1/n`.

| Fixtures  | MRR swing from one query (rank 1 → 3) |
| --------- | ------------------------------------- |
| 9 (early) | ~0.074                                |
| 20        | ~0.033                                |
| 30        | ~0.022                                |
| 50        | ~0.013                                |

Around **20**, per-query swing drops under ~3% — roughly where a genuine ranking change is distinguishable from jitter. That’s the practical threshold for Phase 4 to be evaluable.

IR convention (TREC) is ~50 topics for trusting small system differences. Overkill for a personal vault — you’re deciding whether BM25 / ranking changes help, not publishing a paper.

### Composition (what actually matters)

30 fixtures that all pass tell you nothing. Rough target:

- **~half from real failures** — questions where retrieval genuinely got it wrong. These are the only ones that can improve anything; the rest prevent regressions.
- **A few multi-answer** — so nDCG has something beyond binary hit/miss.
- **2–3 controls** — off-corpus questions (e.g. “What’s the capital of Portugal?”) guarding against context pollution.
- **The rest** — protecting behaviours you’d hate to lose (scope filtering, tag queries, stopword fix, etc.).

### Pace

Don’t sit down and write 20. Let them arrive naturally — **2–3 per week** of real usage gets you there in about a month, and they’ll be real misses rather than invented ones.

**Stop adding** when a new fixture passes on the first try without you having to think about it — that’s padding, not probing.

**Ceiling effect:** on a small corpus, most reasonable questions may keep ranking correctly no matter how the scorer is tuned. If fixtures stay saturated even after real misses are added, that can mean ranking is already fine for this corpus size — and the right move may be to skip further ranking phases rather than tune parameters nothing can measure.

---

## Plan of record

1. Grow the corpus first — many wikis can still be made from canonical ideas in `vault/`.
2. Then write **2–3 fixtures per week**, naturally, from real `chat.ask` / Terminal misses.

---

## Ask blind, label informed

| Step                    | Rule                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Query (`question`)**  | Write it **cold**, never with the corpus open. Contamination here kills the fixture. |
| **Answer (`relevant`)** | Reading is **mandatory**. You can’t label what should rank without looking.          |

**Order that works:**

1. Write the question cold, in whatever words you’d naturally use.
2. Run it and see what comes back.
3. Decide what should have ranked — labelling; reading everything is fine at this point.

You need the corpus to write `relevant`. You must **not** have it in your head when writing `question`.

**Warning while generating wikis:** right after reading/promoting, phrasing is maximally contaminated (“what’s the model-environment boundary” because you just saw those words). Keep a scratch file and dump questions as they occur during real work, **before** you go looking. Questions written weeks after you last read a doc are the most honest.

If nothing should have answered — that’s not a failed fixture. That’s a **corpus gap**, and it tells you which wiki to write next.

---

## Question types worth covering

Natural **queries**, not answers. Each type stresses a different mechanism.

| Type                   | Stresses                               | Example in this domain                                                     |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Definitional           | Title matching                         | “What is an agent harness?”                                                |
| Paraphrase gap         | Embedding case (Phase 5)               | “How do I stop my agent going off the rails?” → guardrails / context-reset |
| Applied / procedural   | Body over title                        | “Should I run sub-agents in separate containers?”                          |
| Comparative            | Multi-doc, decomposition (Phase 6)     | “Is tiering better than just using a cheaper model everywhere?”            |
| Buried detail          | Passage retrieval (Phase 3)            | “What was the token number for prompt bloat?” → ~25K                       |
| Episodic recall        | Transcript retrieval                   | “What did that video about writing loops actually argue?”                  |
| Cross-source synthesis | Multi-answer, nDCG                     | “What have I collected about agent isolation?”                             |
| Metadata-shaped        | Should route to filters, not full-text | “What did I ingest last week?”                                             |
| Underspecified         | Does it guess or hedge?                | “How should I structure this?”                                             |
| Off-corpus control     | Context pollution                      | “What’s the capital of Portugal?”                                          |

**Over-index on paraphrase gap** — describe the problem, not the concept (“My agent keeps forgetting what it was doing” rather than “context reset”). That’s the evidence Phase 5 needs.

**Buried detail** is the other high-value type — it tests whether passage retrieval helps on real transcripts, not only synthetic fixtures.
