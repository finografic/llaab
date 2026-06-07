# LLAAB — Taxonomy Guide

> The definitive reference for the tagging system. Keep this short and stable.
> Examples and worked scenarios live in `TAXONOMY_EXAMPLES.md` alongside this file.

---

## Design principles

**One dimension in tags.** Tags answer a single question: _what domain is this content about?_
The other dimensions you might put in tags are already handled by dedicated fields:

| Dimension | Field    | Values                                             |
| --------- | -------- | -------------------------------------------------- |
| Kind      | `type`   | `idea`, `transcript`, `source`, `skill`, `snippet` |
| Lifecycle | `status` | `seed`, `growing`, `mature`                        |
| Scope     | `origin` | `manual`, `youtube`, `agent`                       |

Mixing these into tags means storing the same information twice. When `type: 'idea'` and a
hypothetical `k:idea` tag coexist on the same node, one will drift — and you'll never know which
to trust.

**Flat, not hierarchical.** Sub-tags (`d:llm-prompting`, `d:llm-evals`) are reserved for when a
domain accumulates 40+ nodes and you need finer filtering. Introduce them then, not now.
Premature sub-tags produce 30 tags each with 2 nodes — the opposite of useful.

**`d:` prefix.** All domain tags are prefixed with `d:` so they are visually distinct from
structural fields, group cleanly in Obsidian's tag pane, and leave the namespace open for a
second dimension (e.g. `c:` for capability) without renaming everything.

**Conservative regex.** The auto-tagger only matches terms that _almost certainly_ indicate a
domain. A missed tag is easy to fix manually; a false positive erodes trust and makes the system
feel noisy.

---

## The 8 domain tags

| Tag             | What it covers                                                        |
| --------------- | --------------------------------------------------------------------- |
| `d:llm`         | LLMs, models, prompting, inference — the "brain" stuff                |
| `d:automation`  | Agents, skills, workflows, pipelines, orchestration                   |
| `d:ingest`      | Capture, transcription, YouTube, article parsing, ingestion pipelines |
| `d:schema`      | Zod, validation, data contracts, typed structures                     |
| `d:infra`       | CLI, terminal, bash scripts, monorepo config, CI/CD                   |
| `d:integration` | External tools — MCP, Cursor, Tauri, Astro, Obsidian                  |
| `d:ui`          | Frontend, components, layout, React, design                           |
| `d:meta`        | LLAAB about itself — vault structure, node topology, self-reference   |

### Common confusions

**`d:meta` ≠ "knowledge management".**
A Karpathy video about using LLMs + Obsidian is `d:llm` + `d:integration`, _not_ `d:meta`.
It's inspiration for LLAAB, but it isn't LLAAB reasoning about itself. `d:meta` is reserved for
things like: restructuring how nodes relate, this taxonomy doc, a skill that modifies the vault.

**`d:integration` ≠ "anything external".**
`d:integration` is specifically for named external tools (MCP, Cursor, Tauri, Obsidian, Astro).
A generic API integration does not qualify unless it's one of those tools.

**`d:infra` ≠ `d:integration`.**
`d:infra` is the build/dev system: CLIs, bash scripts, monorepo config, CI pipelines.
`d:integration` is external _product_ integrations.

**Source nodes carry no domain tags.**
A `source` node (e.g. a YouTube channel) is a container entity, not content. It produces content
across many domains, so tagging it `d:llm` + `d:ui` + `d:infra` would be meaningless. Domain tags
live on `transcript` and `idea` nodes — the content, not the container.

---

## Auto-tagging

`autoTag(title, body)` in `@llaab/core` infers tags from the text using the patterns below.
Both `captureIdea` (in `@llaab/skills`) and `runIngestionPipeline` (in `@llaab/ingestion`) call
it automatically. Manual tags passed by the caller are merged in and deduplicated.

| Matches…                                                                   | Tag             |
| -------------------------------------------------------------------------- | --------------- |
| `llm`, `gpt`, `claude`, `ollama`, `anthropic`, `prompt(ing)`               | `d:llm`         |
| `agent`, `autonomous`, `workflow`, `automation`, `pipeline`, `orchestrat*` | `d:automation`  |
| `ingest(ion)`, `transcript`, `youtube`, `capture`                          | `d:ingest`      |
| `schema`, `zod`, `validation`                                              | `d:schema`      |
| `cli`, `terminal`, `bash`, `monorepo`, `ci/cd`                             | `d:infra`       |
| `mcp`, `cursor`, `tauri`, `astro`, `obsidian`                              | `d:integration` |
| `ui`, `frontend`, `component`, `layout`, `react`                           | `d:ui`          |
| `llaab`, `self-referential`, `meta`                                        | `d:meta`        |

Auto-tagging handles ~60–70% of cases on ingested content (rich title + body). Ideas almost
always need one manual tag because idea titles are short. That's the right tradeoff — you only
type one tag, not five.

---

## Tag visualization (planned — UI implementation pending)

Each domain tag has a fixed color with semantic association. Solid fill = auto-inferred.
Outline only = manually added. The solid/outline distinction tells you _how the tag arrived_
without any extra UI chrome.

| Tag             | Color  | Rationale                                             |
| --------------- | ------ | ----------------------------------------------------- |
| `d:llm`         | Blue   | Default AI/intelligence association; used most often  |
| `d:automation`  | Purple | "Magic behind the scenes" — GitHub Actions, Buildkite |
| `d:ingest`      | Amber  | Incoming, arriving, in-progress                       |
| `d:schema`      | Teal   | Precise, structured, clean                            |
| `d:infra`       | Gray   | Plumbing; deliberately understated                    |
| `d:integration` | Coral  | External connections; warm + distinct                 |
| `d:ui`          | Pink   | Visual, creative, design-forward                      |
| `d:meta`        | Green  | Organic growth, the system evolving                   |

---

## When to add a new tag

Add a new `d:` tag only when:

1. You have or expect 10+ nodes that _don't_ fit any existing tag.
2. You can write a 1-sentence definition with a clear boundary against existing tags.
3. The pattern for auto-detection is tight (≤ 3 highly specific terms).

If you need finer granularity within an existing domain (e.g. 40+ `d:llm` nodes), add a
sub-tag (`d:llm-prompting`) instead of a new top-level tag.
