# LLAAB — Ideas to skills

## Skills in `@llaab/skills`

### `captureIdea(title, body?, tags?)`

Fast path from thought to vault. Calls `createNode({ type: 'idea', ... })` with `origin: 'manual'`, merges **lightweight auto-tags**, then appends a line to **`INBOX.md`** under the vault root used for the inbox.

```ts
import { captureIdea } from '@llaab/skills';

await captureIdea('Expose vault as MCP server', 'Direct agent access to the knowledge graph.', [
  'integration',
]);
// Logs the new id and file path to the console.
```

**Parameters:**

| Parameter | Default | Description                                        |
| --------- | ------- | -------------------------------------------------- |
| `title`   | —       | Idea title (also drives `toNodeId()` for the file) |
| `body`    | omitted | Optional markdown body                             |
| `tags`    | omitted | Extra tags merged with inferred tags               |

**Vault path for the inbox:** `process.env.LLAAB_VAULT` if set, otherwise `'./vault'` (resolved relative to the current working directory). The idea file itself is still written by `@llaab/core`’s `createNode()`, which uses **`join(process.cwd(), 'vault')`**. Keep cwd and `LLAAB_VAULT` aligned in real usage so the inbox and node files land in the same vault.

**Output file naming:** `idea.<id>.md` under `vault/nodes/ideas/` (when cwd matches your project layout).

---

### Auto-tagging

`captureIdea` infers a few tags from the title and body (regex-based), then unions them with tags you pass in:

| When the text matches…                    | Tag suggested |
| ----------------------------------------- | ------------- |
| `automation` or `agent`                   | `automation`  |
| `ingest`, `transcript`, or `youtube`      | `ingestion`   |
| `schema` or `zod`                         | `schema`      |
| `llm`, `ollama`, `anthropic`, or `prompt` | `llm`         |

There is no `noInbox` / `noAutoTag` switch in the current API — adjust `capture-idea.ts` if you need those behaviors.

---

### Other entry points in this package

| Export          | File                | Role                                                                                     |
| --------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `ingestYouTube` | `ingest-youtube.ts` | YouTube ingestion pipeline (typed `transcript` / `source` nodes; see `SCHEMAS_ADDED.md`) |
| `runSkill`      | `runner.ts`         | Skill runner (execution; `run` node persistence is still limited — see schema notes)     |

Use these when you move from “capture ideas” to “pull external content” or “execute skills” — they share the same schema and vault conventions as core.
