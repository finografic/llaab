# TODO — Orchestration Layer: Adapters, Harness, and Terminal Panel

> **Status:** Not started.
> Supersedes the adapter-only framing in `TODO_ADAPTERS.md` (v1 was written without codebase context).
> Generated: 2026-06-06

---

## What this plan is

V1 proposed adapters as a greenfield system. This plan instead evolves the **three partially-built
systems that already exist** into a coherent orchestration layer:

| System                   | Current state                                    | Gap                                             |
| ------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| `packages/llm`           | Task → tier → provider routing                   | No formal interfaces; tier determines provider  |
| `@finografic/ai-harness` | Pipeline primitives, extraction spike            | Not yet validated in real flow; no token budget |
| Terminal Panel           | Architecture specced in `TODO_TERMINAL_PANEL.md` | Not started; command bus IS an adapter surface  |

These three are the same concern seen from different angles — **how does LLAAB prepare, route,
dispatch, and observe work across different execution backends?** Building them in isolation would
produce three partial systems with no common seam. This plan wires them into one.

---

## Mental model

```
User / Agent intent
       ↓
  CapabilityRouter        ← what adapter can handle this? (extends packages/llm router.ts)
       ↓
  HarnessPrep             ← what context does it need? (@finografic/ai-harness pipeline)
       ↓
  AdapterDispatch         ← who executes it? (LlmAdapter | AgentAdapter | ShellAdapter | …)
       ↓
  CommandBus / WS         ← Terminal Panel execution surface
       ↓
  Output / trace / vault  ← RunNode, LLM metadata, stage traces
```

---

## What already exists (do not re-invent)

### `packages/llm` — the provider layer is 80% there

- `router.ts` — `TaskType → ModelTier → model string`; `routeLlm` / `streamLlm` public API
- `providers/anthropic.ts`, `providers/ollama.ts` — two concrete provider implementations
- `types.ts` — `TaskType`, `ModelTier`, `LlmCompleteOptions`, `LlmCompleteResult`

**Gap:** providers are not behind a shared interface — `router.ts` imports them directly by name.
Adding a third provider (e.g. a local Gemma via Ollama, or OpenAI) requires editing the router.
The fix is small: extract a `LlmProvider` interface and invert the dependency.

### `packages/control` — execution governance already exists

- `orchestrator.ts` — `execute<T>()` with retry, schema validation, decision traces
- `types.ts` — `ControlStage`, `ControlPolicy`, `ControlDecision`, `ControlLlmTrace`

This is the schema-validation / output-governance layer. It stays. Harness prepares the input;
control governs the output. They are complementary, not competing.

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
capability, so there is no way to ask "what can summarize?" or "what can run shell commands?".

---

## Non-goals

- Do not rebuild Hermes, OpenCode, or Cline inside LLAAB.
- Do not add always-on background processes or polling (project rule — agent-execution.instructions.md).
- Do not let provider SDKs (`@anthropic-ai/sdk`, `ollama`) leak into `packages/core` or `packages/schemas`.
- Do not hard-code model names in core logic (env-configurable via MODEL_MAP already; keep it that way).
- Do not start external executor adapters (OpenCode, Cline) until Phase 5 — the interface must
  exist first so there is somewhere to plug them in.

---

## Phase 0 — Validate the harness in a real extraction run

**Current state:** spike is done; real-flow validation is the remaining P1 item.
**This must be done before any further harness or adapter work.**

### Tasks

- [ ] Run a real ingest + extract flow end-to-end with harness prep in place.
      Entry: `packages/ingestion/src/extract/llm-extract.ts` →
      `prepareExtractionInput(...)` → `control.execute(...)`.
- [ ] Confirm stage traces are populated and useful (not just `completed` with no data).
- [ ] Confirm current 6 000-character truncation is acceptable for typical YouTube transcripts,
      or document exactly where it fails.
- [ ] Write a one-paragraph note at the top of `TODO_HARNESS.md` Phase 1 section with the result.
- [ ] Make the priority call: is token-aware chunking now the real blocker, or does Terminal Panel
      stay next? Record in `ROADMAP.md`.

**Done means:** extraction succeeds, stages are visible in traces, truncation verdict is written.

---

## Phase 1 — Formalize the LLM provider interface

**Location:** `packages/llm/src/`
**Effort:** small — two concrete providers already exist; this is extracting what is implicit.

### 1a. Extract `LlmProvider` interface

