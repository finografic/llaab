# Wiki Workflow

This is the operator and architecture reference for LLAAB wiki generation.

Wikis are source-backed topic pages published into `knowledge/wikis/`. They are compiled
from canonical ideas, not directly from full vault context, and every write path preserves the
vault/knowledge repository boundary.

## Mental model

```text
transcript + selected CanonicalIdeaNode ingredients
  -> [Create Wiki(s)]  (one visible action)
  -> internal discover / validate / compile / link / auto-promote
  -> one or more promoted knowledge/wikis/<wiki-id>.md pages
  -> derived graph/export in knowledge/knowledge-graphs/
```

Internal vault artifacts (`wiki-draft`, optional `wiki-candidate`, `RunNode` traces) remain for
provenance, regeneration, and diagnostic recovery. They are not required user workflow stages.

The important boundary:

- `vault/` stores working data: transcripts, ideas, canonical ideas, wiki drafts, discovery
  candidates, research requests/results, and `RunNode` traces.
- `knowledge/` stores promoted knowledge that travels with the parent source repo.
- Promotion writes Markdown only; it never stages, commits, pushes, or mutates Git history.

## Core concepts

| Concept        | Storage                             | Purpose                                                              |
| -------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Candidate idea | `vault/nodes/ideas/`                | Raw extracted detail from a transcript run.                          |
| Canonical idea | `vault/nodes/canonical-ideas/`      | Deduplicated source ingredient selected for one or more wiki topics. |
| Wiki draft     | `vault/nodes/wiki-drafts/`          | Internal create/update/no-op audit and regeneration source.          |
| Knowledge wiki | `knowledge/wikis/<id>.md`           | Promoted topic page and source of truth for wiki content.            |
| Wiki graph     | Derived from `knowledge/wikis/*.md` | Disposable relationship view; can be rebuilt/exported from Markdown. |

## Operator path

1. Open a transcript with consolidated canonical ideas at `/vault/transcripts/:id`.
2. Optionally narrow the selected canonical ideas in the wiki composer.
3. Click **Create Wiki(s)** once. The server discovers coherent topics, compiles each from a bounded
   evidence packet, resolves typed links after identities are known, and auto-promotes valid
   creates/updates under one parent `compile-transcript-wikis` run.
4. The client opens the first promoted page and links every sibling page created by the request.
   Success copy reports created / updated / already represented / skipped / failed counts — not draft
   ids.
5. Review quality, lifecycle, verification, evidence metrics (refs vs independent sources), tags, and
   relationships on the promoted page.
6. Post-creation corrections (never required creation steps):
   - **Unpublish** — remove from canonical knowledge while retaining vault draft lineage.
   - **Delete** — remove the promoted file and scrub inbound wiki links.
   - **Regenerate / remove section** — revise one section in place when lineage allows; a wiki always
     keeps at least one sourced section.
7. Inspect the parent worktree and commit `knowledge/` changes only when ready.

Ambiguous, contested, stale, invalid, or low-quality branches skip or fail without inventing a
suffixed topic key and without asking the user to complete a draft/promotion workflow.

Diagnostic/recovery routes (`/vault/wiki-drafts/*`, `/vault/wiki-candidates/*`) remain available for
audit and specialist recovery. They are labeled as diagnostic and are not the normal creation path.

## Review surface design rule

Wiki review state must be visually explicit rather than encoded in a muted metadata sentence:

- show quality, lifecycle, verification, revision, evidence metrics, provider, and model in labeled cards
- never label citation-ref count as “sources” when refs share one transcript/channel
- keep lifecycle (`seed/growing/mature`) separate from verification and generation quality
- render Markdown as readable article HTML; never expose raw section markers in the primary reader
- keep section actions adjacent to the section they affect, with icon labels/tooltips and destructive
  confirmation
- show all pages created by a multi-topic request and all explicit or inferred related-topic links

## Internal pipeline stages

Under one parent RunNode (`compile-transcript-wikis`):

1. **discover** — cluster selected ideas into coherent topic proposals with primary/supporting roles.
2. **validate-proposals** — omit/skip unsafe or ambiguous branches; never invent `topic-2` keys.
3. **compile** — per-proposal `wiki-compile` with bounded evidence and quality dimensions.
4. **link** — `wiki-link` after all topic identities are known; reject domain-only / self links.
5. **auto-promote** — policy gates create/update/no-op; contested/low-quality branches do not mutate
   knowledge.

## Compile and update behavior

`wiki-compile` is a one-shot skill routed through the normal LLM router and durable run lifecycle.
The compiler receives a bounded evidence packet:

- selected canonical idea ids (primary/supporting roles when present)
- supporting candidate/transcript/source evidence
- source locators from transcript timestamp markers where available
- existing target wiki metadata for updates
- related promoted wikis for link validation

It does not receive a full vault dump or write to `knowledge/` directly.

Draft operations:

- `create` — proposed new wiki page.
- `update` — proposed section-level change against an existing wiki.
- `no-op` — selected evidence is already represented or below the meaningful-change threshold.
- `needs-review` — internal diagnostic only; auto-promotion skips these and never invents a distinct
  suffixed topic to bypass the gate.

Update drafts carry `base_revision` and `base_content_hash`. Promotion rejects stale drafts if the
promoted page changed after draft creation, so manual edits to wiki Markdown are first-class and must
survive later compiler runs.

