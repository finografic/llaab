# LLAAB — Glossary

> **LLAAB Ubiquitous Language (Critical)**
>
> The system must define and enforce a **shared vocabulary** between:
>
> - you (domain expert)
> - the LLM (executor)
> - agents reading this project
>
> **Without shared vocabulary:**
>
> - ambiguity increases
> - results degrade
> - systems drift
>
> **With shared vocabulary:**
>
> - precision increases
> - workflows stabilize
> - agents become reliable

---

This glossary is the canonical definition of LLAAB's shared vocabulary.

- `ubiquitous language` = the overall shared language discipline across dev, LLM, docs, prompts, schemas, and code
- `shared vocabulary` = the terms and distinctions that must stay stable across that system
- `glossary` = the canonical artifact that defines those terms

In plain terms: the system needs a shared vocabulary; this document is the glossary that defines it.

Terms marked with **[candidates]** were selected from the Ubiquitous Language Glossary Candidates doc — the ranked-choice reference for cross-package terminology decisions. When terms here align with that doc, the #1 candidate was adopted.

---

## node **[candidates: #1]**

**A `node` is one typed unit of knowledge stored in the lab.**

In LLAAB terms, a node is the basic content object of the system. It is not just a markdown file, and it is not just frontmatter. It is the combination of content plus a validated type and shape.

A node usually answers questions like:

- what kind of thing this is
- what it is called
- how it relates to other things
- what state it is in
- what content it carries

Why it matters here:

- nodes are the primary building blocks of the lab
- schemas exist mainly to define node shapes
- ingestion, execution, and refinement all create or evolve nodes

A simple mental model is:

```
node = one knowledge object in the lab
file = how that node is stored on disk
schema = how that node is validated
```

Currently supported node types: `TranscriptNode`, `IdeaNode`, `SkillNode`, `SourceNode`, `RunNode`, `ResourceNode`, `PromptNode`, `InstructionNode`, `DecisionNode`.

Right now in the repo:

- [`packages/schemas/src/base-node.schema.ts`] defines the shared node fields
- [`packages/schemas/src/node.schema.ts`] defines the full union of supported node types

---

## status

**`status` is the lifecycle stage of a node — how far it has matured from initial capture to stable, usable knowledge.**

The status vocabulary was selected from the Ubiquitous Language Glossary Candidates doc. The four stages form a deliberate organic metaphor:

| Status     | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `seed`     | Initial, unprocessed capture — raw potential, not yet refined |
| `growing`  | Actively being developed or refined — work in progress        |
| `mature`   | Stable, validated, ready for use or execution                 |
| `archived` | Retired but preserved — not deleted, retrievable              |

Why this vocabulary matters:

- `seed → growing → mature` forms a natural arc that makes node state legible at a glance
- `archived` deliberately avoids `deprecated` (too semver-flavored) and `done` (implies no further evolution)
- agents reading node frontmatter can make routing decisions based on status without additional context

A simple mental model is:

```
seed     = captured but unexamined
growing  = being shaped
mature   = ready to use
archived = kept but no longer active
```

In the repo: the `status` field is defined in `packages/schemas/src/base-node.schema.ts` and is inherited by all node types.

---

## idea

**An `idea` is a distilled insight, observation, or hypothesis captured from a source or generated during a run.**

In LLAAB terms, an idea is not a raw note and not yet a skill. It is the intermediate form between ingested content and executable knowledge — the unit the LLM extracts from transcripts, and the unit a human curates before promoting to a skill.

Ideas answer questions like:

- what was the core insight from this source?
- what hypothesis is worth exploring?
- what problem was identified?

Why it matters here:

- ideas are the primary output of the extraction pipeline
- they are the main thing a user reviews and curates
- they are the natural precursor to a `skill`

The lineage trail is:

```
source content → transcript → [LLM extraction] → ideas → [human curation] → skills
```

Right now in the repo:

- [`packages/schemas/src/idea-node.schema.ts`] defines `IdeaNode`
- `origin` field distinguishes `manual`, `extracted`, and `generated` ideas
- `packages/skills/src/extract-transcript-ideas.ts` is the extraction skill that produces them

---

## link

**A `link` is a typed connection between two nodes.**

In LLAAB terms, links are how the vault becomes a graph rather than a flat list of files. They encode meaning — this idea came from that transcript, this skill was derived from this idea, this run produced these nodes.

Links appear in two forms:

