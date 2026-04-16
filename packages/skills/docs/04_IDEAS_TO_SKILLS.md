# LLAAB — Ideas to skills

## Skills in `@llaab/skills`

### `captureIdea(title, body?, tags?)`

Fast path from thought to vault. Calls `createNode({ type: 'idea', ... })` with `origin: 'manual'`, merges **lightweight auto-tags**, then appends a line to **`INBOX.md`** under the vault root used for the inbox.

```ts
import { captureIdea } from '@llaab/skills';

await captureIdea('Expose vault as MCP server', 'Direct agent access to the knowledge graph.', [
  'd:integration',
]);
// Logs the new id and file path to the console.
```

**Parameters:**

| Parameter | Default | Description                                        |
| --------- | ------- | -------------------------------------------------- |
| `title`   | —       | Idea title (also drives `toNodeId()` for the file) |
| `body`    | omitted | Optional markdown body                             |
| `tags`    | omitted | Extra tags merged with inferred tags               |

**Vault path for the inbox:** `process.env.LLAAB_VAULT` if set, otherwise `'./vault'` (resolved relative to the current working directory). The idea file itself is still written by `@llaab/core`'s `createNode()`, which uses **`join(process.cwd(), 'vault')`**. Keep cwd and `LLAAB_VAULT` aligned in real usage so the inbox and node files land in the same vault.

**Output file naming:** `idea.<id>.md` under `vault/nodes/ideas/` (when cwd matches your project layout).

---

### Taxonomy design

Tags use a single dimension prefix: **`d:`** (domain — what the content is about).

Other dimensions are handled by **dedicated frontmatter fields**, not tags:

| Dimension | Field    | Values                                             | Purpose                   |
| --------- | -------- | -------------------------------------------------- | ------------------------- |
| Kind      | `type`   | `idea`, `transcript`, `source`, `skill`, `snippet` | What kind of node         |
| Lifecycle | `status` | `seed`, `growing`, `mature`                        | Where it is in processing |
| Scope     | `origin` | `manual`, `youtube`, `agent`                       | How it entered the vault  |

This separation means domain tags are **stable** (a node tagged `d:llm` stays `d:llm` forever) while lifecycle evolves independently via the `status` field. Agents advancing lifecycle don't need to understand or mutate the tag system.

---

### Auto-tagging

`captureIdea` infers domain tags from the title and body via regex, then unions them with any tags you pass in explicitly. The regex patterns are intentionally conservative — only terms that _almost certainly_ indicate a domain are included. A missed auto-tag is easy to fix; a false positive erodes trust.

| When the text matches…                                                     | Tag added       |
| -------------------------------------------------------------------------- | --------------- |
| `llm`, `gpt`, `claude`, `ollama`, `anthropic`, `prompt(ing)`               | `d:llm`         |
| `agent`, `autonomous`, `workflow`, `automation`, `pipeline`, `orchestrat*` | `d:automation`  |
| `ingest(ion)`, `transcript`, `youtube`, `capture`                          | `d:ingest`      |
| `schema`, `zod`, `validation`                                              | `d:schema`      |
| `cli`, `terminal`, `bash`, `monorepo`, `ci/cd`                             | `d:infra`       |
| `mcp`, `cursor`, `tauri`, `astro`, `obsidian`                              | `d:integration` |
| `ui`, `frontend`, `component`, `layout`, `react`                           | `d:ui`          |
| `llaab`, `self-referential`, `meta`                                        | `d:meta`        |

**Sub-tags:** Not used yet. When a domain accumulates 40+ nodes and you need finer filtering, introduce sub-tags like `d:llm-prompting` or `d:llm-evals` — one level deep via hyphen, never nested hierarchies.

There is no `noInbox` / `noAutoTag` switch in the current API — adjust `capture-idea.ts` if you need those behaviors.

---

### Other entry points in this package

| Export          | File                | Role                                                                                                              |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ingestYouTube` | `ingest-youtube.ts` | YouTube ingestion pipeline (typed `transcript` / `source` nodes; extraction now passes through the control layer) |
| `runSkill`      | `runner.ts`         | Skill runner that now persists real `run` nodes with stage and decision data                                      |

Use these when you move from "capture ideas" to "pull external content" or "execute skills" — they share the same schema and vault conventions as core.
