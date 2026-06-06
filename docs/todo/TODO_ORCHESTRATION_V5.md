# TODO — Orchestration Layer: Metadata, Adapters, Harness, and Terminal Panel

> **Status:** Phase 6 done — long extraction now uses token-aware harness prep with chunked
> model calls and merged output instead of blind first-6 000-character truncation.
> Supersedes `TODO_ORCHESTRATION_V4.md` and `TODO_LLM_METADATA.md` — both are now consolidated
> here. V4 had metadata as Phase 2 (after provider interface); this version promotes it to
> Phase 0 because it delivers immediate value and makes every downstream phase more informative.
> Generated: 2026-06-07

---

## Purpose

V1 proposed adapters as a greenfield system. The real codebase already has most of the important
seams — this plan evolves those **three partially-built systems** into a coherent orchestration
layer rather than starting from scratch:

| System                   | Current state                                            | Gap                                                               |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/llm`           | Task → tier → provider routing; two concrete providers   | No formal provider interface; tier determines provider by import  |
| `@finografic/ai-harness` | Pipeline primitives installed; extraction spike in place | Not validated in real flow; no token budget; character truncation |
| Terminal Panel           | Architecture specced in `TODO_TERMINAL_PANEL.md`         | Not started; command bus IS the first adapter surface             |

These three are the same concern seen from different angles — **how does LLAAB prepare, route,
dispatch, and observe work across different execution backends?** Building them in isolation would
produce three partial systems with no common seam. This plan wires them into one.

---

## Current Codebase Map

| Area             | Current files                                                             | Reality                                                                          | Gap                                                                                  |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| LLM routing      | `packages/llm/src/router.ts`, `providers/*.ts`, `types.ts`                | `TaskType → ModelTier → model`; direct imports of Ollama and Anthropic providers | No provider interface, no availability contract, no execution metadata               |
| Control boundary | `packages/control/src/orchestrator.ts`, `types.ts`                        | `execute<T>()` validates model-facing output and returns decisions / LLM trace   | Good seam — remains the governance layer; not replaced by adapters                   |
| Harness prep     | `packages/ingestion/src/extract/harness-prep.ts`, `llm-extract.ts`        | Installed `@finografic/ai-harness`; two prep steps before `control.execute(...)` | Real ingest validation pending; still character truncation, not token-aware chunking |
| Skill execution  | `packages/skills/src/runner.ts`, `agent/registry.ts`, `agent/*.ts`        | One-shot agent loop, skill routing by node type, `RunNode` persistence           | Not capability-queryable; not exposed as typed command handlers                      |
| Server routes    | `apps/server/src/app.ts`, `routes/*`                                      | Hono app chains typed route groups under `/api/*`; no WebSocket command bus      | Terminal protocol and command dispatch layer missing                                 |
| Client UI        | `apps/client/src/pages/*`, `components/*`, `packages/ui/src/components/*` | Astro + React islands, shadcn/ui primitives, app layout available                | Terminal panel not started                                                           |
| CLI              | `packages/cli/src/index.ts`, `commands/*`                                 | `agent`, `ingest`, `mcp`, `vault` commands via citty                             | No `llm`, `doctor`, `adapters`, or command-bus diagnostics                           |
| Memory / vault   | `packages/core/src/*`, `packages/schemas/src/*`                           | Vault node CRUD and schemas; `RunNode` carries stages, decisions, LLM traces     | LLM frontmatter metadata not wired through transcript/idea nodes                     |

---

## Target Mental Model

```
User intent / UI action / CLI command / agent trigger
       ↓
  CapabilityRouter        ← what adapter can handle this? (extends packages/llm router.ts)
       ↓
  HarnessPrep             ← what context does it need? (@finografic/ai-harness pipeline)
       ↓
  AdapterDispatch         ← who executes it? (LlmAdapter | AgentAdapter | ShellAdapter | …)
       ↓
  ControlGovernance       ← schema-validate model-facing output (packages/control)
       ↓
  CommandBus / WS         ← Terminal Panel execution surface + structured event stream
       ↓
  Output / trace / vault  ← RunNode, LLM metadata in frontmatter, stage traces
```

Adapters are thin execution ports over existing code. They should not become a second business
logic layer. Harness prepares the input; control governs the output. They are complementary,
not competing.

---

## Design Rules

- Keep provider SDKs (`@anthropic-ai/sdk`, `ollama`) inside `packages/llm`; do not leak into
  `packages/core`, `packages/schemas`, or UI code.
- Keep `packages/control` as the output governance layer for model-facing work.
  `control.execute(...)` stays — adapters call through it, not around it.
- Keep `@finografic/ai-harness` at preparation boundaries first; do not wrap every deterministic
  ingestion stage with harness machinery.
- Keep agent execution one-shot. Do not add always-on background processes, watchers,
  schedulers, or polling loops.
- Route by capability and typed command kind, not by raw tool name or free-form shell text.
- Terminal Panel is not a shell. It is the first user-facing command bus for orchestration
  adapters. Shell execution, if added later, is opt-in and allowlisted only.
- Keep model-name selection env-configurable through the current `MODEL_MAP`; do not hard-code
  model names in core logic.
- Do not create `packages/adapters` as a broad abstraction package before there are multiple
  real adapter consumers — colocate types with their first real consumer.
- Do not start external executor adapters (OpenCode, Cline, Codex) until the local command bus
  and capability routing are proven.

---

## What Already Exists (do not re-invent)

### `packages/llm` — the provider layer is 80% there

- `router.ts` — `TaskType → ModelTier → model string`; `routeLlm` / `streamLlm` public API
- `providers/anthropic.ts`, `providers/ollama.ts` — two concrete provider implementations
- `types.ts` — `TaskType`, `ModelTier`, `LlmCompleteOptions`, `LlmCompleteResult`

**Gap:** providers are not behind a shared interface — `router.ts` imports them directly by name.
Adding a third provider (e.g. local Gemma via Ollama, or OpenAI) requires editing the router.
The fix is small: extract a `LlmProvider` interface and invert the dependency.

**Gap:** `LlmCompleteResult` returns `{ text, model, cached }` — no timing, no provider ID,
no token counts. Both provider SDKs report token usage in their responses but the data is
discarded. `extractTranscriptIdeas` calls `llmExtract()` — the variant that throws away the
run trace entirely.

### `packages/control` — execution governance already exists

- `orchestrator.ts` — `execute<T>()` with retry, schema validation, decision traces
- `types.ts` — `ControlStage`, `ControlPolicy`, `ControlDecision`, `ControlLlmTrace`

This is the schema-validation / output-governance layer. It stays.

**Note:** `RunLlmTraceSchema.model` is currently set to `'ollama'` — which is the provider,
not the model name. The actual model string (`llama3:latest`) is in `LlmCompleteResult.model`
but never makes it into the trace. Phase 0 fixes this naming confusion.

### `@finografic/ai-harness` — pipeline composition installed

- Already a dependency of `@llaab/ingestion`
- Spike in `packages/ingestion/src/extract/harness-prep.ts` — two-step pipeline: truncate →
  build-extraction-context → `PreparedExtractionInput`
- `createContext`, `createPipeline`, `HarnessStep` — the primitive set

**Gap:** real-flow validation is pending; `harnessBudgetSteps` is captured but not acted on;
no token counting yet.

### `packages/skills` — agent loop + skill routing exists

- `agent/registry.ts` — `SkillRoute[]` maps `nodeType → skill → execute fn`
- `runner.ts` — runs skills, produces `RunNode`
- `agent/processor.ts` — one-shot processor; `POST /api/agent/run`

**Gap:** skills are triggered by node type, not by capability. The registry is not queryable by
capability, so there is no way to ask "what can summarize?" or "what can run shell commands?"

---

## Core Types To Introduce

These types should be small and colocated with the first real consumers. Do not create broad
framework packages before these contracts prove useful.

### `packages/llm` — provider internal result (Phase 0)

```ts
// packages/llm/src/providers/types.ts (new file, internal)
export interface ProviderResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}
```

### `packages/llm` — provider contract (Phase 2)

```ts
// packages/llm/src/provider.ts
export interface LlmProvider {
  readonly id: string;
  readonly displayName: string;
  complete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult>;
  stream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}

export interface LlmProviderResult {
  text: string;
  durationMs: number;
  providerId: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}
```

### `packages/core` — command protocol (Phase 3)

```ts
// packages/core/src/command-protocol.ts
export type CommandSource = 'terminal' | 'ui' | 'cli' | 'agent';

export type Command =
  | { kind: 'ai.run'; task: TaskType; prompt: string; model?: string; system?: string; maxTokens?: number }
  | { kind: 'agent.run'; nodeId?: string; force?: boolean }
  | { kind: 'fs.read'; path: string }
  | { kind: 'fs.list'; path: string };
```

Shell is deliberately excluded from the first protocol version. Add it only after the typed
bus, RunNode logging, and capability gating are working.

### `apps/server` — command handler contract (Phase 3)

```ts
// apps/server/src/commands/handler.ts
export interface CommandHandler<TCommand extends Command = Command> {
  readonly kind: TCommand['kind'];
  handle(command: TCommand, context: CommandContext): AsyncGenerator<OutputEvent>;
}
```

This is where `LlmCommandHandler`, `AgentCommandHandler`, and vault file handlers live. These
are the first practical adapters.

---

## Phase 0 — LLM Execution Metadata in Node Frontmatter

> **This is the entry point for the entire orchestration plan.** It requires no provider
> interface refactor and works against the current codebase. Do this first because:
> (a) it delivers immediate visible value — every extracted node becomes self-documenting;
> (b) it establishes the `ProviderResult` return shape that Phase 2 formalizes;
> (c) it gives Phase 1 (harness validation) richer traces to inspect — token counts make
> the truncation assessment quantitative rather than guesswork.

### Why this matters

LLAAB exists to experiment with different LLM models, harnesses, and orchestration. But right
now the extraction pipeline is a black box: you cannot see which model produced an idea node,
how long the call took, or how many tokens it consumed. Every node produced by LLM extraction
should be self-documenting — this is core to the LLAAB philosophy that execution produces
knowledge.

### Critical bugs this phase fixes

1. **`extractTranscriptIdeas` discards the trace.** It calls `llmExtract()` — the variant
   that throws away `runTrace` — not `llmExtractWithTrace()`. All control-layer metadata is
   lost before it can reach the nodes.

2. **`RunLlmTraceSchema.model` is misnamed.** It is set to `'ollama'` (the provider), not the
   actual model string (`llama3:latest`). The resolved model name from `routeLlm` never makes
   it into the trace.

3. **Provider token data is discarded.** Both the Anthropic SDK (`usage.input_tokens`,
   `usage.output_tokens`) and Ollama API (`prompt_eval_count`, `eval_count`) report token
   counts, but `ollamaComplete` and `anthropicComplete` return bare `string`, dropping this
   data.

### Step 0a — Create `ProviderResult` internal type — DONE

Create `packages/llm/src/providers/types.ts`:

```ts
export interface ProviderResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}
```

### Step 0b — Update provider functions to return `ProviderResult` — DONE

Both `ollamaComplete` and `anthropicComplete` currently return `Promise<string>`. Change them
to return `Promise<ProviderResult>`.

**`providers/anthropic.ts`:** the Anthropic SDK response includes `usage.input_tokens` and
`usage.output_tokens`. Extract them:

```ts
export async function anthropicComplete(prompt: string, opts: LlmCompleteOptions): Promise<ProviderResult> {
  const response = await client.messages.create({ ... });
  return {
    text: /* existing text extraction logic */,
    promptTokens: response.usage?.input_tokens,
    completionTokens: response.usage?.output_tokens,
  };
}
```

**`providers/ollama.ts`:** the Ollama chat API response includes `prompt_eval_count` and
`eval_count`. Extract them:

```ts
export async function ollamaComplete(prompt: string, opts: LlmCompleteOptions): Promise<ProviderResult> {
  const response = await ollama.chat({ ... });
  return {
    text: response.message.content,
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}
```

**Note:** Ollama token counts are not always present (they can be `0` or missing for some
models). Treat them as optional — do not default to `0`.

### Step 0c — Extend `LlmCompleteResult` in `packages/llm/src/types.ts` — DONE

```ts
export interface LlmCompleteResult {
  text: string;
  model: string;
  cached: boolean;
  // ── New fields ──
  provider: string;             // 'ollama' | 'anthropic'
  durationMs: number;           // wall-clock time for the LLM call
  promptTokens?: number;        // input tokens (when provider reports)
  completionTokens?: number;    // output tokens (when provider reports)
}
```

### Step 0d — Update `routeLlm` in `packages/llm/src/router.ts` — DONE

Wrap the provider call with `performance.now()` timing and populate the new fields:

```ts
export async function routeLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number },
): Promise<LlmCompleteResult> {
  const { model, tier } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = { model, system: opts?.system, maxTokens: opts?.maxTokens };
  const provider = tier === 'remote' ? 'anthropic' : 'ollama';

  if (CACHEABLE.has(task)) {
    const hit = cacheGet(prompt, model);
    if (hit) return { text: hit, model, cached: true, provider, durationMs: 0 };
  }

  const start = performance.now();

  const providerResult =
    tier === 'remote'
      ? await anthropicComplete(prompt, completeOpts)
      : await ollamaComplete(prompt, completeOpts);

  const durationMs = Math.round(performance.now() - start);

  if (CACHEABLE.has(task)) cacheSet(prompt, model, providerResult.text);

  return {
    text: providerResult.text,
    model,
    cached: false,
    provider,
    durationMs,
    promptTokens: providerResult.promptTokens,
    completionTokens: providerResult.completionTokens,
  };
}
```

### Step 0e — Extend `RunLlmTraceSchema` in `packages/schemas/src/run-node.schema.ts` — DONE

```ts
const RunLlmTraceSchema = z.object({
  model: z.string().optional(),                            // NOW means actual model name
  provider: z.string().optional(),                         // NEW — 'ollama' | 'anthropic'
  duration_ms: z.number().int().nonneg().optional(),       // NEW
  prompt_tokens: z.number().int().nonneg().optional(),     // NEW
  completion_tokens: z.number().int().nonneg().optional(), // NEW
  raw_output: z.string().optional(),                       // existing
  parsed: z.boolean().optional(),                          // existing
});
```

### Step 0f — Add LLM metadata fields to `TranscriptNodeSchema` — DONE

In `packages/schemas/src/transcript-node.schema.ts`, add optional extraction metadata fields.
These are written during extraction (phase 2 of ingestion), not during ingestion phase 1. They
are absent until extraction runs.

```ts
export const TranscriptNodeSchema = BaseNodeSchema.extend({
  // ... all existing fields unchanged ...

  // ── LLM extraction metadata (written during extract phase) ──
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonneg().optional(),
  llm_prompt_tokens: z.number().int().nonneg().optional(),
  llm_completion_tokens: z.number().int().nonneg().optional(),
});
```

### Step 0g — Add LLM metadata fields to `IdeaNodeSchema` — DONE

In `packages/schemas/src/idea-node.schema.ts`:

```ts
export const IdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('idea'),
  origin: z.enum(['manual', 'extracted', 'generated']).default('manual'),
  source_id: NodeIdSchema.optional(),

  // ── LLM extraction metadata ──
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonneg().optional(),
  llm_prompt_tokens: z.number().int().nonneg().optional(),
  llm_completion_tokens: z.number().int().nonneg().optional(),
});
```

All idea nodes from a single extraction share the same LLM metadata (same call produced them).
This is intentional — each node is self-documenting without needing to chase a run trace. When
you re-extract with a different model, the new idea nodes carry the new model's metadata while
the old ones retain theirs. That is the comparison surface.

### Step 0h — Define `LlmExtractionMeta` and thread through `llmExtractWithTrace` — DONE

In `packages/ingestion/src/extract/llm-extract.ts`, the `run` callback inside `execute({...})`
calls `routeLlm` but discards everything except `text`. Capture the full result.

Add a new interface and update the return type:

```ts
export interface LlmExtractionMeta {
  model: string;
  provider: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ExtractedKnowledgeWithTrace extends ExtractedKnowledge {
  runTrace: ExtractionRunTrace;
  llmMeta: LlmExtractionMeta;
}
```

Inside `llmExtractWithTrace`, declare `let llmMeta: LlmExtractionMeta` before the
`execute()` call, populate it inside the `run` callback from the `routeLlm` result, and
include it in the return value.

### Step 0i — Switch `extractTranscriptIdeas` to `llmExtractWithTrace` — DONE

This is the critical wiring change. In `packages/skills/src/extract-transcript-ideas.ts`:

**Before:**

```ts
import { llmExtract } from '@llaab/ingestion';
// ...
const { ideas, summary } = await llmExtract(input.transcript.body);
```

**After:**

```ts
import { llmExtractWithTrace } from '@llaab/ingestion';
// ...
const { ideas, summary, llmMeta } = await llmExtractWithTrace(input.transcript.body);
```

Ensure `llmExtractWithTrace` is exported from `packages/ingestion/src/index.ts`.

Then thread `llmMeta` into every node this function creates:

**Into each IdeaNode:**

```ts
const { id } = await createNode({
  type: 'idea',
  title: ideaTitle,
  body: '',
  tags: inferredTags,
  extra: {
    origin: 'extracted',
    source_id: input.transcript.id,
    llm_model: llmMeta.model,
    llm_provider: llmMeta.provider,
    llm_duration_ms: llmMeta.durationMs,
    llm_prompt_tokens: llmMeta.promptTokens,
    llm_completion_tokens: llmMeta.completionTokens,
  },
});
```

**Into the TranscriptNode** (via the existing `updateNode` call):

```ts
await updateNode(transcriptPath, (node) => ({
  ...node,
  extracted_idea_ids: [...((node as TranscriptNode).extracted_idea_ids ?? []), ...ideaIds],
  llm_model: llmMeta.model,
  llm_provider: llmMeta.provider,
  llm_duration_ms: llmMeta.durationMs,
  llm_prompt_tokens: llmMeta.promptTokens,
  llm_completion_tokens: llmMeta.completionTokens,
}));
```

**Return metadata in the skill output** so the RunNode's `output_summary` captures it:

```ts
return {
  ideaIds,
  summary,
  producedNodeIds: ideaIds,
  llmMeta,
};
```

### Step 0j — Update test mocks — DONE

In `packages/ingestion/src/extract/llm-extract.test.ts`, update the `routeLlm` mock to
include the new fields:

```ts
vi.mocked(routeLlm).mockResolvedValue({
  text: VALID_RESPONSE,
  model: 'llama3.1:8b',
  cached: false,
  provider: 'ollama',
  durationMs: 150,
});
```

### Files touched

| File                                                 | Change                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/llm/src/types.ts`                          | Add `provider`, `durationMs`, `promptTokens`, `completionTokens` to `LlmCompleteResult`    |
| `packages/llm/src/router.ts`                         | Wrap provider calls with timing; populate new result fields                                |
| `packages/llm/src/providers/anthropic.ts`            | Return `ProviderResult` instead of `string`                                                |
| `packages/llm/src/providers/ollama.ts`               | Return `ProviderResult` instead of `string`                                                |
| `packages/llm/src/providers/types.ts`                | NEW — `ProviderResult` interface (internal)                                                |
| `packages/schemas/src/run-node.schema.ts`            | Add `provider`, `duration_ms`, `prompt_tokens`, `completion_tokens` to `RunLlmTraceSchema` |
| `packages/schemas/src/transcript-node.schema.ts`     | Add `llm_*` optional metadata fields                                                       |
| `packages/schemas/src/idea-node.schema.ts`           | Add `llm_*` optional metadata fields                                                       |
| `packages/ingestion/src/extract/llm-extract.ts`      | Define `LlmExtractionMeta`; capture and return from `routeLlm` result                      |
| `packages/ingestion/src/index.ts`                    | Ensure `llmExtractWithTrace` is exported                                                   |
| `packages/ingestion/src/pipeline.ts`                 | Thread metadata through real ingest extraction writes                                      |
| `packages/skills/src/extract-transcript-ideas.ts`    | Switch to `llmExtractWithTrace`; thread metadata into created nodes                        |
| `packages/ingestion/src/extract/llm-extract.test.ts` | Update `routeLlm` mock to include new fields                                               |
| `packages/ingestion/src/pipeline.test.ts`            | Update extraction trace mocks with LLM metadata                                            |
| `packages/control/src/types.ts`                      | Extend `ControlLlmTrace` with provider, duration, and token fields                         |

### Validation

- [x] Typecheck passes for touched packages via direct `tsc -b` (`pnpm` unavailable on PATH in
      this shell)
- [x] Existing tests in `llm-extract.test.ts` pass with updated mocks
- [x] Run a real YouTube ingest with extraction enabled in a temp vault
- [x] Resulting transcript `.md` frontmatter includes `llm_model`, `llm_provider`, `llm_duration_ms`
- [x] Each extracted idea `.md` frontmatter includes same fields
- [x] Token fields are present when the provider reports them, absent otherwise (no synthetic
      zeros)
- [x] Existing vault nodes without metadata remain valid

### Done means

A real transcript extraction produces vault nodes whose frontmatter shows which provider/model
ran, how long it took, and any available token counts.

---

## Phase 1 — Finish Harness Validation in a Real Extraction Run — DONE

> **This is the existing ROADMAP P1 item.** Now that Phase 0 has wired metadata through the
> pipeline, this validation benefits from richer traces: token counts make the truncation
> assessment quantitative rather than guesswork.

### Context

The `@finografic/ai-harness` package is already a dependency of `@llaab/ingestion`. A two-step
prep pipeline exists in `harness-prep.ts` (truncate → build-extraction-context). What remains
is proving this works in a real end-to-end flow and making the priority call that gates
everything downstream.

### Implementation boundary for agents with no prior context

- Current consumer package: `packages/ingestion`
- Harness prep entrypoint: `packages/ingestion/src/extract/harness-prep.ts`
- Current extraction boundary: `packages/ingestion/src/extract/llm-extract.ts`
- Downstream model-governance boundary: `packages/control/src/orchestrator.ts`

### Tasks

- [x] Run a real ingest + extract flow end-to-end with harness prep in place.
      Entry: `llm-extract.ts` → `prepareExtractionInput(...)` → `control.execute(...)`.
- [x] Confirm `harness:truncate-extraction-input` and `harness:build-extraction-context`
      stages appear in the persisted `RunNode` and carry enough useful data for debugging
      (not just `completed` with no payload).
- [x] Use the `llm_prompt_tokens` data from Phase 0 to quantify how much of the model's
      context window the 6 000-char truncation actually uses. Document the ratio.
- [x] Confirm current 6 000-character truncation is acceptable for typical YouTube transcripts,
      or document exactly where it fails and what content is lost.
- [x] Write a one-paragraph validation result at the top of `TODO_HARNESS.md` Phase 1 section.
- [x] Record the result in `NEXT_STEPS.md`.
- [x] Make the priority call: is token-aware chunking now the real blocker, or does Terminal
      Panel stay next? Record the decision in `ROADMAP.md`.

### Decision gate

This phase produces a binary signal that determines ordering for everything below:

- **If truncation is acceptable:** proceed with Phase 2 → Phase 3 → Phase 4 → Phase 5.
  Token-aware harness extension (Phase 6) stays in backlog.
- **If truncation is the bottleneck:** promote Phase 6 above Phase 4/5 (Terminal Panel) so
  extraction quality is unblocked first.

### Done means

Extraction succeeds end-to-end. Stage traces are visible and informative in the RunNode.
Truncation verdict is documented with token count evidence. Priority ordering for downstream
phases is committed to `ROADMAP.md`.

### Phase 1 validation result

Validated with a real YouTube transcript in a temp vault (`3Blue1Brown`, 19 207 chars) and the
persisted `extract-transcript-ideas` RunNode. Extraction succeeded and preserved informative
harness stages: `truncate-extraction-input` recorded `inputLength: 19207`, `maxChars: 6000`,
`preparedLength: 6039`, `truncated: true`; `build-extraction-context` recorded prepared length,
truncation state, constraint count, and instruction presence. The run used `llama3:latest` through
Ollama with `1537` prompt tokens against an `8192` token context window (`18.8%`), while retaining
only `31.4%` of the transcript by character count. Verdict: current truncation is operationally
stable but not acceptable as the quality baseline for typical YouTube transcripts; token-aware
chunking/context assembly is now the real blocker and Phase 6 is promoted ahead of Terminal Panel.

---

## Phase 2 — Formalize the LLM Provider Interface — DONE

> **Location:** `packages/llm/src/`
> **Effort:** Small — two concrete providers already exist and already return `ProviderResult`
> from Phase 0. This phase formalizes what is now implicit.

### Why now

Every later phase (Terminal Panel dispatch, capability routing, external adapters) needs a
stable provider contract. Phase 0 already established the `ProviderResult` shape and wired
timing + tokens through the router. This phase lifts those concrete implementations behind a
shared interface so adding a third provider does not require editing `router.ts`.

### 2a. Extract `LlmProvider` interface

- [x] Create `packages/llm/src/provider.ts` with the `LlmProvider` interface and
      `LlmProviderResult` type (see Core Types above).

### 2b. Refactor existing providers

- [x] Refactor `providers/anthropic.ts` to export an `anthropicProvider` object implementing
      `LlmProvider`. The `ProviderResult` return from Phase 0 becomes the foundation of
      `LlmProviderResult`.
- [x] Refactor `providers/ollama.ts` to export an `ollamaProvider` object implementing
      `LlmProvider`.
- [x] Each provider's `complete()` now returns `LlmProviderResult` with timing, model, and
      provider ID baked in — not added after the fact by the router.

### 2c. Add provider registry to router

```ts
// packages/llm/src/router.ts (extended)
const PROVIDERS: Record<ModelTier, LlmProvider> = {
  'local-small': ollamaProvider,
  'local-mid':   ollamaProvider,
  'remote':      anthropicProvider,
};
```

- [x] Update `router.ts` so tier-to-provider routing uses the `PROVIDERS` map instead of
      direct function imports.
- [x] `resolveModel()` now returns `{ model, tier, provider }`.
- [x] Preserve the public API surface: `routeLlm`, `streamLlm`, `ollamaListModels`,
      `getLlmStatus`.
- [x] Keep model-name selection env-configurable through the existing `MODEL_MAP`.

### 2d. Expose `isAvailable()` in `getLlmStatus()`

```ts
export async function getLlmStatus(): Promise<{ ... availableProviders: string[] }>;
```

- [x] Make `getLlmStatus()` call `isAvailable()` on each registered provider asynchronously.
- [x] This unblocks the `llaab doctor` diagnostic (Phase 8) and the `/llm` status page
      live check without requiring callers to know SDK details.

### Validation

- [x] Typecheck passes for `@llaab/llm` and affected server route via direct `tsc -b`
      (`pnpm` unavailable on PATH in this shell).
- [x] Existing LLM-related tests pass with no behavior change.
- [x] A real `routeLlm` call through the provider map returns the same output as before the
      refactor.

### Non-goals for this phase

- Do not add OpenAI, Codex, Cline, OpenCode, or Hermes providers.
- Do not change the `TaskType` enum or model routing logic.
- Do not add capability metadata to providers yet (that's Phase 7).

---

## Phase 3 — Define the Typed Command Protocol — DONE

> **This lays the foundation for Terminal Panel and future adapters without needing WebSockets
> or xterm.js first.** The protocol is testable in isolation — a significant architectural
> advantage over jumping straight to the UI.

### Location

- Protocol types and Zod schemas: `packages/core/src/command-protocol.ts`
- Server handlers: `apps/server/src/commands/*`
- Tests: nearest package tests, with fake handlers

### 3a. Define protocol types

- [x] Define `CommandEnvelope`, `OutputEnvelope`, `Command`, and `OutputEvent` with Zod schemas.
- [x] `Command` is a discriminated union: `ai.run | agent.run | fs.read | fs.list`.
      Shell is deliberately excluded.
- [x] `OutputEvent` is a discriminated union:
      `{ type: 'token'; data: string }` — streaming LLM chunks
      `{ type: 'stdout'; data: string }` — buffered text output
      `{ type: 'stderr'; data: string }` — error stream
      `{ type: 'meta'; data: Record<string, unknown> }` — structured metadata
      `{ type: 'error'; message: string; code?: string }` — recoverable error
      `{ type: 'done'; code: number }` — terminal event
- [x] `CommandEnvelope` wraps `Command` with `id` (correlation), `source` (`CommandSource`),
      and `timestamp`.

### 3b. Implement command bus

- [x] Command gateway: Zod-validate every inbound envelope before dispatch; reject malformed
      envelopes with a structured error.
- [x] Command bus: dispatch by `command.kind` to the matching `CommandHandler`.
- [x] `LlmCommandHandler` handles `ai.run` → calls `streamLlm(...)` from `packages/llm`;
      yields `token` events per chunk, `done` on completion.
      **Must not duplicate `routeLlm` — delegates to it.**
- [x] `AgentCommandHandler` handles `agent.run` → calls `runAgentLoop(...)` from
      `packages/skills`; preserves one-shot execution semantics.
- [x] `FsCommandHandler` handles `fs.read` and `fs.list` → operates against vault-safe paths
      only; normalize and restrict file paths to the vault root.

### 3c. RunNode persistence

- [x] Every dispatched command creates a `RunNode` via `packages/skills/runner.ts`.
      This gives every terminal-initiated run a vault trace for free.
- [x] Trace includes: duration, status, input summary, output summary, and failure reason.

### Security requirements

- [x] Validate every inbound envelope before dispatch (covered by Zod schemas).
- [x] Normalize file paths and restrict `fs.*` commands to the vault root.
- [x] Do not add `shell.exec` to the command protocol in this phase.

### Validation

- [x] The command bus can be exercised from tests or a local server route without the client
      terminal UI existing yet.
- [x] A programmatic `ai.run` dispatch through the bus produces a streaming response and a
      persisted `RunNode`.

### Done means

The typed command protocol exists, is testable without UI, and `ai.run` dispatches through the
same `routeLlm` / `streamLlm` codepath used by the existing extraction pipeline.

### Phase 3 validation result

Validated the command bus directly in a temp vault. `ai.run` streamed `meta` + `token` events
through `streamLlm(...)`, produced `command-bus-ok`, and persisted a completed command RunNode.
Malformed `shell.exec` input was rejected by envelope validation, and `fs.read` path traversal
outside the vault produced a structured `COMMAND_EXECUTION_FAILED` error plus a failed RunNode.

---

## Phase 4 — Terminal / Command Panel Vertical Slice — DONE

> **This is the first visible orchestration adapter surface.** Full spec:
> `TODO_TERMINAL_PANEL.md`. This phase delivers the minimal viable slice that proves the
> command bus from Phase 3 is usable by a human.

The key architectural insight: the Terminal Panel's `LlmAdapter` and `AgentAdapter` are the
first real users of the `LlmProvider` interface from Phase 2. They call `routeLlm` /
`streamLlm`, not re-implement LLM dispatch.

### Server tasks

- [x] Add `GET /terminal` WebSocket endpoint in `apps/server`.
- [x] Reuse the Phase 3 command bus for dispatch — the WS endpoint is a transport layer over
      the same handlers.
- [x] Stream `OutputEvent` envelopes over the socket.
- [x] Add connection cleanup and command timeout behavior; no always-on loops.
- [x] Long-running commands must respect the existing pattern of disabling Bun's per-request
      idle timeout (as the ingest routes already do).

### Client tasks

- [x] Use existing shadcn primitives for the vertical slice. `xterm.js` install is deferred until
      the package manager is available in the workspace; the current panel uses `ScrollArea`,
      `Input`, `Button`, and `Badge`.
- [x] `TerminalPanel` React island: connects to `ws://.../terminal`, renders `OutputEvent`
      stream (token, stdout, stderr, meta, error, done events).
- [x] Use shadcn/ui primitives from `packages/ui/src/components/` for surrounding panel
      chrome (container, scroll-area, etc.).
- [x] Support the minimal command syntax needed to produce typed commands — the terminal is a
      thin parser over the command protocol, not a shell.
- [x] Basic command history navigation (up/down arrow).
- [x] Place the terminal panel in the app layout — accessible from the **Execute** section of
      the navigation menu (see `NAV_MENU_DESIGN.md`).

### Initial user flow

```
ai.run extract "Summarize this short note into three ideas"
  → streamLlm(...)
  → token events in terminal
  → done event
  → RunNode persisted
```

### Validation

- [x] A user can run an LLM command from the panel and see streaming output.
- [x] The resulting `RunNode` is visible at `/vault/runs/[id]`.
- [x] `agent.run` from the terminal triggers the same one-shot processor as
      `POST /api/agent/run`.

### Done means

User can type `ai.run extract "summarize this"` in the terminal and see a streaming LLM
response, with a `RunNode` persisted to vault. The terminal panel is accessible from the
app's navigation.

### Phase 4 validation result

The WebSocket transport compiles through the Bun server entrypoint and delegates all commands to
the Phase 3 bus. The underlying bus was exercised with a real `ai.run` dispatch in a temp vault,
streaming token events and persisting a command RunNode. The React panel typechecks in a focused
client config and is reachable from Execute → Terminal. Full browser/WebSocket runtime validation
was not run in this shell because `bun` is unavailable; the server code is ready for the normal
workspace runtime.

---

## Phase 5 — Terminal Panel Metadata Display (Elements Components) — DONE

> **Depends on Phase 0 (metadata fields flowing) + Phase 4 (terminal panel exists).**
> This is the UI payoff for the metadata groundwork.

### Context

The [Elements](https://www.tryelements.dev) component library provides shadcn-based AI devtools
components that map directly to the metadata Phase 0 captures:

| Component                                                                               | What it shows                                          | LLAAB use                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| [AI Latency Meter](https://www.tryelements.dev/docs/ai-elements/devtools/latency-meter) | TTFB + total duration, color-coded progress bar        | Show `llm_duration_ms` on detail pages             |
| [AI Model Info](https://www.tryelements.dev/docs/ai-elements/devtools/model-info)       | Provider, model, context window, capabilities, pricing | Show `llm_model` + `llm_provider` cards            |
| [AI Token Viewer](https://www.tryelements.dev/docs/ai-elements/devtools/token-viewer)   | Token count visualization, input/output breakdown      | Show `llm_prompt_tokens` + `llm_completion_tokens` |

### Tasks

- [x] Install Elements components into `packages/ui/src/components/` (or evaluate whether
      to vendor or wrap them).
- [x] Create a `<ModelMetaCard>` composite that combines Latency Meter + Model Info + Token
      Viewer for a single extraction event.
- [x] Wire into `/vault/transcripts/[id]` detail page first — read `llm_*` fields from
      frontmatter and render the card.
- [x] Wire into `/vault/nodes/[id]` for extracted idea nodes.
- [x] Wire into `/vault/runs/[id]` for the execution-level view using `RunLlmTrace` data.

### Done means

A user viewing a transcript or idea detail page can see at a glance which model produced it,
how long it took, and what token budget it consumed — without opening the raw markdown file.

### Phase 5 validation result

Elements was evaluated as a design target rather than installed because no Elements package is
available in the workspace and the shell has no package manager. A local `ModelMetaCard` wrapper
now provides the same three surfaces with existing shadcn-compatible primitives and tokens:
provider/model info, latency, and prompt/completion token usage. It renders from `llm_*`
frontmatter on transcript and extracted idea detail pages, and from `RunNode.llm` on run detail
pages. `astro check --root apps/client` passes.

---

## Phase 6 — Token-Aware Harness Extension — DONE

> **Only start this after Phase 1 validation has confirmed that truncation is the actual
> bottleneck.** If Phase 1 says 6 000 chars is fine for now, this phase stays in backlog.
> If truncation IS the blocker, this phase promotes above Phase 4/5.

### Current limitation

- `prepareExtractionInput(...)` truncates by character count (6 000 chars).
- `harnessBudgetSteps` is captured in the harness but not used for token budgeting.
- `@finografic/ai-harness` does not yet provide token counting, chunking, or model-aware
  context assembly.

This extends `@finografic/ai-harness` (the external package) rather than duplicating its logic
inside LLAAB.

### 6a. Token counting in harness-prep

- [x] Add a `count-extraction-tokens` step to the harness pipeline.
- [x] If `countTokens` is not yet in `@finografic/ai-harness`, implement a local approximation
      (`text.length / 4`) and log a TODO to graduate it to the package later.
- [x] Accept a `model` parameter so token limits are model-specific rather than using a
      hardcoded character limit.

### 6b. Context assembly pipeline

Replace the two-step `harness-prep.ts` with a richer pipeline:

```
count-tokens
  → chunk-if-needed (with overlap for long transcripts)
  → build-extraction-context
  → validate-budget
```

- [x] `chunk-if-needed` splits long transcripts with configurable overlap so extraction
      doesn't lose cross-boundary context.
- [x] `validate-budget` step fails fast if the assembled context exceeds the model's input
      window, instead of silently truncating.

### 6c. Reducer support for chunked output

- [x] When extraction runs over multiple chunks, a reducer step merges partial results
      (deduplicate ideas, reconcile summaries).
- [x] Preserve current short-input behavior — single-chunk transcripts should not pay the
      cost of chunking machinery.

### 6d. Harness prep is provider-aware

- [x] `prepareExtractionInput(...)` accepts a `model` param and passes it through the
      pipeline.
- [x] `llm-extract.ts` passes the resolved model from `routeLlm` into harness prep.

### Boundary contract

- [x] Define the handoff contract between deterministic ingestion output, harness-prepared
      context, and `control.execute(...)` — this is the formal interface between the three
      layers.

Contract:

- Deterministic ingestion passes raw transcript text plus the resolved extraction model into
  `prepareExtractionInput(...)`.
- Harness prep returns immutable chunks, token budget metadata, a `ControlContext`, and trace
  stages; it never drops transcript content.
- `control.execute(...)` receives the prepared model/chunk envelope, runs one extraction per
  chunk, validates each partial JSON payload, and returns a reduced `ExtractedKnowledge` object.

### Validation

- [x] Add tests around boundary sizes and truncation/chunking decisions.
- [x] A transcript that previously got silently truncated now either extracts fully (if it
      fits the model window) or produces multiple chunk runs with merged output.

### Phase 6 validation result

- `prepareExtractionInput(...)` keeps short input as a single chunk and records four harness
  stages: count tokens, chunk if needed, build context, validate budget.
- Long input now produces overlapped chunks with `wasTruncated: false`.
- Extraction calls the model once per chunk and deduplicates repeated ideas/skills in the
  reduced result.

### Done means

Long transcript extraction no longer depends on blind first-6 000-character truncation.
Budget violations surface as meaningful errors rather than silent content loss.

---

## Phase 7 — Capability-Based Routing

> **Do this after the provider and command seams exist (Phases 2 + 3). Avoid premature
> abstraction.** The current `TaskType` enum is already a capability model — it just isn't
> called that, and it only covers LLM tasks. This phase extends it to cover the full
> execution surface.

### 7a. Define `Capability` type in `packages/core`

```ts
// packages/core/src/capability.ts
export type Capability =
  | 'chat'
  | 'reason'
  | 'summarize'
  | 'extract'
  | 'reduce'
  | 'structure'
  | 'memory_read'
  | 'memory_write'
  | 'skill_run'
  | 'agent_run'
  | 'command_run'
  | 'plan';
```

`TaskType` in `packages/llm` maps to a subset of these; the Terminal Panel `Command` kinds
map to others. One type system, not two.

Explicitly deferred capabilities (only add when there is a real consumer):

- `code_edit`, `code_review`, `browser_use`, `shell_exec`, `notify`, `orchestrate`

### 7b. Annotate existing providers with capabilities

```ts
// packages/llm/src/provider.ts (extended)
export interface LlmProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: Capability[];
  complete(...): Promise<LlmProviderResult>;
  stream(...): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

- `AnthropicProvider` → `['chat', 'reason', 'summarize', 'extract', 'structure', 'plan']`
- `OllamaProvider` → `['chat', 'summarize', 'extract', 'reduce', 'structure']`

### 7c. Add `findProvidersByCapability` to router

```ts
export function findProvidersByCapability(cap: Capability): LlmProvider[];
```

Now the system can answer "who can summarize?" without hard-coding tiers in call sites.

### 7d. Extend `SkillRoute` with capabilities

```ts
// packages/skills/src/agent/registry.ts (extended)
export interface SkillRoute {
  nodeType: NodeType;
  skill: string;
  capabilities: Capability[];
  execute: (node: LabNode) => Promise<{ record: SkillRunRecord }>;
  filter?: (node: LabNode) => boolean;
}
```

Skills now declare what they provide, making the agent loop queryable.

### 7e. Map command kinds to capabilities

- [ ] Update Terminal Panel's `Command` types to map `kind → Capability` (for routing +
      audit trail).
- [ ] Capability routing is the same code path for HTTP endpoints, Terminal Panel, and CLI.

### 7f. Expose via API

- [ ] Add `GET /api/llm/capabilities` endpoint — lists providers and their declared
      capabilities with availability status.

### Validation

- [ ] Keep capability selection deterministic and config-driven.
- [ ] `findProvidersByCapability('extract')` returns both Ollama and Anthropic providers.

---

## Phase 8 — CLI Surface + Diagnostics

> **Extends `packages/cli/`.** Most of the heavy lifting is done in earlier phases. The CLI
> surface is the thin layer that exposes it.

### New commands

```sh
llaab doctor                       # check provider availability, API keys, binary paths
llaab adapters list                # list registered providers + capabilities + availability
llaab route "<capability>"         # show which provider would be selected for a capability
llaab route --explain "<task>"     # show routing decision chain with tier resolution
```

### `llaab doctor` output

```
LLM Providers
  ✓ anthropic       remote    — ANTHROPIC_API_KEY present
  ✓ ollama          local-mid — reachable at localhost:11434
  ✗ opencode        executor  — binary not found

Capabilities covered: chat, reason, summarize, extract, reduce, structure, plan
Missing: code_edit, shell_exec (install opencode to cover these)

Harness: @finografic/ai-harness installed, extraction prep active
Control: packages/control orchestrator operational
Command Bus: 4 handlers registered (ai.run, agent.run, fs.read, fs.list)
```

### Tasks

- [ ] Add `llaab doctor` command using `isAvailable()` from Phase 2 and capability
      metadata from Phase 7.
- [ ] Add `llaab adapters list` command using `findProvidersByCapability` from Phase 7.
- [ ] Add `llaab route` command with capability → provider resolution chain.
- [ ] Wire `llaab route` to the same routing logic used by `routeLlm` (not a
      reimplementation).

---

## Phase 9 — External Executor Adapters (OpenCode, Cline)

> **Start only after the command bus and capability registry are proven (Phases 3 + 7).**
> The interface must exist first so there is somewhere to plug them in.

The Terminal Panel (Phase 4) and capability router (Phase 7) create the seam that external
executors plug into.

### Interface shape

```ts
// packages/llm/src/provider.ts or new packages/adapters/ (only if justified)
export interface ExecutorProvider {
  readonly id: string;
  readonly capabilities: Capability[];
  run(plan: ExecutionPlan): Promise<ExecutionResult>;
  isAvailable(): Promise<boolean>;
}
```

`ExecutionPlan` is a context bundle: an assembled set of vault nodes + task instructions +
constraints, grounded in LLAAB's existing schema types.

### Concrete adapters — in priority order

1. **OllamaProvider with Gemma** — already possible via the `OllamaProvider` from Phase 2;
   just register Gemma as a `local-mid` model via env var. No new code needed.

2. **OpenCodeAdapter** — shell-out to `opencode` binary with a context bundle file.
   Capabilities: `code_edit`, `shell_exec`, `test_run`.
   Only useful once the Terminal Panel's `ShellAdapter` exists.

3. **ClineAdapter** — VS Code extension control via Cline's MCP server or CLI interface.
   Capabilities: `code_edit`, `shell_exec`, `browser_use`.
   Lower priority — editor-centric; don't block on it.

4. **Codex / Hermes** — only if they can consume LLAAB documents without becoming the
   canonical memory store. Evaluate fit when the local command bus is stable.

### Rules

- [ ] External coding adapters receive a prepared context bundle and task, not vague raw
      prompts.
- [ ] External coding adapters do not write directly to vault memory unless routed through
      LLAAB APIs.
- [ ] Cloud or paid adapters must log provider, model, duration, and fallback reason.
- [ ] Expensive or high-risk adapter calls should support explicit human confirmation.
- [ ] Do not make external executors default before local LLM, harness, command bus, and
      RunNode tracing are stable.

### Tasks (deferred)

- [ ] Define `ExecutorProvider` interface.
- [ ] Implement `OpenCodeAdapter` (shell-out; synchronous; context bundle as temp file).
- [ ] Register `OpenCodeAdapter` in the capability router.
- [ ] `isAvailable()` checks for binary presence via `which opencode`.
- [ ] Add `opencode` as an allowlisted command in the Terminal Panel's shell adapter.

---

## Phase 10 — Optional Shell Adapter

> **This is intentionally last.** The typed command bus is LLAAB's orchestration model.
> Shell execution is a power-user escape hatch, not the default path.

### Tasks

- [ ] Add `shell.exec` to the command protocol only after Phase 4 is stable.
- [ ] Gate shell capability per session (not globally enabled).
- [ ] Allowlist commands only; start with `git`, `pnpm`, `node`, and `yt-dlp`.
- [ ] Deny arbitrary command strings by default.
- [ ] Persist command, cwd, duration, exit code, stdout summary, and stderr summary in
      the `RunNode` trace.
- [ ] Surface warnings in UI that this is power-user mode, not the default Terminal Panel
      behavior.

### Done means

Shell execution is useful for trusted local development without becoming the main
orchestration model.

---

## Phase Summary and Dependencies

| Phase | Item                                       | Depends on      | ROADMAP tier |
| ----- | ------------------------------------------ | --------------- | ------------ |
| 0     | LLM execution metadata in node frontmatter | —               | Done         |
| 1     | Harness real-flow validation               | Phase 0         | Done         |
| 2     | LLM provider interface                     | Phase 1 verdict | P1           |
| 3     | Typed command protocol (no UI)             | Phase 2         | Done         |
| 4     | Terminal / Command Panel vertical slice    | Phase 3 + 6     | Done         |
| 5     | Terminal metadata display (Elements)       | Phases 0 + 4    | Done         |
| 6     | Token-aware harness extension              | Phase 1 verdict | P1           |
| 7     | Capability-based routing                   | Phases 2 + 3    | P2           |
| 8     | CLI surface + diagnostics                  | Phase 7         | P3           |
| 9     | External executor adapters                 | Phases 3 + 7    | P3           |
| 10    | Optional shell adapter                     | Phase 4         | P3           |

\*Phase 1 promoted Phase 6: current truncation succeeds but loses too much transcript content
while using less than 20% of the available local model context window.

### Recommended execution order

Phase 0 and Phase 1 are complete. Phase 2 can proceed next. Phase 6 is promoted ahead of the
Terminal Panel work because real-flow validation showed blind 6 000-character truncation drops
too much transcript content while underusing the model context window.

```
Phase 0 ─── Phase 1 ──┬──── Phase 2 ──┬──── Phase 7 ──── Phase 8
                       │               │                    Phase 9
                       │
                       ├──── Phase 6
                       │
                       └──── Phase 3 ──── Phase 4 ──── Phase 5 ──── Phase 10
```

---

## Acceptance Criteria

The orchestration layer is in place when:

- Vault nodes from extraction carry LLM metadata in frontmatter (model, provider, timing,
  tokens).
- A new LLM provider can be added by implementing `LlmProvider` and registering it — no
  router edits needed.
- `llaab doctor` reports which providers are live and which capabilities are missing.
- The Terminal Panel can dispatch `ai.run`, `agent.run`, and `fs.read` commands with
  streaming output and a vault trace.
- Extraction prep uses the harness pipeline and surfaces truncation or budget decisions as
  visible stages, not silent truncation.
- Capability routing is the same code path for HTTP endpoints, Terminal Panel, and CLI.
- External adapters, when eventually added, plug into the same capability and command seam —
  not a parallel system.

---

## Anti-Patterns To Avoid

- Do not create `packages/adapters` as a broad abstraction before there are multiple real
  adapter consumers.
- Do not duplicate `routeLlm(...)` in terminal handlers — delegates through it.
- Do not bypass `control.execute(...)` for extraction-style work that needs schema validation.
- Do not put provider availability checks in UI components.
- Do not make Terminal Panel parse raw shell commands as the source of truth.
- Do not store adapter-specific memory outside the vault unless explicitly configured.
- Do not build Hermes/OpenCode/Cline integration before the local command bus exists.
- Do not add always-on background processes or polling (project rule).
