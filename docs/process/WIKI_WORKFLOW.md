# Wiki Workflow

This is the operator and architecture reference for LLAAB wiki generation.

Wikis are source-backed topic pages published into `knowledge/wikis/`. They are compiled
from canonical ideas, not directly from full vault context, and every write path preserves the
vault/knowledge repository boundary.

## Mental model

```text
transcript
  -> extracted IdeaNode candidates
  -> consolidated CanonicalIdeaNode ingredients
  -> focused evidence packet
  -> internal wiki-draft audit node in vault/
  -> automatic topic resolution and promotion
  -> knowledge/wikis/<wiki-id>.md in the parent repo
  -> derived graph/export in knowledge/knowledge-graphs/
```

The important boundary:

- `vault/` stores working data: transcripts, ideas, canonical ideas, wiki drafts, discovery
  candidates, research requests/results, and `RunNode` traces.
- `knowledge/` stores promoted knowledge that travels with the parent source repo.
- Promotion writes Markdown only; it never stages, commits, pushes, or mutates Git history.

## Core concepts

| Concept        | Storage                             | Purpose                                                                  |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Candidate idea | `vault/nodes/ideas/`                | Raw extracted detail from a transcript run.                              |
| Canonical idea | `vault/nodes/canonical-ideas/`      | Deduplicated source ingredient selected for one or more wiki topics.     |
| Wiki draft     | `vault/nodes/wiki-drafts/`          | Internal create/update/no-op/needs-review audit and regeneration source. |
| Knowledge wiki | `knowledge/wikis/<id>.md`           | Promoted topic page and source of truth for wiki content.                |
| Wiki graph     | Derived from `knowledge/wikis/*.md` | Disposable relationship view; can be rebuilt/exported from Markdown.     |

Canonical ideas remain vault data. The transcript composer promotes their compiled wiki pages in the
same request while retaining the draft and RunNode as private provenance.

## Operator path

1. Open a transcript with consolidated canonical ideas at `/vault/transcripts/:id`.
2. Select canonical ideas in the wiki composer.
3. Click **Create Wiki** once. The server groups broad selections into focused topics, compiles each
   topic, retains its vault draft, resolves new-topic ambiguity deterministically, and writes the
   promoted page.
4. The client opens the first promoted page and links every sibling page created by the request.
5. Review the prominent quality, lifecycle, verification, revision, source, topic, and relationship
   metadata on the promoted page.
6. Regenerate or remove individual sections directly on the promoted page. Each accepted change writes
   a new revision; the vault draft history remains intact.
7. Inspect the parent worktree and commit `knowledge/` changes only when ready.

The older draft-review routes remain available for audit and specialist recovery flows, but normal
transcript-to-wiki creation has no intermediate promotion step. Promotion still never runs Git commands.

## Review surface design rule

Wiki review state must be visually explicit rather than encoded in a muted metadata sentence:

- show quality, lifecycle, verification, revision, source counts, provider, and model in labeled cards
- use color-coded badges for score/state and visible topic badges for every persisted tag
- render Markdown as readable article HTML; never expose raw section markers in the primary reader
- keep section actions adjacent to the section they affect, with icon labels/tooltips and destructive
  confirmation
- show all pages created by a multi-topic request and all explicit or inferred related-topic links

## Compile and update behavior

`wiki-compile` is a one-shot skill routed through the normal LLM router and durable run lifecycle.
The compiler receives a bounded evidence packet:

- selected canonical idea ids
- supporting candidate/transcript/source evidence
- source locators from transcript timestamp markers where available
- existing target wiki metadata for updates
- related promoted wikis for link validation

It does not receive a full vault dump or write to `knowledge/` directly.

Draft operations:

- `create` — proposed new wiki page.
- `update` — proposed section-level change against an existing wiki.
- `no-op` — selected evidence is already represented or below the meaningful-change threshold.
- `needs-review` — an internal compiler result recording topic ambiguity or quality concerns. The normal
  transcript composer publishes it under a collision-safe distinct topic id and exposes the concerns in
  the promoted review surface.

Update drafts carry `base_revision` and `base_content_hash`. Promotion rejects stale drafts if the
promoted page changed after draft creation, so manual edits to wiki Markdown are first-class and must
survive later compiler runs.

## Evidence and citations

Every meaningful section is tied to `source_refs`.

Source-ref kinds:

- `canonical-idea` — the durable concept ingredient.
- `transcript` — source-backed transcript evidence with optional timestamp locator.
- `source` — originating channel/person/repo/source node.
- `external` — manually approved research result with URL, query/provider, retrieval time, excerpt,
  and validation notes.

Transcript evidence is source-backed; it does not prove objective truth. External research is explicit,
budgeted, approval-gated, and review-blocking when non-authoritative or contradictory.

## Discovery and research

Discovery is separate from compilation.

- `wiki-discover` deterministically clusters canonical ideas into bounded candidate topics.
- Optional model review may validate the deterministic candidates, but it cannot expand authority beyond
  represented evidence.