```ts
// packages/llm/src/provider.ts
export interface LlmProvider {
  complete(prompt: string, opts: LlmCompleteOptions): Promise<string>;
  stream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

- Move `anthropicComplete` / `anthropicStream` into an `AnthropicProvider` class.
- Move `ollamaComplete` / `ollamaStream` into an `OllamaProvider` class.
- `router.ts` selects a provider by tier and delegates to the interface — no more direct imports.

### 1b. Add provider registry to router

```ts
// packages/llm/src/router.ts (extended)
const PROVIDERS: Record<ModelTier, LlmProvider> = {
  'local-small': ollamaProvider,
  'local-mid':   ollamaProvider,
  'remote':      anthropicProvider,
};
```

`resolveModel` now returns `{ model, tier, provider }`.

This is the only change needed to make a third provider (e.g. local Gemma, OpenAI) pluggable
without editing routing logic.

### 1c. Expose `isAvailable()` checks in `getLlmStatus()`

```ts
export async function getLlmStatus(): Promise<{ ... availableProviders: string[] }>;
```

This unblocks the `llaab doctor` diagnostic and the `/llm` status page live check.

### Tasks

- [ ] Create `packages/llm/src/provider.ts` with the `LlmProvider` interface.
- [ ] Refactor `providers/anthropic.ts` to implement `LlmProvider` and export an instance.
- [ ] Refactor `providers/ollama.ts` to implement `LlmProvider` and export an instance.
- [ ] Update `router.ts` to route through the `PROVIDERS` map rather than calling providers directly.
- [ ] Update `getLlmStatus()` to call `isAvailable()` on each provider asynchronously.
- [ ] Verify typecheck + existing tests pass; no behaviour change.

---

## Phase 2 — LLM execution metadata in node frontmatter

**This is ROADMAP P2 — implement here as part of the orchestration layer story, not in isolation.**
The `LlmProvider` interface introduced in Phase 1 is the right place to surface this data.

### Tasks

- [ ] Extend `LlmCompleteResult` with `durationMs: number`, `promptTokens?: number`,
      `completionTokens?: number` (token fields are optional — not all providers return them).
- [ ] Wrap the provider call in `router.ts` with `performance.now()` timing.
- [ ] Thread metadata through `routeLlm` return value.
- [ ] Pass metadata from `llmExtract` into `extractTranscriptIdeas`.
- [ ] Write `llm_model`, `llm_duration_ms`, `llm_prompt_tokens`, `llm_completion_tokens` to
      transcript and idea node frontmatter via `updateNode`.
- [ ] Add optional fields to `TranscriptNode` and `IdeaNode` in `packages/schemas`.

**Done means:** after extraction, vault nodes have LLM metadata in frontmatter.

---

## Phase 3 — Terminal / Command Panel — vertical slice

**This is the command bus that IS the adapter surface for human-triggered and agent-triggered execution.**
Full spec: `TODO_TERMINAL_PANEL.md`. This phase delivers the minimal viable slice.

The key architectural insight: the Terminal Panel's `LlmAdapter` and `AgentAdapter` are the first
real users of the `LlmProvider` interface from Phase 1. They must call `routeLlm` / `streamLlm`,
not re-implement LLM dispatch.

### Phase 3a — WS endpoint + protocol

- [ ] Add `GET /terminal` WebSocket endpoint in `apps/server`.
- [ ] Define `CommandEnvelope` and `OutputEnvelope` Zod schemas in `packages/core`.
- [ ] Add `Command` discriminated union type: `ai.run | fs.read | fs.list | agent.run`.
      (Shell adapter — Phase 5 only.)
- [ ] Command Gateway: Zod-validate every inbound message; reject malformed envelopes.
- [ ] Command Bus: dispatch by `command.kind` to the appropriate adapter handler.

### Phase 3b — `ai.run` → LLM streaming → terminal

- [ ] `LlmAdapter.handle(ai.run)` calls `streamLlm(task, prompt, opts)` from `packages/llm`.
- [ ] Yield `{ type: 'token', data: chunk }` output events per token.
- [ ] Yield `{ type: 'done', code: 0 }` on completion.

### Phase 3c — xterm.js React island in `apps/client`

- [ ] Install xterm.js as a dependency.
- [ ] `TerminalPanel` React island: connects to `ws://.../terminal`, renders token stream.
- [ ] Basic history navigation (up/down arrow).

### Phase 3d — Audit log

- [ ] Every dispatched command creates a `RunNode` via `packages/skills/runner.ts`.
      Gives every terminal run a vault trace for free.

