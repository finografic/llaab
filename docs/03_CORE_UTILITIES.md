# LLAAB — Core utilities

---

## Utilities in `@llaab/core`

### `parseFrontmatter(content, filePath?)`

Extracts YAML-like frontmatter and body from a Markdown string. No heavy YAML engine — flat keys, scalars, inline arrays, and multi-line `- item` lists.

```ts
import { parseFrontmatter } from '@llaab/core';

const { frontmatter, body, filePath } = parseFrontmatter(fileContent, absolutePath);
// frontmatter: Record<string, unknown>
// body: string — everything after the closing ---
// filePath?: optional context for diagnostics / callers
```

Throws if no `---` frontmatter block is found.

After parsing, validate with the schemas package:

```ts
import { IdeaNodeSchema } from '@llaab/schemas';

const node = IdeaNodeSchema.parse({ ...frontmatter, body });
```

Or parse any supported kind:

```ts
import { NodeSchema } from '@llaab/schemas';

const node = NodeSchema.parse({ ...frontmatter, body });
```

---

### `readNode(filePath)`

Reads one Markdown file from disk, runs `parseFrontmatter`, then **`NodeSchema.parse`**. Returns a fully validated `LabNode`.

```ts
import { readNode } from '@llaab/core';

const node = await readNode('/absolute/path/to/vault/nodes/ideas/idea.example.md');
```

This is the preferred way to load a node when you already have a path (CLI, tests, or a glob you control).

---

### `createNode(options)`

Creates a new node as a Markdown file under the vault. Validates with the per-type schema, generates an id with `toNodeId(title)`, stamps timestamps, and writes frontmatter in a stable key order.

```ts
import { createNode } from '@llaab/core';

const { path, node } = await createNode({
  type: 'idea',
  title: 'Expose vault as MCP server',
  tags: ['integration', 'meta'],
  body: 'The vault could be exposed as an MCP server for direct agent access.',
  extra: { origin: 'manual' },
});
// path: '<cwd>/vault/nodes/ideas/idea.expose-vault-as-mcp-server.md'
// node: LabNode — fully typed
```

**Vault root for `createNode` (and `listNodes` / `readNode` in core):** `join(process.cwd(), 'vault')`. Set your working directory accordingly, or run from the repo root. This path does **not** read `LLAAB_VAULT` (see **Ideas** below for the inbox skill).

**Vault directory map** (relative to that vault root):

| Type          | Directory             |
| ------------- | --------------------- |
| `idea`        | `nodes/ideas/`        |
| `skill`       | `nodes/skills/`       |
| `prompt`      | `nodes/prompts/`      |
| `instruction` | `nodes/instructions/` |
| `transcript`  | `transcripts/`        |
| `resource`    | `nodes/resources/`    |
| `source`      | `sources/`            |
| `decision`    | `nodes/decisions/`    |
| `run`         | `runs/`               |

**Filename pattern:** `formatNodeFilename(type, id)` → `<type>.<id>.md` (for example `idea.my-topic.md`).

---

### `writeNode(node)`

Writes an existing node back to its deterministic vault path. Validates through the node's schema, refreshes `updatedAt`, and keeps file output consistent with `createNode()`.

```ts
import { writeNode } from '@llaab/core';

const result = await writeNode({
  ...existingNode,
  body: 'Updated markdown body',
});
```

Use this when you already have a full node object and want schema-checked persistence.

---

### `updateNode(filePath, updater)`

Reads a node from disk, passes it through an updater callback, preserves `id` and `type`, revalidates, refreshes `updatedAt`, and writes the result back.

```ts
import { updateNode } from '@llaab/core';

await updateNode('/absolute/path/to/vault/nodes/ideas/idea.example.md', (current) => ({
  ...current,
  body: `${current.body}\n\nRefined note.`,
}));
```

Use this when the caller knows the node path and wants a safe mutation layer instead of open-coded read/modify/write logic.

---

### `listNodes(options?)`

Recursively scans **`process.cwd()/vault`** for `.md` files, validates each with `readNode` (skips files that fail), then filters.

```ts
import { listNodes } from '@llaab/core';

const all = await listNodes();

const ideas = await listNodes({
  type: 'idea',
  status: 'seed',
  tags: ['ingestion'],
  search: 'youtube',
  limit: 10,
});
```

**Options:**

| Option   | Type         | Description                                                    |
| -------- | ------------ | -------------------------------------------------------------- |
| `type`   | `NodeType`   | Filter by node type                                            |
| `status` | `NodeStatus` | Filter by lifecycle status                                     |
| `tags`   | `string[]`   | Match if **any** listed tag is present on the node             |
| `search` | `string`     | Case-insensitive substring on **title**, **tags**, or **body** |
| `limit`  | `number`     | Max number of nodes after filtering                            |

**Returns:** `Promise<LabNode[]>` — full validated nodes, including `body`. There is no separate “summary” DTO; if you only need metadata, read the fields you need from each node.

**Note:** There are no `hot`, `cold`, or `sortBy` options in the current implementation — add sorting in your caller if you need it.

---

## Other exports

| Export              | Role                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `readMarkdownFiles` | Reads every `*.md` file in a **single** directory (not recursive) and returns their contents |
| `writeTextFile`     | Writes a UTF-8 text file                                                                     |

---

## Related skills package

`@llaab/skills` also exposes **`ingestYouTube`** and **`runSkill`** (see `packages/skills/src/`). Those sit above core: they orchestrate ingestion and execution rather than low-level vault I/O. `runSkill()` now persists real `run` nodes, so execution observability is part of the current architecture rather than a future note.
