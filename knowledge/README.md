# Knowledge

`knowledge/` stores promoted, stable LLAAB artifacts that should travel with the parent source repo.

Use this folder for reviewed material that has crossed the boundary from working vault data into
committed project knowledge. Raw captures, transcripts, run nodes, extraction output, and temporary
canonical candidates stay in `vault/`, which is tracked by the separate vault data repo.

Promotion is manual for now:

1. Start from a source artifact in the working vault.
2. Review and consolidate it into a stable artifact.
3. Preserve enough provenance to find the originating vault node or source again.
4. Commit the promoted artifact in the parent LLAAB repo.

Canonical-idea nodes are expected to be the main ingredients for many wiki pages and knowledge-graph
summaries. They still live in the working vault until they are reviewed, rewritten if needed, and
committed here as promoted artifacts.

Subfolders:

- `wikis/` — durable topic pages and curated project memory.
- `knowledge-graphs/` — reviewed graph summaries or exports.
- `skills/` — canonical skill specifications.
- `agents/` — durable agent profiles and operating notes.
- `references/` — curated external reference summaries.
- `prompts/` — durable prompt specs and reusable prompt patterns.
- `decisions/` — stable architecture and product decisions.