**Done means:** user can type `ai.run extract "summarize this"` in the terminal and see a streaming
LLM response, with a RunNode persisted to vault.

---

## Phase 4 — Capability-based routing

**Extends `packages/llm/src/router.ts` and `packages/skills/src/agent/registry.ts`.**

The current `TaskType` enum (`format | extract | code | reason`) is already a capability model —
it just isn't called that, and it only covers LLM tasks. This phase extends it to cover the full
execution surface.

### 4a. Define `Capability` type in `packages/core`

```ts
// packages/core/src/capability.ts
export type Capability =
  | 'chat'
  | 'reason'
  | 'summarize'
  | 'extract'
  | 'reduce'
  | 'structure'
  | 'code_edit'
  | 'shell_exec'
  | 'memory_read'
  | 'memory_write'
  | 'skill_run'
  | 'notify'
  | 'plan';
```

`TaskType` in `packages/llm` maps to a subset of these; the Terminal Panel `Command` kinds map
to others. One type system, not two.

### 4b. Annotate existing providers with capabilities

```ts
// packages/llm/src/provider.ts (extended)
export interface LlmProvider {
  readonly id: string;
  readonly capabilities: Capability[];
  complete(...): Promise<string>;
  stream(...): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

- `AnthropicProvider` → `['chat', 'reason', 'summarize', 'extract', 'structure', 'code_edit', 'plan']`
- `OllamaProvider` → `['chat', 'summarize', 'extract', 'reduce', 'structure']`

### 4c. Add `findProvidersByCapability` to router

```ts
export function findProvidersByCapability(cap: Capability): LlmProvider[];
```

Now the system can answer "who can summarize?" without hard-coding tiers in call sites.

### 4d. Extend `SkillRoute` with capabilities

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

### Tasks

- [ ] Add `packages/core/src/capability.ts` exporting the `Capability` type.
- [ ] Extend `LlmProvider` interface with `id` and `capabilities`.
- [ ] Annotate `AnthropicProvider` and `OllamaProvider` with their capabilities.
- [ ] Add `findProvidersByCapability` to `router.ts`.
- [ ] Extend `SkillRoute` with `capabilities` field; annotate existing routes.
- [ ] Update Terminal Panel's `Command` types to map `kind → Capability` (for routing + audit).
- [ ] Add `GET /api/llm/capabilities` endpoint — lists providers and their declared capabilities.

---

## Phase 5 — Harness extension: token-aware context prep

**Only start this after Phase 0 validation has confirmed that truncation is the actual bottleneck.**
If Phase 0 says 6 000 chars is fine for now, this phase stays in P3.

This extends `@finografic/ai-harness` (the external package) rather than duplicating its logic
inside LLAAB.

### 5a. Token counting in harness-prep

Replace character-count truncation in `harness-prep.ts` with token-aware truncation:

```ts
// packages/ingestion/src/extract/harness-prep.ts (extended)
const countExtractionTokensStep: HarnessStep<...> = {
  name: 'count-extraction-tokens',
  async run(input) {
    const tokens = await countTokens(input.preparedText, model);
    // ...
  }
};
```

If `countTokens` is not yet in `@finografic/ai-harness`, implement a local approximation
(`text.length / 4`) and log a note to graduate it to the package later.

### 5b. Context assembly pipeline

Replace the two-step `harness-prep.ts` with a richer pipeline:

```
count-tokens
  → chunk-if-needed
  → build-extraction-context
  → validate-budget
