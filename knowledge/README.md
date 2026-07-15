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
summaries. They still live in the working vault until they are compiled into a `wiki-draft`, reviewed,
explicitly promoted, and committed here as a promoted artifact.

Wiki pages are promoted manually:

1. Select canonical ideas from the vault and compile a `wiki-draft`.
2. Review source refs, warnings, proposed links, and update diffs.
3. Promote only after review; promotion writes `knowledge/wikis/<id>.md` but never runs Git commands.
4. Commit promoted wiki and graph changes from the parent repo when ready.

The wiki graph is derived from promoted Markdown. It can be rebuilt or exported under
`knowledge/knowledge-graphs/`, but `knowledge/wikis/*.md` remains the content source of truth.

Subfolders:

- `wikis/` — durable topic pages and curated project memory.
- `knowledge-graphs/` — reviewed graph summaries or exports.
- `skills/` — canonical skill specifications.
- `agents/` — durable agent profiles and operating notes.
- `references/` — curated external reference summaries.
- `prompts/` — durable prompt specs and reusable prompt patterns.
- `decisions/` — stable architecture and product decisions.
