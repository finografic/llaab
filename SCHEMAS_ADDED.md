# Schemas Added

This document is the beginner-friendly map of the first real LLAAB schema layer.

The goal of this pass was:

1. Drop in the starter-kit ideas that still fit the current package graph.
2. Replace the old single-file schema setup with modular `*.schema.ts` files.
3. Wire the schema package into core utilities, ingestion, and skills.

## What Changed

The schema system now lives in `packages/schemas/src/` as focused files instead of one catch-all implementation.

`index.ts` is now re-export only.

The core node model is now:

```txt
Markdown file
  -> frontmatter/body parser
  -> Zod schema validation
  -> typed LLAAB node
  -> used by core utils, ingestion, and skills
```

## Schema Files

| File                         | Purpose                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `primitives.schema.ts`       | Shared primitives such as `NodeId`, `NodeType`, `NodeStatus`, run status, and timestamps.                                |
| `base-node.schema.ts`        | The common fields every node gets: `id`, `type`, `title`, `tags`, `related`, `createdAt`, `updatedAt`, `status`, `body`. |
| `idea-node.schema.ts`        | Fast-capture thoughts and raw ideas.                                                                                     |
| `skill-node.schema.ts`       | Executable knowledge with `inputs`, `outputs`, `tools`, and lightweight lineage fields.                                  |
| `prompt-node.schema.ts`      | Reusable prompt definitions with variables and model hints.                                                              |
| `instruction-node.schema.ts` | Deterministic process or workflow guidance.                                                                              |
| `transcript-node.schema.ts`  | Ingested long-form content such as YouTube transcripts.                                                                  |
| `resource-node.schema.ts`    | External docs, tools, repos, references, and similar resources.                                                          |
| `source-node.schema.ts`      | People, channels, repos, publications, or other origins of knowledge.                                                    |
| `decision-node.schema.ts`    | Architecture and system decisions made inside the lab.                                                                   |
| `run-node.schema.ts`         | Execution records for skills or other automations.                                                                       |
| `relationship.schema.ts`     | Typed edges between nodes.                                                                                               |
| `node.schema.ts`             | The discriminated union that validates any supported LLAAB node.                                                         |
| `schema.utils.ts`            | Non-schema helpers like `toNodeId()`, `now()`, `formatNodeFilename()`, and the per-type schema map.                      |
| `index.ts`                   | Re-exports only. No schema logic lives here.                                                                             |

## Node Types Included

| Node Type     | What It Represents                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `idea`        | A fast capture, hypothesis, or note that may later mature into a skill, decision, or other node. |
| `skill`       | Executable knowledge with explicit inputs, outputs, and tools.                                   |
| `prompt`      | Reusable LLM prompt content.                                                                     |
| `instruction` | Human-readable procedural guidance.                                                              |
| `transcript`  | Structured content imported from YouTube or similar sources.                                     |
| `resource`    | External references such as articles, repos, libraries, datasets, or tools.                      |
| `source`      | The person, channel, repo, or publication a node came from.                                      |
| `decision`    | A recorded project or architecture decision.                                                     |
| `run`         | A record of execution outcomes.                                                                  |

## Shared Fields

These fields exist on every node through `BaseNodeSchema`:

| Field       | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| `id`        | Stable slug-like node id, generated from the title by `toNodeId()`. |
| `type`      | The node discriminator used by the union schema.                    |
| `title`     | Human-readable title.                                               |
| `tags`      | Flexible grouping and filtering labels.                             |
| `related`   | Light-weight explicit connections to other node ids.                |
| `createdAt` | ISO timestamp for creation.                                         |
| `updatedAt` | ISO timestamp for most recent update.                               |
| `status`    | Lifecycle stage: `seed`, `growing`, `mature`, or `archived`.        |
| `body`      | The markdown body of the file, stored outside frontmatter.          |

## Core Utilities Wired To Schemas

These utilities now operate on the new schema system:

| Utility                                                                                                | What It Does                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [`create-node.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/create-node.utils.ts)             | Creates validated nodes, serializes frontmatter, and writes markdown files into the correct vault location. |
| [`parse-frontmatter.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/parse-frontmatter.utils.ts) | Splits frontmatter from markdown body and parses a simple human-writable YAML-like format.                  |
| [`read-node.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/read-node.utils.ts)                 | Reads one markdown file and validates it through `NodeSchema`.                                              |
| [`list-nodes.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/list-nodes.utils.ts)               | Recursively scans the vault, reads nodes, and filters by type, status, tags, or search text.                |

## File Naming And Storage

New node files are written with this pattern:

```txt
<type>.<node-id>.md
```

Examples:

```txt
idea.ingestion-pipeline.md
skill.summarize-repo.md
transcript.some-youtube-video.md
```

Vault destinations currently used by `createNode()`:

