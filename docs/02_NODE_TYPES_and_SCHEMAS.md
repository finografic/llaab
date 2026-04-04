# LLAAB — Node types and schemas

---

## Base node

**File:** `base-node.schema.ts`

Every node in the vault shares these fields (camelCase in typed nodes and in frontmatter produced by `createNode()`):

```ts
{
  id: NodeId,
  type: NodeType,
  title: string,
  tags: string[],           // default []
  related: NodeId[],        // default [] — lightweight links to other nodes
  createdAt: string,        // ISO timestamp
  updatedAt?: string,       // ISO timestamp (optional in schema; set by flows that write nodes)
  status: NodeStatus,       // default "seed"
  body: string,             // markdown body (file content below frontmatter)
}
```

There is no separate `meta` bag on the base node in the current schemas — extend a specific node schema when a field should become first-class.

---

## Node types

### Idea node

The lowest-friction entry point. Captures a thought before it evaporates.

```ts
IdeaNode = BaseNode & {
  type: 'idea'
  origin: 'manual' | 'extracted' | 'generated'  // default 'manual'
  sourceNodeId?: NodeId   // optional link to transcript/resource/source
}
```

**Vault file example:**

```md
---
id: youtube-ingestion-pipeline
type: idea
title: YouTube Ingestion Pipeline
status: seed
tags:
  - ingestion
  - youtube
related: []
createdAt: '2026-04-04T12:00:00.000Z'
updatedAt: '2026-04-04T12:00:00.000Z'
origin: manual
---

# YouTube Ingestion Pipeline

Need a system to scrape transcripts, clean timestamps, extract skills.
```

**Created by:** `captureIdea()` in `@llaab/skills`, or `createNode({ type: 'idea', ... })` in `@llaab/core`.

---

### Skill node

Structured, executable knowledge.

```ts
SkillNode = BaseNode & {
  type: 'skill'
  inputs: string[]
  outputs: string[]
  tools: string[]
  version?: string
  derivedFromIds: NodeId[]
  parentSkillId?: NodeId
  generation: number        // default 0
}
```

The prompt or procedure text for the skill lives in `body` unless you split it across linked prompt/instruction nodes.

---

### Prompt node

Reusable LLM prompt content. The main text is stored in **`body`**; metadata fields are:

```ts
PromptNode = BaseNode & {
  type: 'prompt'
  variables: string[]
  modelHint?: string
  outputSchema?: string
}
```

---

### Instruction node

Human-readable procedural guidance.

```ts
InstructionNode = BaseNode & {
  type: 'instruction'
  scope?: string
}
```

Steps and narrative live in `body`.

---

### Transcript node

Ingested long-form content (for example from YouTube). The readable transcript text is carried in **`body`**; structured metrics and links use dedicated fields:

```ts
TranscriptNode = BaseNode & {
  type: 'transcript'
  sourceUrl: string         // URL
  sourceType: 'youtube' | 'article' | 'repo' | 'chat' | 'other'
  author?: string
  summary?: string
  rawLength?: number
  cleanLength?: number
  structuredParagraphs?: number
  extractedIdeaIds: NodeId[]
  extractedSkillIds: NodeId[]
}
```

---

### Resource node

External references such as tools, libraries, articles, or repos.

```ts
ResourceNode = BaseNode & {
  type: 'resource'
  url?: string
  resourceType: 'tool' | 'library' | 'api' | 'dataset' | 'reference' | 'article' | 'repo' | 'other'
  description?: string
}
```

---

### Source node

People, channels, repos, or other origins.

```ts
SourceNode = BaseNode & {
  type: 'source'
  sourceKind: 'person' | 'channel' | 'repo' | 'publication' | 'organization' | 'other'
  url?: string
  platforms: string[]
  follow: boolean            // default false
}
```

---

### Decision node

Architecture or design decision (ADR-style).

```ts
DecisionNode = BaseNode & {
  type: 'decision'
  context: string
  decision: string
  rationale: string
  alternatives: string[]
  consequences: string[]
}
```

---

### Run node

Execution record for a skill or automation. **`RunNode` is part of the same discriminated union** as every other node (`NodeSchema` / `LabNode`).

```ts
RunNode = BaseNode & {
  type: 'run'
  skillId?: NodeId
  runStatus: RunStatus      // default 'pending'
  inputSummary?: string
  outputSummary?: string
  producedNodeIds: NodeId[]
  modelUsed?: string
  durationMs?: number
  error?: string
  startedAt?: string
  completedAt?: string
}
```

---

## Unions

**File:** `node.schema.ts`

```ts
import { NodeSchema, type LabNode } from '@llaab/schemas';

const node = NodeSchema.parse({ ...frontmatter, body });
//    ^? LabNode — includes all nine node kinds, including `run`
```

`NodeSchema` is a Zod discriminated union on `type`. After parsing, narrow with `switch (node.type)` or `if (node.type === 'idea')`.

---

## Schema helpers

**File:** `schema.utils.ts`  
**Import:** `import { toNodeId, now, formatNodeFilename, nodeSchemaByType } from '@llaab/schemas'`

| Export               | Role                                                   |
| -------------------- | ------------------------------------------------------ |
| `toNodeId`           | Slug from a title or string (used when creating nodes) |
| `now`                | Current time as an ISO string                          |
| `formatNodeFilename` | Builds `<type>.<id>.md`                                |
| `nodeSchemaByType`   | Map from `NodeType` to the Zod schema for that type    |
| `isNodeType`         | String guard for `NodeType`                            |
| `isTimestamp`        | Checks `TimestampSchema`                               |

There is no `seed()` helper in the current package — build objects with `nodeSchemaByType[type].parse({ ... })` or use `createNode()` from `@llaab/core`.

---

## Relationship

**File:** `relationship.schema.ts`

```ts
import { RelationshipSchema, type Relationship } from '@llaab/schemas';

const edge = RelationshipSchema.parse({
  from: 'skill-a',
  to: 'prompt-b',
  type: 'uses',
  createdAt: new Date().toISOString(),
  note: 'optional',
});
```

Relationships are defined for future graph work; persisting edges as their own files or rows is not wired through the vault utilities yet (see `SCHEMAS_ADDED.md`).

---

## What changed vs older drafts

- **Modular `*.schema.ts` files** — `packages/schemas/src/index.ts` only re-exports.
- **camelCase** fields in Zod and on disk (for example `createdAt`, `sourceUrl`, `extractedIdeaIds`).
- **Single union** — `node.schema.ts` exports `NodeSchema` and the inferred type `LabNode` (there is no separate `lab-node.schema.ts` or `AnyNode` split).
- **Filename pattern** — `<type>.<id>.md`, not `<id>.md` alone.
