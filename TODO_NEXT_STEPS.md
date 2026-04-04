# LLAAB — Next Steps

## What's Next (Claude)

The schemas and utilities are in place. Next milestones:

- **CLI commands** — wire `captureIdea`, `listNodes` into the `llaab` CLI
- **Ingestion pipeline** — `@llaab/ingestion` fetch → clean → structure → extract → store
- **LLM extraction** — run prompts against transcripts to produce idea/skill nodes
- **SQLite index** — build a queryable index over the vault for fast relational queries
- **Graph views** — visualize `LabNode` relationships in the web UI

## Recommended Next Step (GPT 5.4)

The natural next move is the schema usage layer:

1. Add `updateNode()` and `writeNode()` helpers so existing files can be safely edited after creation.
2. Persist `run` nodes from `packages/skills/src/runner.ts`.
3. Decide which extracted outputs should first become real nodes automatically: ideas, skills, or both.
