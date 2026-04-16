# TODO — LLM Communication Layer (Local + Remote)

> **Status:** Not started. Depends on `apps/server` existing.
> See `TODO_APP_SERVER.md` for the server prerequisite.

---

## Context

All LLM calls currently happen inline inside `@llaab/ingestion` (via `llmExtractWithTrace`).
This works for one-shot extraction but doesn't scale to:

- Long-running / streaming responses
- Agent-triggered calls (no browser involved)
- Local model routing (Ollama) vs. cloud (Anthropic)
- Caching / batching

The goal is a dedicated LLM layer in `apps/server` that the client, CLI, and agents all call
the same way, without importing provider SDKs directly.

---

## Mental model: Router → Workers

```
incoming task
   ↓
LLM Router (apps/server /api/llm)
   ├── trivial (format, lint-like)   → local small  (Ollama 3B–8B)
   ├── coding / architecture         → local mid    (Ollama 10B–20B)
   └── deep reasoning / important    → remote API   (Anthropic Claude)
```

The router is deterministic config, not autonomous — explicit routing rules, not a planning LLM.
This aligns with the "explicit over implicit" principle throughout the codebase.

---

## Key design decisions (from research)

**Ollama is the right local runner.** Dead simple DX, scriptable, integrates cleanly with TS.
No LM Studio (worse automation), no vLLM (overkill for solo dev).

**Local ≠ replacement for API.** Mental model:

- Local = cheap, fast, good-enough (like `eslint --fix`)
- API = smart, expensive, precise (like a senior architect)

**Avoid always-on agents.** Background loops + continuous indexing quietly drain resources —
power cost is real even when models are idle. Trigger explicitly; don't poll. This is a
hard project rule: see `.github/instructions/project/13-agent-execution.instructions.md`.

**Batch and cache aggressively.** Avoid recomputing embeddings or summaries for content that
hasn't changed. Cache responses keyed by content hash (already implemented in `@llaab/llm`).

---

## Proposed structure

```
apps/server/src/routes/llm/
  llm.routes.ts      ← route definitions + Zod schemas
  llm.handlers.ts    ← handler implementations
  index.ts           ← wires routes to handlers

packages/llm/src/   (already exists — @llaab/llm)
  providers/
    anthropic.ts     ← existing Anthropic provider
    ollama.ts        ← existing Ollama provider (check what's there)
  router.ts          ← NEW: TaskRouting config + route() function
  cache.ts           ← NEW: response cache (keyed by content hash)
```

---

## TaskRouting config

```ts
type TaskType = 'format' | 'extract' | 'code' | 'reason';

interface TaskRouting {
  type: TaskType;
  model: 'local-small' | 'local-mid' | 'remote';
}

const ROUTING: Record<TaskType, TaskRouting['model']> = {
  format:  'local-small',
  extract: 'local-mid',
  code:    'local-mid',
  reason:  'remote',
};
```

Start with `extract` → `local-mid` (replaces the current Anthropic call in `llmExtractWithTrace`
for lower-stakes summaries). Keep `reason` → `remote` for anything that needs quality.

---

## API endpoints (apps/server)

| Method | Path                | Description                             |
| ------ | ------------------- | --------------------------------------- |
| POST   | `/api/llm/complete` | Single completion — routed by task type |
| POST   | `/api/llm/stream`   | SSE streaming completion                |
| GET    | `/api/llm/models`   | List available local models from Ollama |

Request schema:

```ts
z.object({
  task:    z.enum(['format', 'extract', 'code', 'reason']),
  prompt:  z.string(),
  context: z.object({ files: z.array(z.string()) }).optional(),
  model:   z.string().optional(), // override routing
})
```

---

## Implementation phases

1. **Router config** — `packages/llm/src/router.ts` with `TaskRouting` map and `routeLlm()` fn
2. **Ollama provider** — verify `@llaab/llm` has Ollama wired; add streaming support if missing
3. **Cache layer** — SHA-256 keyed cache for extract/summarize calls; TTL = 24h
4. **Server routes** — `/api/llm/complete` + `/api/llm/stream` in `apps/server`
5. **Migrate ingestion** — replace inline Anthropic call in `llmExtractWithTrace` with a call
   to the server's LLM route (or direct router call if in-process is preferred)

---

## Power / resource notes

- Light usage → negligible cost
- Heavy agent workflows (continuous indexing, long loops) → can rival a gaming session
- **Default to 3B–8B Ollama models** for daily tasks; escalate to API for quality-sensitive work
- No always-on background loops — trigger explicitly
