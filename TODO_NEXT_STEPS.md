# LLAAB — Next Steps

The project now has a solid enough foundation to stop debating structure and start tightening the loop:

```txt
capture -> structure -> execute -> observe -> refine
```

The schemas are in place.
Core node creation and reading are in place.
The first ingestion path exists.
The next step should now strengthen either:

1. the **reliability of the system as a lab**
2. the **usability of the system as a tool**

## Recommended Starting Point

### Option A — Complete the schema usage layer

This is my strongest recommendation.

Why:

- It makes the current architecture actually durable.
- It turns the new `run` and node schemas into working system behavior, not just types.
- It improves everything that comes after: CLI, ingestion, extraction, and future indexing.
- It creates the right foundation for adding a real control layer around LLM-backed flows.

Suggested order:

1. Add `writeNode()` and `updateNode()` helpers in `@llaab/core`.
2. Persist `run` nodes from `packages/skills/src/runner.ts`.
3. Add a lightweight control/orchestration boundary for LLM-backed flows.
4. Decide the first extraction target:
   - create `idea` nodes from transcripts
   - create `skill` nodes from transcripts
   - or create both, but only after choosing a cautious initial rule
5. Add a small “safe mutation” pattern for node edits:
   - read file
   - parse
   - validate
   - update
   - write back

Recommended sub-steps for `writeNode()`:

1. Define the responsibility clearly:
   - `createNode()` creates a new file
   - `writeNode()` writes a complete validated node to a known path
2. Reuse the current markdown serialization path from `create-node.utils.ts` so file output stays identical.
3. Accept a full `LabNode` input rather than partial fields.
4. Validate with `NodeSchema` before writing.
5. Ensure parent directories exist before write.
6. Keep write behavior explicit:
   - write to a provided path
   - do not silently invent a new location
7. Return the written node and path so callers can continue pipeline work cleanly.

Recommended sub-steps for `updateNode()`:

1. Read the existing file from disk.
2. Parse frontmatter and body.
3. Validate through `NodeSchema`.
4. Apply an updater callback or a controlled patch object.
5. Preserve stable fields unless intentionally changed:
   - `id`
   - `type`
   - original file location
6. Always refresh `updatedAt`.
7. Re-validate the final node before write.
8. Write back through `writeNode()`.
9. Return the updated typed node so ingestion, CLI, or skill flows can chain safely.

Recommended sub-steps for the lightweight control layer:

1. Define where LLM-backed decisions should be routed through a single control boundary.
2. Keep deterministic stages explicit and separate:
   - fetch
   - clean
   - structure
   - validate
   - store
3. Treat model output as a proposal, not as trusted state.
4. Add post-model checks before any node creation or mutation.
5. Add a simple decision model for failure handling:
   - accept
   - retry
   - downgrade
   - reject
6. Capture those decisions in run logs so the system stays inspectable.
7. Keep this first version small and local to ingestion/extraction rather than trying to design a grand orchestrator too early.

Why this is first:

- right now the repo can create nodes well, but it cannot yet comfortably evolve existing nodes
- execution exists conceptually, but run logging is not yet part of the vault
- extraction will be much easier to trust once updates and run records are first-class
- LLM usage will be safer once control and validation are explicit system concerns

### Readiness For YouTube Ingestion

This does not replace the priority order above.
It is the first feature target that the current foundational work should be preparing for.

Why this feature is a good early target:

- you already have a backlog of sources waiting to enter LLAAB
- it is concrete and motivating
- it touches several important layers at once:
  - fetch
  - clean
  - structure
  - extract
  - store
  - link
- it will teach the system how a real feature plugs into the rest of the lab

Recommended readiness steps before pushing deeper into the feature:

1. Finish `writeNode()`.
2. Finish `updateNode()`.
3. Add persistent `run` logging so ingestion attempts are inspectable.
4. Add the first lightweight control boundary around extraction and validation.
5. Decide how duplicate YouTube ingests should behave:
   - block duplicate transcript creation
   - merge/update existing transcript
   - create a new run while keeping one canonical transcript node
6. Decide the first stable source-linking rule:
   - always create or reuse one `source` node per channel
7. Decide the first transcript refinement rule:
   - metadata only
   - transcript + summary
   - transcript + extracted ideas
8. Add one simple CLI or script entry point for repeated use once the core helpers are ready.

Good first feature slice for YouTube ingestion:

1. ingest URL
2. fetch transcript
3. clean transcript
4. structure transcript
5. run extraction through the control boundary
6. create or reuse source node
7. create transcript node
8. log a run node

That is enough to make the feature real without overcommitting to extraction too early.

## Strong Alternate Starting Point

### Option B — Make the CLI genuinely useful

This is the best alternative if you want immediate day-to-day payoff.

Why:

- It gives you a practical surface for using the lab without touching source files directly.
- It will expose friction in the underlying APIs very quickly, which is often healthy.
- It creates momentum and makes the project feel real fast.

Suggested order:

1. Add CLI commands for:
   - `llaab idea`
   - `llaab list`
   - `llaab read`
2. Add filtering flags for `list`:
   - `--type`
   - `--status`
   - `--tag`
   - `--search`
3. Add a basic `llaab ingest youtube <url>` path.
4. Only then extend CLI coverage to editing or execution commands.

Why this is second:

- it is very useful
- but it is slightly downstream of the core mutation/run-logging work
- if done first, it may push you into adding edit flows before the write/update layer is ready

## Broader Roadmap After That

Once one of the two starting points above is complete, the next larger milestones make sense in roughly this order:

1. **LLM extraction**
   Turn transcripts into candidate idea/skill nodes.

2. **Execution loop**
   Improve skill execution records, results, and refinement feedback.

3. **CLI expansion**
   Add richer commands once the core APIs are stable.

4. **SQLite index**
   Build a queryable side index over the vault after the file model settles a bit more.

5. **Graph and views**
   Add relationship browsing and visual views once the node and execution flows are producing enough useful structure.

## My Practical Recommendation

If you want the best long-term move, start here:

1. `writeNode()`
2. `updateNode()`
3. persistent `run` node logging
4. lightweight control around LLM-backed flows
5. then use those to harden YouTube ingestion as the first real feature

If you want the most immediately satisfying move, start here:

1. `llaab idea`
2. `llaab list`
3. `llaab read`

## Short Version

- Best architectural next step: complete the schema usage layer.
- Best product-feeling next step: build the first real CLI commands.
- Best first feature after the core helpers are ready: YouTube ingestion.
- Best new architectural refinement to thread into that work: a lightweight control layer.
- If forced to choose only one, I would still choose the schema usage layer first.