- Discovery writes reviewable vault candidates only.
- Compiling a candidate still creates a normal wiki draft.

Research is also explicit:

- `research-wiki` accepts an approved manual result packet for an existing wiki or draft.
- It records retrieval metadata and external source refs.
- It can create a research-backed draft, but it cannot bypass review or promotion.

LLAAB does not schedule discovery or research itself. External cron/launchd may call one-shot endpoints.

```sh
curl -fsS -X POST http://127.0.0.1:8888/api/vault/wiki-candidates/discover \
  -H "X-API-Key: $LLAAB_API_KEY"
```

## Promoted wiki files

Promoted wiki Markdown under `knowledge/wikis/` is the content source of truth.

The Markdown codec preserves:

- wiki id, topic key, lifecycle status, verification status, quality, generation metadata, revision,
  aliases, domain tags, and semantic topic tags
- source refs and source canonical idea ids
- stable section markers such as `<!-- wiki-section:overview -->`
- validated wiki links and relation vocabulary
- manual sections/edits across later update drafts

The core wiki helpers read/write through explicit knowledge roots, lock concurrent writes per wiki id,
hash rendered content for stale-draft checks, and keep vault nodes separate from promoted files.

## Graph and links

Wiki links use a fixed relation vocabulary:

- `related-to`
- `depends-on`
- `extends`
- `contrasts-with`
- `example-of`
- `supports`
- `supersedes`

Draft review and promotion reject unresolved links, self-links, duplicate links, and domain-tag-only
links. The graph combines explicit model-proposed links with deterministic `related-to` edges inferred
from shared semantic tags, multiple shared domain tags, or a shared source transcript. It is request-built
from promoted Markdown and is disposable:

- `/api/knowledge/wikis/graph` returns the current derived graph.
- `/api/knowledge/wikis/graph/export` writes a reproducible export under
  `knowledge/knowledge-graphs/`.

There is no watcher, background index, or external graph database in the current architecture.

## Browser surfaces

| Route                        | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `/vault/transcripts/:id`     | Select canonical ideas and create/publish focused wikis once.      |
| `/vault/wiki-drafts/:id`     | Inspect the retained internal audit draft or recover manually.     |
| `/vault/wiki-candidates`     | Review discovered candidate topics.                                |
| `/vault/wiki-candidates/:id` | Inspect candidate evidence and compile it into a draft.            |
| `/knowledge/wikis`           | Browse promoted wiki pages.                                        |
| `/knowledge/wikis/:id`       | Review rendered content, status, tags, links, and refine sections. |

## API surfaces

Vault/review endpoints:

- `POST /api/vault/transcripts/:id/wiki-drafts`
- `GET /api/vault/wiki-drafts`
- `GET /api/vault/wiki-drafts/:id`
- `PATCH /api/vault/wiki-drafts/:id`
- `POST /api/vault/wiki-drafts/:id/promote`
- `POST /api/vault/wiki-drafts/:id/reject`
- `POST /api/vault/wiki-drafts/:id/resolve`
- `POST /api/vault/wiki-drafts/:id/regenerate`
- `POST /api/vault/wiki-candidates/discover`
- `GET /api/vault/wiki-candidates`
- `GET /api/vault/wiki-candidates/:id`
- `POST /api/vault/wiki-candidates/:id/compile`
- `POST /api/vault/wiki-research`

Knowledge endpoints:

- `GET /api/knowledge/wikis`
- `GET /api/knowledge/wikis/:id`
- `POST /api/knowledge/wikis/:id/sections/:sectionId/regenerate`
- `DELETE /api/knowledge/wikis/:id/sections/:sectionId`
- `GET /api/knowledge/wikis/graph`
- `POST /api/knowledge/wikis/graph/export`

## Implementation map

| Layer            | Main responsibility                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `@llaab/schemas` | Wiki draft node, compile/result contracts, source refs, links, lifecycle/verification states. |
| `@llaab/core`    | Knowledge root helpers, wiki Markdown codec, hashing, link validation, graph build/export.    |
| `@llaab/llm`     | `wiki-compile`, `wiki-discover`, and `research-wiki` task routing.                            |
| `@llaab/skills`  | One-shot `compileWikiDraft`, discovery, evidence selection, research draft creation.          |
| `apps/server`    | Thin Hono routes, review decisions, promotion coordination, stale/dedupe validation.          |
| `apps/client`    | Composer, draft review UI, candidate review UI, promoted wiki browser and graph links.        |

## Extension rules

- Keep route handlers thin; put policy and transformation logic in purpose-named services/utils.
- Do not put implementation logic in `index.ts`.
- Do not add background workers, file watchers, polling loops, or scheduler ownership.
- Do not let models write directly to `knowledge/`.
- Do not add automatic Git commands to draft creation, promotion, discovery, graph export, or research.
- Treat promoted Markdown as authoritative; rebuild derived search/graph data from files.
- Preserve manual wiki edits through section ids, base hashes, and reviewed deltas.
- Use temporary `LLAAB_VAULT` and `LLAAB_KNOWLEDGE` roots in tests.