| Node Type     | Vault Directory            |
| ------------- | -------------------------- |
| `idea`        | `vault/nodes/ideas`        |
| `skill`       | `vault/nodes/skills`       |
| `prompt`      | `vault/nodes/prompts`      |
| `instruction` | `vault/nodes/instructions` |
| `resource`    | `vault/nodes/resources`    |
| `decision`    | `vault/nodes/decisions`    |
| `transcript`  | `vault/transcripts`        |
| `source`      | `vault/sources`            |
| `run`         | `vault/runs`               |

## Starter-Kit Pieces Adopted

The starter kit was not copied blindly. The parts that matched the current repo and mission were folded in selectively.

Adopted or adapted:

| Source File                           | Result                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transcript.ts`                       | Used as the basis for the richer deterministic transcript cleaner in [`packages/ingestion/src/clean/transcript.ts`](/Users/justin/LLAAB/packages/ingestion/src/clean/transcript.ts). |
| `text.ts`                             | Used as the basis for paragraph structuring in [`packages/ingestion/src/structure/text.ts`](/Users/justin/LLAAB/packages/ingestion/src/structure/text.ts).                           |
| `youtube.ts`                          | Adapted into a real `yt-dlp`-backed fetcher in [`packages/ingestion/src/fetch/youtube.ts`](/Users/justin/LLAAB/packages/ingestion/src/fetch/youtube.ts).                             |
| `create-node.utils.ts`                | Reworked into the current validated node writer in [`packages/core/src/utils/create-node.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/create-node.utils.ts).               |
| `parse-frontmatter.utils.ts`          | Adapted into the current lightweight parser in [`packages/core/src/utils/parse-frontmatter.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/parse-frontmatter.utils.ts).       |
| `list-nodes.utils.ts`                 | Adapted into the current recursive vault scanner in [`packages/core/src/utils/list-nodes.utils.ts`](/Users/justin/LLAAB/packages/core/src/utils/list-nodes.utils.ts).                |
| `capture-idea.ts`                     | Adapted into the current idea skill, including inbox appending and light auto-tagging.                                                                                               |
| `pipeline.ts` and `ingest-youtube.ts` | Adapted so YouTube ingestion creates typed `transcript` and `source` nodes.                                                                                                          |

Not copied directly:

| Starter-Kit Idea                | Why It Was Changed                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Single-file schema `index.ts`   | Replaced with modular `*.schema.ts` files per your instruction.                                     |
| Snake_case schema fields        | Shifted to camelCase to better match the current TypeScript codebase.                               |
| Mixed body field names per node | Unified to one `body` field in typed nodes while keeping markdown body outside frontmatter on disk. |

## Ingestion Integration

The ingestion package now behaves more like the manifesto:

1. YouTube content is fetched with metadata and subtitles when available.
2. Transcript cleaning is deterministic.
3. Cleaned text is structured into paragraphs.
4. Placeholder extraction still generates a summary through the current LLM wrapper.
5. A typed `transcript` node is created.
6. A related `source` node is created for the YouTube channel when possible.

For non-YouTube sources:

1. `article` and `repo` ingestion currently create `resource` nodes.
2. This keeps those pipelines usable now without pretending they already have transcript-grade metadata.

## Important Design Decisions

| Decision                   | Reason                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- |
| Modular schemas            | Easier to maintain, easier to extend, and aligns with your `index.ts` rule.      |
| Shared `body` field        | Keeps the markdown body predictable across node types.                           |
| Slug ids instead of UUIDs  | Better for local-first readability, manual linking, and inspectable files.       |
| Human-writable frontmatter | Preserves the “everything inspectable” principle.                                |
| Simple `related` field     | Gives you lightweight explicit links without overbuilding graph logic too early. |

## Validation Run

These checks were run successfully after integration:

| Command                         | Result |
| ------------------------------- | ------ |
| `pnpm turbo build`              | Passed |
| `pnpm -r run typecheck`         | Passed |
| `bun packages/cli/src/index.ts` | Passed |

## Known Limits In This First Draft

| Area                           | Current State                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Frontmatter parsing            | Intentionally lightweight. Good for flat fields, arrays, and JSON-like values; not a full YAML parser. |
| `article` and `repo` ingestion | Still placeholder fetchers, but now they land in typed `resource` nodes.                               |
| Run logging                    | A `run` schema exists, but the runner does not yet persist run nodes to the vault.                     |
| Relationships                  | Relationship schemas exist, but a dedicated edge store has not been built yet.                         |

## Recommended Next Step

The natural next move is the schema usage layer:

1. Add `updateNode()` and `writeNode()` helpers so existing files can be safely edited after creation.
2. Persist `run` nodes from `packages/skills/src/runner.ts`.
3. Decide which extracted outputs should first become real nodes automatically: ideas, skills, or both.