- **Wikilinks** (`[[node-id]]`) in markdown body content — human-readable, Obsidian-compatible
- **Schema fields** (`related`, `source_id`, `extracted_idea_ids`, `produced_node_ids`) — machine-readable, Zod-validated

Why it matters here:

- links are what make provenance traceable
- they allow the vault to be traversed as a knowledge graph
- they are how LLAAB differs from a flat note-taking system

A simple mental model is:

```
node = vertex
link = edge
vault = graph
```

The key link types in the current schema:

| Field                | From → To                   |
| -------------------- | --------------------------- |
| `source_id`          | TranscriptNode → SourceNode |
| `related`            | IdeaNode → TranscriptNode   |
| `extracted_idea_ids` | TranscriptNode → IdeaNode[] |
| `produced_node_ids`  | RunNode → any node[]        |

---

## schema

**A `schema` is the typed contract that defines what a node or structure is allowed to contain.**

In LLAAB terms, schemas are where the ubiquitous language becomes executable. They turn concepts into enforceable shapes.

A schema usually answers questions like:

- what fields are required
- what values are valid
- what kind of object something is

Why it matters here:

- schemas prevent drift between intention and stored data
- schemas give the LLM and the code a shared contract
- schemas make files safer to read and write

A simple mental model is:

```
concept = idea in the language
schema = rulebook for that idea
node = one validated instance of it
```

Right now in the repo:

- [`packages/schemas/src/`] contains the modular `*.schema.ts` files
- [`packages/schemas/src/node.schema.ts`] is the main union entry point
- All schemas use Zod 4.x

---

## vault

**The `vault` is the file-based source of truth for the lab's knowledge objects.**

In LLAAB terms, the vault is where nodes live on disk. It is not a cache and not a hidden database. It is the inspectable, editable storage layer — a standard Obsidian vault directory.

The flow through the vault is strictly unidirectional:

```
raw/ → ingest → nodes/ → processing → wiki/
```

The `wiki/` layer is compiled from typed nodes; the vault is never the source of truth for wiki content — nodes are.

Why it matters here:

- it keeps the system local-first
- it preserves transparency — every node is a human-readable markdown file
- it allows direct inspection and git tracking
- it is the Obsidian vault root, meaning tools like Dataview and Tag Wrangler work over it

Key vault directories:

| Directory            | Contents                                               |
| -------------------- | ------------------------------------------------------ |
| `vault/nodes/`       | Typed knowledge nodes (ideas, skills, resources, etc.) |
| `vault/transcripts/` | Ingested transcript nodes                              |
| `vault/sources/`     | Source nodes (channels, people, repos)                 |
| `vault/runs/`        | Execution trace nodes                                  |
| `vault/raw/`         | Pre-ingestion raw input                                |
| `vault/wiki/`        | Compiled wiki output (derived, not source)             |

---

## source **[candidates: #1]**

**A `source` is the origin of knowledge: the person, channel, repo, publication, or other entity content comes from.**

In LLAAB terms, a source is not the same thing as a resource. A source is where knowledge originates. A resource is a usable external thing the lab may refer to.

Why it matters here:

- it helps track provenance
- it helps group related content
- it supports follow-up ingestion and relationship building
- `SourceNode` has a `follow` flag for auto-re-ingestion of ongoing sources

A simple mental model is:

```
source     = who or what content comes from
resource   = a useful external thing
transcript = content derived from a source
```

Right now in the repo:

- [`packages/schemas/src/source-node.schema.ts`] defines `SourceNode`
- YouTube ingestion creates a `SourceNode` for the channel alongside the `TranscriptNode`

---

## resource

**A `resource` is an external thing the lab wants to remember, reference, or use.**

In LLAAB terms, a resource may be a tool, article, repo, library, dataset, or reference. It is not necessarily the origin of knowledge in the same way a source is.

A simple mental model is:

```
resource = useful external thing
source   = where knowledge originates
skill    = knowledge the lab can execute
```

Right now in the repo:

- [`packages/schemas/src/resource-node.schema.ts`] defines `ResourceNode`
- Article and repo ingestion currently lands as `ResourceNode`

---

## transcript

**A `transcript` is structured content captured from an external source, especially long-form spoken or written material.**

In LLAAB terms, a transcript is an intermediate but durable node: it preserves the source content in a form that can be read, summarized, linked, and later extracted into ideas or skills. It is not discarded after extraction.

