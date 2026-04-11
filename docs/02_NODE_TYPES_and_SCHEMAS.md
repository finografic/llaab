# LLAAB — Node types and schemas

---

## Base node

**File:** `base-node.schema.ts`

Every node in the vault shares these fields (camelCase in typed nodes and in frontmatter produced by `createNode()`):

```ts
{
  id: NodeId,               // slug, e.g. "youtube-ingestion-pipeline"
  type: NodeType,           // discriminant
  title: string,            // human-readable name
  tags: string[],           // explicit cross-references (defaults [])
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

### 💡 Idea Node

The lowest-friction entry point. Captures a thought before it evaporates.

```ts
IdeaNode = BaseNode & {
  type: 'idea'
  origin: 'manual' | 'extracted' | 'generated'  // default 'manual'
  sourceId?: NodeId       // optional structural link to a `source` node
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

### ⚡ Skill Node

Structured, executable knowledge.

```ts
SkillNode = BaseNode & {
  type: 'skill'
  inputs: string[]           // what this skill expects
  outputs: string[]          // what this skill produces
  tools: string[]            // e.g. ['llm', 'bash', 'fetch']
  version?: string
  sourceId?: NodeId          // optional structural link to source provenance
  derivedFromIds: NodeId[]   // transcript/idea it came from
  parentSkillId?: NodeId     // if refined from another skill
  generation: number         // refinement depth (0 = original)
}
```

The prompt or procedure text for the skill lives in `body` unless you split it across linked prompt/instruction nodes.

---

### 📝 Prompt Node

Reusable LLM prompt content. The main text is stored in **`body`**; metadata fields are:

```ts
PromptNode = BaseNode & {
  type: 'prompt'
  variables: string[]             // expected variable names
  modelHint?: string              // suggested model, e.g. 'llama3'
  outputSchema?: string           // Zod schema name for structured output
}
```

---

### 📋 Instruction Node

Human-readable procedural guidance.

```ts
InstructionNode = BaseNode & {
  type: 'instruction'
  scope?: string                  // what context this applies to
}
```

Steps and narrative live in `body`.

---

### 🎙️ Transcript Node

Ingested long-form content (for example from YouTube). The readable transcript text is carried in **`body`**; structured metrics and links use dedicated fields:

```ts
TranscriptNode = BaseNode & {
  type: 'transcript'
  sourceId?: NodeId          // source provenance link
  sourceUrl: string         // URL
  sourceType: 'youtube' | 'article' | 'repo' | 'chat' | 'other'
  author?: string
  summary?: string               // LLM-generated summary
  rawLength?: number             // character count of original
  cleanLength?: number
  structuredParagraphs?: number
  extractedIdeaIds: NodeId[]     // ideas pulled from this
  extractedSkillIds: NodeId[]    // skills pulled from this
}
```

---

### 📦 Resource Node

External references such as tools, libraries, articles, or repos.

```ts
ResourceNode = BaseNode & {
  type: 'resource'
  sourceId?: NodeId
  url?: string
  resourceType: 'tool' | 'library' | 'api' | 'dataset' | 'reference' | 'article' | 'repo' | 'other'
  description?: string
}
```

---

### 👤 Source Node

People, channels, repos, or other origins.

```ts
SourceNode = BaseNode & {
  type: 'source'
  sourceKind: 'person' | 'channel' | 'repo' | 'publication' | 'organization' | 'other'
  url?: string
  platforms: string[]
  follow: boolean            // actively monitoring? (default false)
}
```

---

### 📓 Decision Node

Architecture or design decision (ADR-style).

```ts
DecisionNode = BaseNode & {
  type: 'decision'
  context: string           // what situation prompted this
  decision: string          // what was decided
  rationale: string         // why
  alternatives: string[]    // what else was considered
  consequences: string[]    // known tradeoffs
}
```

---

### 🔁 Run Node

Execution record for a skill or automation. **`RunNode` is part of the same discriminated union** as every other node (`NodeSchema` / `LabNode`).

```ts
RunNode = BaseNode & {
  type: 'run'
  skillId?: NodeId
  runStatus: RunStatus       // 'pending' (default), 'running', 'completed', 'failed', 'cancelled'
  inputSummary?: string
  outputSummary?: string
  producedNodeIds: NodeId[]  // nodes created by this run
  stages: Array<{
    name: string
    status: 'pending' | 'completed' | 'failed'
    input?: unknown
    output?: unknown
    error?: string
  }>
  decisions: Array<{
    type: 'accept' | 'retry' | 'reject' | 'downgrade'
    reason: string
  }>
  llm?: {
    model?: string
    rawOutput?: string
    parsed?: boolean
  }
  modelUsed?: string         // e.g. 'llama3', 'claude-sonnet'
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
- **Lightweight provenance** — `sourceId` is the current bridge from externally-derived nodes to `source` nodes.
- **Richer runs** — `run` nodes now support stages, decisions, and optional LLM trace data for observability.