## Evidence and citations

Every meaningful section is tied to `source_refs`.

Evidence metrics (Phase 1+) distinguish:

- evidence-reference count
- unique canonical ideas
- unique transcripts
- unique source nodes / author-channels
- independent-source count

Twelve timestamp refs in one transcript remain one independent source and typically `source-backed`.
`corroborated` requires claim-level independent support or a validated authoritative external.
`contested` requires explicit opposing evidence groups — low diversity alone is a warning, not a
contradiction.

## Discovery and research

Transcript **Create Wiki(s)** runs discovery internally as part of the one-step pipeline.

Standalone discovery (`POST /api/vault/wiki-candidates/discover`) remains a diagnostic one-shot that
writes vault candidates only. Compiling a candidate creates a normal wiki draft for recovery tooling;
it is not the preferred operator path.

Research is also explicit:

- `research-wiki` accepts an approved manual result packet for an existing wiki or draft.
- It records retrieval metadata and external source refs.
- It cannot bypass auto-promotion policy or invent contested corroboration.

LLAAB does not schedule discovery or research itself. External cron/launchd may call one-shot endpoints.

## Promoted wiki files

Promoted wiki Markdown under `knowledge/wikis/` is the content source of truth.

The Markdown codec preserves:

- wiki id, topic key, lifecycle status, verification status, quality, optional evidence metrics /
  quality dimensions, generation metadata, revision, aliases, domain tags, and semantic topic tags
- source refs and source canonical idea ids
- stable section markers such as `<!-- wiki-section:overview -->`
- validated wiki links and relation vocabulary
- manual sections/edits across later update drafts

Legacy pages without `evidence_metrics` remain readable; the UI derives conservative metrics from
`source_refs` without inventing author/channel diversity.

## Graph and links

Wiki links use a fixed relation vocabulary:

- `related-to`
- `depends-on`
- `extends`
- `contrasts-with`
- `example-of`
- `supports`
- `supersedes`

Link enrichment rejects unresolved links, self-links, duplicate links, and domain-tag-only notes.
The graph combines explicit model-proposed links with deterministic `related-to` edges inferred
from shared semantic tags, multiple shared domain tags, or a shared source transcript. It is
request-built from promoted Markdown and is disposable.

## Browser surfaces

| Route                        | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `/vault/transcripts/:id`     | **Normal path:** Create Wiki(s) from canonical ideas.            |
| `/knowledge/wikis`           | Browse promoted wiki pages.                                      |
| `/knowledge/wikis/:id`       | Review content; unpublish/delete; regenerate or remove sections. |
| `/vault/wiki-drafts/:id`     | Diagnostic/recovery audit draft (not a required creation step).  |
| `/vault/wiki-candidates`     | Diagnostic discovery queue (not the normal creation path).       |
| `/vault/wiki-candidates/:id` | Diagnostic candidate evidence / compile into a draft.            |

## API surfaces

Normal creation:

- `POST /api/vault/transcripts/:id/wiki-drafts` — one-step create (discover → compile → link → promote)

Diagnostic/recovery vault endpoints:

- `GET /api/vault/wiki-drafts`, `GET/PATCH /api/vault/wiki-drafts/:id`
- `POST /api/vault/wiki-drafts/:id/promote|reject|resolve|regenerate`
- `POST /api/vault/wiki-candidates/discover`
- `GET /api/vault/wiki-candidates`, `GET /api/vault/wiki-candidates/:id`
- `POST /api/vault/wiki-candidates/:id/compile`
- `POST /api/vault/wiki-research`

Knowledge endpoints:

- `GET /api/knowledge/wikis`, `GET /api/knowledge/wikis/:id`
- `POST /api/knowledge/wikis/:id/demote`
- `DELETE /api/knowledge/wikis/:id`
- `POST/DELETE /api/knowledge/wikis/:id/sections/:sectionId/*`
- `GET /api/knowledge/wikis/graph`, `POST /api/knowledge/wikis/graph/export`

## Implementation map

| Layer            | Main responsibility                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `@llaab/schemas` | Proposal/evidence/quality/verification/one-step contracts.                                 |
| `@llaab/core`    | Knowledge root helpers, wiki Markdown codec, hashing, link validation, graph build/export. |
| `@llaab/llm`     | `wiki-compile`, `wiki-discover`, `wiki-link`, and `research-wiki` task routing.            |
| `@llaab/skills`  | Discovery, compile, link, evidence selection, research draft creation.                     |
| `apps/server`    | Thin Hono routes; one-step orchestration; auto-promotion; demote/delete/section review.    |
| `apps/client`    | Create Wiki(s) composer; promoted wiki browser; diagnostic draft/candidate surfaces.       |

## Extension rules

- Keep route handlers thin; put policy and transformation logic in purpose-named services/utils.
- Do not put implementation logic in `index.ts`.
- Do not add background workers, file watchers, polling loops, or scheduler ownership.
- Do not let models write directly to `knowledge/`.
- Do not add automatic Git commands to draft creation, promotion, discovery, graph export, or research.
- Do not invent suffixed topic keys to bypass ambiguity.
- Treat promoted Markdown as authoritative; rebuild derived search/graph data from files.
