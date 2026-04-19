# LLAAB — Ideas to Skills

## Skills in `@llaab/skills`

### `captureIdea(title, body?, tags?)`

Fast path from thought to vault. Calls `createNode({ type: 'idea', ... })` with `origin: 'manual'`
and merges lightweight auto-tags.

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

**Output file naming:** `idea.<id>.md` under `vault/nodes/ideas/`.

---

### Extracted ideas (from YouTube ingestion)

Ideas are also created automatically during YouTube transcript ingestion. After the transcript is
saved, `extractKnowledgeFromTranscript` runs the LLM extraction pipeline and creates `IdeaNode`s
for each extracted idea phrase:

```ts
const idea = await createNode({
  type: 'idea',
  title: ideaText,      // 5–15 word phrase from LLM output
  body: '',             // body is empty — the title IS the idea
  origin: 'extracted',
  source_id: transcriptId,
});
```

The body is intentionally empty for extracted ideas — they are seeds. The `source_id` links
back to the transcript they came from, visible on the node detail page at `/vault/nodes/[id]`.

---

### Auto-tagging

Both `captureIdea` and the ingestion pipeline apply `autoTag(title, body)` from `@llaab/core`.
The LLM does **not** generate tags — tags are always programmatic.

| When the text matches…                                             | Tag added       |
| ------------------------------------------------------------------ | --------------- |
| `llm`, `gpt`, `claude`, `ollama`, `anthropic`, `model`, `prompt`   | `d:llm`         |
| `agent`, `autonomous`, `workflow`, `automation`, `pipeline`        | `d:automation`  |
| `ingest`, `ingestion`, `transcript`, `youtube`                     | `d:ingest`      |
| `schema`, `zod`, `validation`, `type`                              | `d:schema`      |
| `cli`, `terminal`, `command`, `script`, `bash`                     | `d:infra`       |
| `mcp`, `cursor`, `tauri`, `astro`, `integration`, `api`, `webhook` | `d:integration` |
| `ui`, `frontend`, `component`, `layout`, `design`                  | `d:ui`          |
| `llaab`, `lab`, `self-referential`, `meta`, `vault`, `knowledge`   | `d:meta`        |

All ingest runs also apply `d:ingest` unconditionally. Source nodes carry no domain tags.

Full taxonomy reference: `docs/taxonomy/TAXONOMY_GUIDE.md`.

---

### Other entry points in `@llaab/skills`

| Export                           | File                         | Role                                                                |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `ingestYouTube`                  | `ingest-youtube.ts`          | Full ingestion pipeline: transcript + source nodes + LLM extraction |
| `extractKnowledgeFromTranscript` | (re-exported from ingestion) | Run extraction on an already-saved transcript — used for retry      |
| `runSkill`                       | `runner.ts`                  | Skill runner — persists `RunNode` with stage and decision trace     |

Use `ingestYouTube` when pulling external content. `extractKnowledgeFromTranscript` is exported
for retry scenarios (e.g. a "Re-extract" button on the transcript detail page).