```

The `validate-budget` step fails fast if the assembled context exceeds the model's input window,
instead of silently truncating.

### 5c. Harness prep is provider-aware

`buildExtractionContextStep` should accept a `model` parameter so chunk limits are model-specific
rather than using a hardcoded character limit.

### Tasks

- [ ] After Phase 0 validation, make the priority call: is token-aware prep now blocking?
- [ ] If yes: implement token counting step (approximation first, exact later).
- [ ] Add chunk-if-needed step for transcripts that exceed model input window.
- [ ] Add validate-budget step that surfaces a meaningful error, not a silent truncation.
- [ ] Make `prepareExtractionInput` accept a `model` param and pass it through the pipeline.
- [ ] Update `llm-extract.ts` to pass the resolved model from `routeLlm` into harness prep.

---

## Phase 6 — External executor adapters (OpenCode, Cline)

**Only implement after Phase 4 capability routing is in place — the interface must exist first.**

The Terminal Panel (Phase 3) and capability router (Phase 4) create the seam that external
executors plug into. An external executor is just an adapter that implements `LlmProvider`
(or a new `ExecutorProvider`) and declares `code_edit | shell_exec | test_run` capabilities.

### Interface shape

```ts
// packages/llm/src/provider.ts or new packages/adapters/
export interface ExecutorProvider {
  readonly id: string;
  readonly capabilities: Capability[];
  run(plan: ExecutionPlan): Promise<ExecutionResult>;
  isAvailable(): Promise<boolean>;
}
```

`ExecutionPlan` is the context bundle described in v1 Phase 7, but grounded in LLAAB's existing
schema: an assembled set of vault nodes + task instructions + constraints.

### Concrete adapters — in priority order

1. **OllamaProvider with Gemma** — already possible via the `OllamaProvider` from Phase 1;
   just register Gemma as a `local-mid` model via env var. No new code needed.

2. **OpenCodeAdapter** — shell-out to `opencode` binary with a context bundle file.
   Capabilities: `code_edit`, `shell_exec`, `test_run`.
   This is only useful once the Terminal Panel's `ShellAdapter` (Phase 3 / Phase 5) exists.

3. **ClineAdapter** — VS Code extension control via Cline's MCP server or CLI interface.
   Capabilities: `code_edit`, `shell_exec`, `browser_use`.
   Lower priority — editor-centric; don't block on it.

### Tasks (deferred — do not start until Phase 4 is done)

- [ ] Define `ExecutorProvider` interface.
- [ ] Implement `OpenCodeAdapter` (shell-out; synchronous; context bundle as temp file).
- [ ] Register `OpenCodeAdapter` in the capability router.
- [ ] Add `opencode` as an allowlisted command in the Terminal Panel's shell adapter.
- [ ] `isAvailable()` checks for binary presence via `which opencode`.

---

## Phase 7 — CLI surface + diagnostics

**Extends `packages/cli/`.**

Most of the heavy lifting is done in earlier phases. The CLI surface is the thin layer that
exposes it.

### New commands

```sh
llaab adapters list                # list registered providers + capabilities + availability
llaab adapters doctor              # check availability, missing API keys, binary paths
llaab route "<capability>"         # show which provider would be selected for a capability
llaab route --explain "<task>"     # show routing decision chain with tier resolution
```

`llaab adapters doctor` output:

```
LLM Providers
  ✓ anthropic       remote    — ANTHROPIC_API_KEY present
  ✓ ollama          local-mid — reachable at localhost:11434
  ✗ opencode        executor  — binary not found

Capabilities covered: chat, reason, summarize, extract, reduce, structure, plan
Missing: code_edit, shell_exec, test_run (install opencode to cover these)
```

### Tasks

- [ ] Add `llaab adapters list` command using `findProvidersByCapability` from Phase 4.
- [ ] Add `llaab adapters doctor` command using `isAvailable()` from Phase 1.
- [ ] Add `llaab route` command with capability → provider resolution chain.
- [ ] Wire `llaab route` to the same routing logic used by `routeLlm` (not a reimplementation).

---

## Priority order summary

| Phase | Item                                         | Depends on      | Priority |
| ----- | -------------------------------------------- | --------------- | -------- |
| 0     | Harness real-flow validation                 | —               | P1 now   |
| 1     | LLM provider interface                       | Phase 0 verdict | P1       |
| 2     | LLM execution metadata in frontmatter        | Phase 1         | P2       |
| 3     | Terminal / Command Panel — vertical slice    | Phase 1         | P2       |
| 4     | Capability-based routing                     | Phase 1, 3      | P2       |
| 5     | Harness token-aware context prep             | Phase 0 verdict | P2/P3    |
| 6     | External executor adapters (OpenCode, Cline) | Phase 4         | P3       |
| 7     | CLI surface + diagnostics                    | Phase 4         | P3       |

Phase 1 and Phase 3 can proceed in parallel once Phase 0 is done.
Phase 2 and Phase 4 can proceed in parallel once Phase 1 is done.

---

## Acceptance criteria

The orchestration layer is in place when:

- A new LLM provider can be added by implementing `LlmProvider` and registering it — no router
  edits needed.
- `llaab adapters doctor` reports which providers are live and which capabilities are missing.
- The Terminal Panel can dispatch `ai.run`, `agent.run`, and `fs.read` commands with streaming
  output and a vault trace.
- Extraction prep uses the harness pipeline and surfaces truncation or budget decisions as
  visible stages, not silent truncation.
- Vault nodes from extraction carry LLM metadata in frontmatter.
- Capability routing is the same code path for HTTP endpoints, Terminal Panel, and CLI.
