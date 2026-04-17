# LLAAB — Overview

This document covers the schema layer (`@llaab/schemas`), what each piece does, how they fit
together, and how to use them with the utilities in `@llaab/core` and `@llaab/skills`.

---

## The Big Picture

Every piece of knowledge in LLAAB lives in the vault as a Markdown file with YAML-like frontmatter.
The schema layer is what gives that frontmatter meaning.

```txt
vault/nodes/ideas/idea.expose-vault-as-mcp-server.md
        │
        ▼
  parseFrontmatter()   ← @llaab/core (lightweight parser, not full YAML)
        │
        ▼
  Zod schema validation              ← @llaab/schemas (`NodeSchema`)
        │
        ▼
  Fully typed node (`LabNode`)
        │
        ▼
  CLI / ingestion / agents / UI
```

The schemas package is the **ubiquitous language** — if a concept isn't defined here,
it doesn't exist in the system.

---

## Package Layout

```txt
packages/schemas/src/
├── primitives.schema.ts       # Atoms: NodeId, NodeType, NodeStatus, RunStatus, timestamps
├── base-node.schema.ts        # Common fields every node shares
├── node.schema.ts             # Discriminated union `NodeSchema` → type `LabNode`
├── schema.utils.ts            # toNodeId, now, formatNodeFilename, nodeSchemaByType, …
│
├── idea-node.schema.ts        # 💡 Captured thought or hypothesis
├── skill-node.schema.ts       # ⚡ Structured, executable knowledge
├── prompt-node.schema.ts      # 📝 Reusable LLM prompt template
├── instruction-node.schema.ts # 📋 Deterministic step-by-step procedure
├── transcript-node.schema.ts  # 🎙️ Ingested content from external sources
├── resource-node.schema.ts    # 📦 External tool, library, or reference
├── source-node.schema.ts      # 👤 Person, channel, or knowledge origin
├── decision-node.schema.ts    # 📓 Architectural / design decision (ADR-style)
├── run-node.schema.ts         # 🔁 Logged execution of a skill
│
├── relationship.schema.ts     # Typed graph edges between nodes
└── index.ts                   # Re-exports (no schema logic here)
```

---

## Primitives

**File:** `primitives.schema.ts`  
**Import:** `import { NodeIdSchema, NodeTypeSchema, NodeStatusSchema, RunStatusSchema, TimestampSchema } from '@llaab/schemas'`

These are the atoms everything else is built from.

| Name               | Type                     | Description                                                                             |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------- |
| `NodeIdSchema`     | Zod string schema        | Slug-style ID: lowercase letters, numbers, hyphens (`a-z0-9-`), no leading/trailing `-` |
| `NodeTypeSchema`   | Zod enum schema          | All nine node types (see below)                                                         |
| `NodeStatusSchema` | Zod enum schema          | Lifecycle: `seed` → `growing` → `mature` → `archived`                                   |
| `RunStatusSchema`  | Zod enum schema          | For `run` nodes: `pending`, `running`, `completed`, `failed`, `cancelled`               |
| `TimestampSchema`  | Zod string refinement    | Validated ISO-style timestamp string (parseable by `Date`)                              |
| `NodeId`           | inferred TypeScript type | Type inferred from `NodeIdSchema`                                                       |
| `NodeType`         | inferred TypeScript type | Type inferred from `NodeTypeSchema`                                                     |
| `NodeStatus`       | inferred TypeScript type | Type inferred from `NodeStatusSchema`                                                   |
| `RunStatus`        | inferred TypeScript type | Type inferred from `RunStatusSchema`                                                    |

Field names in Zod schemas and typed nodes use **snake_case** (for example `created_at`, `source_url`), including in frontmatter keys as written by `createNode()`.

### NodeType values

| Value         | Node              | Purpose                      |
| ------------- | ----------------- | ---------------------------- |
| `idea`        | `IdeaNode`        | Raw captured thought         |
| `skill`       | `SkillNode`       | Executable knowledge         |
| `prompt`      | `PromptNode`      | LLM prompt template          |
| `instruction` | `InstructionNode` | Deterministic procedure      |
| `transcript`  | `TranscriptNode`  | Ingested external content    |
| `resource`    | `ResourceNode`    | External tool or reference   |
| `source`      | `SourceNode`      | People, channels, origins    |
| `decision`    | `DecisionNode`    | Architecture decision record |
| `run`         | `RunNode`         | Execution log                |

### NodeStatus lifecycle

```txt
seed  →  growing  →  mature  →  archived
  ↑           ↑           ↑          ↑
captured   being      stable &    no longer
 (fast)   structured  usable      active
```

Everything enters as `seed`. Nothing is deleted — only archived.

### RelationshipType values

Defined in `relationship.schema.ts`:  
`uses` · `produces` · `derivedFrom` · `refines` · `dependsOn` · `authoredBy` · `inputTo` · `outputOf` · `relatedTo`

---

## File naming convention

New node files are written as:

```txt
<type>.<node-id>.md
```

The `id` comes from the title at creation time via `toNodeId()` in `@llaab/schemas` (see `schema.utils.ts`). `formatNodeFilename(type, id)` builds the filename.

```txt
"Expose vault as MCP server"
        ↓  toNodeId()
"expose-vault-as-mcp-server"
        ↓  written to (for an idea)
vault/nodes/ideas/idea.expose-vault-as-mcp-server.md
```

IDs stay stable after creation — renaming the title does not change the id.

---

## Complete flow example

```ts
import { captureIdea } from '@llaab/skills';
import { listNodes, readNode } from '@llaab/core';
import { NodeSchema } from '@llaab/schemas';
import { join } from 'path';

// 1. Capture (async; writes the idea file and appends INBOX)
await captureIdea('Build a skill genealogy visualizer', 'Optional body text.', ['ui', 'graph']);

// 2. List (async; full validated nodes, including body)
const ideas = await listNodes({ type: 'idea', limit: 5 });
const first = ideas[0];
if (first?.type === 'idea') {
  console.log(first.origin); // 'manual'
  console.log(first.source_id); // optional structural link to a source/transcript origin
}

// 3. Read one file by path when you already know where it lives (CLI arg, glob, etc.)
const fromDisk = await readNode(join(process.cwd(), 'vault/nodes/ideas/idea.expose-vault-as-mcp-server.md'));

// 4. Parse a plain object + body (e.g. after your own frontmatter parse)
const parsed = NodeSchema.parse({ ...frontmatterObject, body: markdownBody });
```

Objects from `listNodes()` are already validated `LabNode` values. Use `readNode(filePath)` when you have a path and want the same validation path as the rest of the stack.

---

## Related docs

| Doc                                                         | Topics                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [02 — Node types and schemas](02_NODE_TYPES_and_SCHEMAS.md) | Per-type fields, unions, relationships                                               |
| [03 — Core utilities](03_CORE_UTILITIES.md)                 | `parseFrontmatter`, `createNode`, `writeNode`, `updateNode`, `listNodes`, `readNode` |
| [04 — Ideas to skills](04_IDEAS_TO_SKILLS.md)               | `captureIdea`, inbox, auto-tags                                                      |

---

## Supporting modules (not duplicated here)

- **`schema.utils.ts`** — `toNodeId`, `now`, `formatNodeFilename`, `nodeSchemaByType`, and small type guards.
- **`read-node.utils.ts`** (`@llaab/core`) — read one file, parse frontmatter, validate with `NodeSchema`.

See also `SCHEMAS_ADDED.md` in the repo root for a concise map of the same layer.