Why it matters here:

- it is the key bridge between raw ingestion and structured knowledge
- it keeps source material inspectable
- it gives extraction a stable working surface — re-extraction can be triggered any time

The transcript's place in the pipeline:

```
source content → [yt-dlp fetch + SRT parse] → TranscriptNode → [LLM extraction] → IdeaNodes
```

Right now in the repo:

- [`packages/schemas/src/transcript-node.schema.ts`] defines `TranscriptNode`
- [`packages/ingestion/src/pipeline.ts`] is phase 1 — creates the `TranscriptNode`
- [`packages/ingestion/src/extract/llm-extract.ts`] is phase 2 — extracts ideas from it

---

## ingestion **[candidates: #1]**

**`Ingestion` is the process of taking external input and turning it into structured lab content.**

In LLAAB terms, ingestion is a two-phase pipeline, not a single function. Phase 1 always succeeds (no LLM). Phase 2 is best-effort (LLM extraction can be skipped or retried independently).

The two phases:

1. **Fetch + structure** — retrieve the content, parse and clean it, write the `TranscriptNode` and `SourceNode`. No LLM call. Always runs.
2. **Extract** — run LLM extraction over the transcript, write `IdeaNodes`, update the transcript's `extracted_idea_ids`. Best-effort, retriable.

This split means a network failure on step 2 never loses a saved transcript.

A simple mental model is:

```
input → fetch → clean → structure → [save transcript] → extract → [save ideas]
```

Right now in the repo:

- [`packages/ingestion/src/pipeline.ts`] — phase 1 entry point
- [`packages/ingestion/src/extract/llm-extract.ts`] — phase 2 entry point
- `skipExtraction: true` on the ingest endpoint makes step 1 return immediately

---

## extract **[candidates: #1]**

**`Extract` is the LLM-powered process of pulling structured knowledge out of unstructured content.**

In LLAAB terms, extraction is distinct from ingestion. Ingestion moves content _in_. Extraction pulls _structure out_. They are sequential but independently retriable.

Extraction answers questions like:

- what ideas are latent in this transcript?
- what is this content about?
- what is worth capturing as a node?

Why it matters here:

- extraction is where raw content becomes actionable knowledge
- it is the primary site of LLM call governance in the current pipeline
- the harness prep layer (`packages/ingestion/src/extract/harness-prep.ts`) sits here

A simple mental model is:

```
ingestion = content moves in
extraction = structure comes out
```

The distinction is important: extraction can be re-run on a saved transcript without re-ingesting. The transcript is the stable input surface.

---

## skill **[candidates: #1]**

**A `skill` is reusable, executable knowledge.**

In LLAAB terms, a skill is more than a note and less than a fully autonomous agent. It is a defined capability that can be run, combined, refined, and logged through runs.

Why it matters here:

- skills are where knowledge starts becoming action
- they are the bridge between ideas and automation
- they are the natural unit of execution in the agent loop

A simple mental model is:

```
idea  = possible capability
skill = defined capability
run   = one execution of that capability
```

Note on `skill` vs `tool`: In the MCP/LLM ecosystem, "tool" is the standard term for something an agent can call externally. "Skill" is internal executable knowledge that can evolve and has lineage. Both coexist in LLAAB: skills are the internal layer; MCP tools are the external interface.

Right now in the repo:

- [`packages/schemas/src/skill-node.schema.ts`] defines the `SkillNode` shape
- [`packages/skills/src/`] is the skill execution layer
- [`packages/cli/src/mcp/server.ts`] exposes vault capabilities as MCP tools

---

## run **[candidates: #1]**

**A `run` is one execution record: one time a skill, pipeline, or agent actually did something.**

In LLAAB terms, that matters because the lab is not just storing knowledge — it is also storing what happened when knowledge was used. A `skill` is the reusable capability; a `run` is the trace of one real attempt to use it.

A `run` schema answers questions like:

- what was executed
- when it started and finished
- whether it succeeded or failed
- what inputs it received and what nodes it created
- what model or tool was used
- what error happened, if any

Why it matters here:

- it makes execution inspectable
- it lets you debug failures later
- it creates feedback for refinement
- it turns "execution" into new knowledge, which fits the LLAAB loop

A simple mental model is:

```
skill       = recipe
run         = one cooking attempt
run logging = writing what happened and how it turned out
```

Right now in the repo:

- [`packages/schemas/src/run-node.schema.ts`] defines what a run record looks like
- [`packages/skills/src/runner.ts`] creates run records
- Every ingest operation writes a `RunNode` to `vault/runs/`

---

## pipeline **[candidates: #1]**

**A `pipeline` is the ordered sequence of stages that transforms an input into a result.**

In LLAAB terms, pipeline is the right word when the emphasis is on stage-by-stage transformation. A run is one execution record of that process. A skill is a reusable capability. The words overlap, but they are not identical.

Why it matters here:

- it clarifies how ingestion and other multi-step flows are structured
- it helps separate definition from execution
- it supports inspectable transformation stages

A simple mental model is:

```
skill    = capability
pipeline = staged process
run      = one execution record of that process
```

---

## agent

**An `agent` is an autonomous or semi-autonomous actor that runs skills, makes decisions, and produces outputs — with or without a human in the loop at each step.**

In LLAAB terms, the agent is the part of the system that can operate beyond a single request-response cycle. The human-in-the-loop curates what the agent produces, but does not drive every step.

Why it matters here:

- the agent loop is what makes LLAAB more than a script runner
- it reads the vault, decides what to process, runs skills, and persists results
- it is the mechanism by which execution produces new knowledge

Right now in the repo:

- [`packages/skills/src/agent/`] — agent loop, skill registry, dedup index
- `POST /api/agent/run` — one-shot agent processor
- `llaab agent run` — CLI entry point

---

## control

**`Control` is the execution governance layer — the part of the system that decides whether a run should proceed, applies retry logic, and records decisions.**

In LLAAB terms, the control layer sits between a skill invocation and the actual LLM call. It is not business logic; it is meta-logic about how execution should behave.

The control layer answers questions like:

- should this run proceed?
- what happens on failure?
- what decision was made and why?

Why it matters here:

- it prevents uncontrolled LLM calls
- it creates an auditable decision trace
- it is the primary boundary where model governance lives

Right now in the repo:

- [`packages/control/src/orchestrator.ts`] — `control.execute()` entry point
- [`packages/control/src/types.ts`] — decision trace types

---

## harness

**A `harness` is the preparation layer that runs before a governed LLM call — tokenizing, chunking, and assembling context so the model receives well-formed input.**

In LLAAB terms, the harness is not the LLM call itself. It is the deterministic stage that gets input ready: counting tokens, truncating or chunking if needed, structuring context. It makes extraction predictable regardless of input size.

Why it matters here:

- long transcripts can exceed model context limits
- the harness makes the extraction boundary safe and inspectable
- it is the first place where LLAAB's own tools (`@finografic/ai-harness`) are consumed

Right now in the repo:

- [`packages/ingestion/src/extract/harness-prep.ts`] — current harness-prep stage
- Current use is intentionally narrow: deterministic prep only, not full token-aware runtime harness

---

## taxonomy

**`Taxonomy` is the tag system that classifies nodes into domains, making the vault navigable and filterable.**

In LLAAB terms, taxonomy means the `d:` prefixed domain tags applied to nodes at ingest time and maintained through curation. It is not a folder hierarchy — it is a tagging layer.

The current domain tags are:

`d:llm` · `d:automation` · `d:ingest` · `d:schema` · `d:infra` · `d:integration` · `d:ui` · `d:meta`

Why it matters here:

- it makes the vault queryable without full-text search
- `autoTag(title, body)` in `@llaab/core` infers tags via regex so ingestion is never tagless
- it is the primary classification mechanism for agents traversing the vault

Right now in the repo:

- [`packages/core/src/taxonomy.ts`] — `autoTag` implementation
- All ingest runs apply `d:ingest` plus `autoTag`-inferred tags

---

## rag

**`RAG` means Retrieval-Augmented Generation — the pattern where the system fetches relevant information first, then supplies it as context before the model produces an output.**

RAG is not the intelligence of the system. It is the information access and context-selection layer around the model.

A RAG step answers questions like:

- what information should be fetched
- where it should be fetched from
- how much of it should be included
- how it should be structured before the model sees it

Why it matters here:

- the model only reasons over what is actually present in context
- retrieval helps ground outputs in real project data
- poor retrieval creates omission, noise, and hallucination risk

The important correction is:

RAG does not give the model "more knowledge." It gives the system a way to supply relevant information at runtime.

A simple mental model is:

```
llm = reasoning engine
rag = selective memory access
context = what actually reaches working memory
```
