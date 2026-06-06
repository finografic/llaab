# TODO — Orchestration Adapters V3

> **Status:** Not started.
> Supersedes the adapter-only framing in `TODO_ADAPTERS.md` (v1 was written without codebase context).
> Generated: 2026-06-06

---

## Purpose

This plan introduces adapters as one layer inside LLAAB's orchestration system, not as a standalone
greenfield architecture.

The current repo already has most of the important seams:

- `packages/llm` routes LLM tasks to Ollama or Anthropic.
- `packages/control` governs model-facing execution with schema validation, retry policy, and
  decision traces.
- `packages/ingestion` already uses `@finografic/ai-harness` at the transcript extraction boundary.
- `packages/skills` has a one-shot agent loop and `RunNode` persistence.
- `apps/server` exposes Hono route groups for LLM, ingestion, vault, runs, and agent execution.
- `apps/client` has the shadcn/Tailwind UI base needed for a Terminal / Command Panel.

The missing architecture is a typed orchestration boundary that can prepare work, choose an
executor, dispatch it, stream structured output, and persist traces without duplicating logic.

---

## Current Codebase Map

| Area             | Current files                                                                                              | Reality                                                                                  | Gap                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| LLM routing      | `packages/llm/src/router.ts`, `packages/llm/src/providers/*.ts`, `packages/llm/src/types.ts`               | `TaskType -> ModelTier -> model`; direct imports of Ollama and Anthropic providers       | No provider interface, no provider availability contract, limited execution metadata |
| Control boundary | `packages/control/src/orchestrator.ts`, `packages/control/src/types.ts`                                    | `execute<T>()` validates model-facing output and returns decisions / LLM trace           | Good seam; should remain the governance layer, not be replaced by adapters           |
| Harness prep     | `packages/ingestion/src/extract/harness-prep.ts`, `packages/ingestion/src/extract/llm-extract.ts`          | Installed `@finografic/ai-harness` and uses two prep steps before `control.execute(...)` | Real ingest validation pending; still character truncation, not token-aware chunking |
| Skill execution  | `packages/skills/src/runner.ts`, `packages/skills/src/agent/registry.ts`, `packages/skills/src/agent/*.ts` | One-shot agent loop, skill routing by node type, `RunNode` persistence                   | Not capability-queryable; not exposed as typed command handlers                      |
| Server routes    | `apps/server/src/app.ts`, `apps/server/src/routes/*`                                                       | Hono app chains typed route groups under `/api/*`; no WebSocket command bus yet          | Terminal protocol and command dispatch layer missing                                 |
| Client UI        | `apps/client/src/pages/*`, `apps/client/src/components/*`, `packages/ui/src/components/*`                  | Astro + React islands, shadcn/ui primitives, app layout available                        | Terminal panel not started                                                           |
| CLI              | `packages/cli/src/index.ts`, `packages/cli/src/commands/*`                                                 | `agent`, `ingest`, `mcp`, `vault` commands via citty                                     | No `llm`, `doctor`, `adapters`, or command-bus diagnostics                           |
| Memory / vault   | `packages/core/src/*`, `packages/schemas/src/*`                                                            | Vault node CRUD and schemas; `RunNode` carries stages, decisions, LLM traces             | LLM frontmatter metadata is planned but not wired through transcript / idea nodes    |

---

## Target Mental Model

```txt
User intent / UI action / agent trigger
  -> typed command or pipeline request
  -> harness prep where context or input shaping is needed
  -> orchestration router chooses a capability handler
  -> adapter dispatch calls existing package APIs
  -> control validates model-facing results when applicable
  -> structured events stream to UI / CLI
  -> RunNode and node frontmatter persist trace metadata
```

Adapters are thin execution ports over existing code. They should not become a second business
logic layer.

---

## Design Rules

- Keep provider SDKs inside `packages/llm`; do not leak Ollama, Anthropic, OpenAI, Codex, Cline, or
  OpenCode SDK details into `packages/core`, `packages/schemas`, or UI code.
- Keep `packages/control` as the output governance layer for model-facing work.
- Keep `@finografic/ai-harness` at preparation boundaries first; do not wrap every deterministic
  ingestion stage with harness machinery.
- Keep agent execution one-shot. Do not add always-on background processes, watchers, schedulers,
  or polling loops.
- Route by capability and typed command kind, not by raw tool name or free-form shell text.
- Terminal Panel is not a shell. It is the first user-facing command bus for orchestration adapters.
- Shell execution, if added, is opt-in and allowlisted only.

---

## Core Types To Introduce

These types should be small and colocated with the first real consumers. Do not create a broad
framework package before these contracts prove useful.

### `packages/llm` provider contract

```ts
export interface LlmProvider {
  readonly id: string;
  readonly displayName: string;
  complete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult>;
  stream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

### `packages/core` command protocol

```ts
export type CommandSource = 'terminal' | 'ui' | 'agent';

export type Command =
  | { kind: 'ai.run'; task: TaskType; prompt: string; model?: string; system?: string; maxTokens?: number }
  | { kind: 'agent.run'; nodeId?: string; force?: boolean }
  | { kind: 'fs.read'; path: string }
  | { kind: 'fs.list'; path: string };
```

Shell is deliberately excluded from the first protocol. Add it only after the typed bus, RunNode
logging, and capability gating are working.

### `apps/server` command handler contract

```ts
export interface CommandHandler<TCommand extends Command = Command> {
  readonly kind: TCommand['kind'];
  handle(command: TCommand, context: CommandContext): AsyncGenerator<OutputEvent>;
}
```

This is where `LlmCommandHandler`, `AgentCommandHandler`, and vault file handlers live. These are
the first practical adapters.

---

## Phase 0 — Preserve The Current Priority: Harness Validation

Roadmap state says this is the next P1 item. Do this before expanding adapters or starting Terminal
Panel implementation.

- [ ] Run a real ingest + extract flow through `packages/ingestion/src/extract/llm-extract.ts`.
- [ ] Confirm `prepareExtractionInput(...)` stages appear in the persisted `RunNode`.
- [ ] Inspect whether `harness:truncate-extraction-input` and `harness:build-extraction-context`
      carry enough useful data for debugging.
- [ ] Decide whether 6,000-character truncation is acceptable for transcript extraction.
- [ ] Record the result in `TODO_HARNESS.md`, `NEXT_STEPS.md`, and, if priority changes,
      `ROADMAP.md`.

Success condition: the team knows whether token-aware harness work is a blocker before Terminal
Panel, or whether Terminal Panel can proceed as the next orchestration surface.

---

## Phase 1 — Formalize LLM Provider Adapters In `packages/llm`

This is the smallest adapter layer that matches the actual codebase.

Current state:

- `router.ts` imports `anthropicComplete`, `anthropicStream`, `ollamaComplete`, and `ollamaStream`
  directly.
- `TaskType` is already the LLM capability surface: `format | extract | code | reason`.
- `ModelTier` is already the routing abstraction: `local-small | local-mid | remote`.

Tasks:

- [ ] Add `packages/llm/src/provider.ts` with `LlmProvider` and `LlmProviderResult`.
- [ ] Refactor `providers/ollama.ts` to export an `ollamaProvider` object implementing
      `LlmProvider`.
- [ ] Refactor `providers/anthropic.ts` to export an `anthropicProvider` object implementing
      `LlmProvider`.
- [ ] Update `router.ts` so tier-to-provider routing uses a provider map instead of direct function
      imports.
- [ ] Preserve the public API: `routeLlm`, `streamLlm`, `ollamaListModels`, `getLlmStatus`.
- [ ] Make `getLlmStatus()` include provider availability without requiring callers to know SDK
      details.
- [ ] Keep model-name selection env-configurable through the current `MODEL_MAP`.

Non-goal:

- [ ] Do not add OpenAI, Codex, Cline, OpenCode, or Hermes in this phase.

Validation:

- [ ] Run `pnpm --filter @llaab/llm typecheck`.
- [ ] Run existing LLM-related tests if present; otherwise run the smallest affected package
      typechecks.

---

## Phase 2 — Thread LLM Execution Metadata Through The Existing Flow

This directly implements the ROADMAP P2 metadata item and makes future adapters observable.

Tasks:

- [ ] Extend `LlmCompleteResult` with `durationMs`, `providerId`, and optional token counts.
- [ ] Capture wall-clock timing in `routeLlm(...)`.
- [ ] Capture provider-reported prompt and completion tokens when available.
- [ ] Keep token fields optional because Ollama and Anthropic may expose different metadata shapes.
- [ ] Update `ControlLlmTrace` to carry model, provider, duration, token counts, raw output, and
      parse status.
- [ ] Update `llmExtractWithTrace(...)` so trace metadata survives through `runSkill(...)`.
- [ ] Add optional `llm_model`, `llm_provider`, `llm_duration_ms`, `llm_prompt_tokens`, and
      `llm_completion_tokens` fields to transcript and idea schemas.
- [ ] Update `extractTranscriptIdeas(...)` to write metadata to transcript and created idea nodes.

Success condition: a real transcript extraction produces vault nodes whose frontmatter shows which
provider/model ran, how long it took, and any available token counts.

---

## Phase 3 — Define The Typed Command Protocol

This lays the foundation for Terminal Panel and future adapters without needing WebSockets first.

Location:

- Protocol types and Zod schemas: `packages/core/src/command-protocol.ts`
- Server handlers: `apps/server/src/commands/*`
- Tests: nearest package tests, with fake handlers

Tasks:

- [ ] Define `CommandEnvelope`, `OutputEnvelope`, `Command`, and `OutputEvent` with Zod schemas.
- [ ] Support initial command kinds only: `ai.run`, `agent.run`, `fs.read`, `fs.list`.
- [ ] Add a command bus that validates envelopes, dispatches by `command.kind`, and streams
      `OutputEvent`s.
- [ ] Implement `ai.run` by calling `streamLlm(...)`; do not create parallel LLM routing.
- [ ] Implement `agent.run` by calling `runAgentLoop(...)`; preserve one-shot execution.
- [ ] Implement `fs.read` and `fs.list` against vault-safe paths only.
- [ ] Persist every command execution as a `RunNode` or reuse `runSkill(...)` where that keeps
      semantics clean.

Security requirements:

- [ ] Validate every inbound envelope before dispatch.
- [ ] Normalize file paths and restrict file commands to the vault root.
- [ ] Add duration, status, input summary, output summary, and failure reason to traces.
- [ ] Do not add `shell.exec` yet.

Success condition: the command bus can be exercised from tests or a local server route without the
client terminal UI existing yet.

---

## Phase 4 — Terminal / Command Panel Vertical Slice

This implements the first visible orchestration adapter surface from `TODO_TERMINAL_PANEL.md`.

Server tasks:

- [ ] Add a WebSocket endpoint for terminal commands in `apps/server`.
- [ ] Reuse the Phase 3 command bus for dispatch.
- [ ] Stream `OutputEvent` envelopes over the socket.
- [ ] Add connection cleanup and command timeout behavior; no always-on loops.

Client tasks:

- [ ] Add an xterm.js React island in `apps/client`.
- [ ] Use shadcn/ui primitives from `packages/ui/src/components/` for surrounding panel chrome.
- [ ] Connect to the server WebSocket and render token, stdout, stderr, meta, error, and done
      events.
- [ ] Support the minimal command syntax needed to produce typed commands.
- [ ] Add basic command history.

Initial user flow:

```txt
ai.run extract "Summarize this short note into three ideas"
  -> streamLlm(...)
  -> token events in terminal
  -> done event
  -> RunNode persisted
```

Success condition: a user can run an LLM command from the panel and inspect the resulting RunNode.

---

## Phase 5 — Token-Aware Harness Extension

Only promote this above Terminal Panel if Phase 0 proves truncation is the blocker.

Current limitation:

- `prepareExtractionInput(...)` truncates by character count.
- `harnessBudgetSteps` is captured but not used for token budgeting.
- `@finografic/ai-harness` does not yet provide token counting, chunking, or model-aware context
  assembly.

Tasks:

- [ ] Define the handoff contract between deterministic ingestion output, harness-prepared
      context, and `control.execute(...)`.
- [ ] Add or upstream token counting support where it belongs.
- [ ] Replace character truncation with model-aware token budgeting.
- [ ] Add chunking for long transcripts with overlap.
- [ ] Add reducer support for chunked extraction results.
- [ ] Preserve current short-input behavior.
- [ ] Add tests around boundary sizes and truncation/chunking decisions.

Success condition: long transcript extraction no longer depends on blind first-6,000-character
truncation.

---

## Phase 6 — Capability Registry Over Existing Routes

Do this after the provider and command seams exist. Avoid premature abstraction.

Goal:

- Let LLAAB ask "what can handle this capability?" across LLM providers, command handlers, and
  skill routes.

Tasks:

- [ ] Add a minimal `Capability` union in `packages/core`.
- [ ] Map `TaskType` to LLM capabilities.
- [ ] Add capability metadata to command handlers.
- [ ] Add capability metadata to skill routes in `packages/skills/src/agent/registry.ts`.
- [ ] Add `llaab doctor` or `llaab capabilities` CLI output listing available handlers,
      configured models, and missing local services.
- [ ] Keep capability selection deterministic and config-driven.

Initial capabilities:

- `chat`
- `reason`
- `summarize`
- `extract`
- `structure`
- `memory_read`
- `memory_write`
- `skill_run`
- `agent_run`
- `command_run`

Explicitly defer:

- `code_edit`
- `code_review`
- `browser_use`
- `shell_exec`
- `notify`
- `orchestrate`

---

## Phase 7 — External Executor Adapters

Start only after the command bus and capability registry are proven.

Potential adapters:

- OpenCode adapter for repo edits, test runs, and code review.
- Cline adapter for IDE / human-in-loop execution.
- Codex adapter for coding-agent tasks when explicitly requested.
- Hermes adapter for notification and personal-agent orchestration, if it can consume LLAAB
  documents without becoming the canonical memory store.
- OpenAI adapter if `packages/llm` needs an additional remote model provider.

Rules:

- [ ] External coding adapters receive a prepared context bundle and task, not vague raw prompts.
- [ ] External coding adapters do not write directly to vault memory unless routed through LLAAB
      APIs.
- [ ] Cloud or paid adapters must log provider, model, duration, and fallback reason.
- [ ] Expensive or high-risk adapter calls should support explicit confirmation.
- [ ] Do not make external executors default before local LLM, harness, command bus, and RunNode
      tracing are stable.

---

## Phase 8 — Optional Shell Adapter

This is intentionally late.

Tasks:

- [ ] Add `shell.exec` to the command protocol only after Phase 4 is stable.
- [ ] Gate shell capability per session.
- [ ] Allowlist commands only; start with `git`, `pnpm`, `node`, and `yt-dlp` if still needed.
- [ ] Deny arbitrary command strings by default.
- [ ] Persist command, cwd, duration, exit code, stdout summary, and stderr summary.
- [ ] Surface warnings in UI that this is power-user mode, not the default Terminal Panel behavior.

Success condition: shell execution is useful for trusted local development without becoming the
main orchestration model.

---

## Suggested Implementation Order

1. Finish Phase 0 harness validation.
2. Implement Phase 1 LLM provider interface.
3. Implement Phase 2 metadata while the LLM boundary is already being touched.
4. Implement Phase 3 command bus without UI.
5. Implement Phase 4 Terminal Panel vertical slice.
6. Promote either Phase 5 token-aware harness or Phase 6 capability registry based on what Phase 0
   and Phase 4 reveal.
7. Defer external executors and shell until LLAAB's own orchestration seam is proven.

---

## Anti-Patterns To Avoid

- Do not create `packages/adapters` as a broad abstraction before there are multiple real adapter
  consumers.
- Do not duplicate `routeLlm(...)` in terminal handlers.
- Do not bypass `control.execute(...)` for extraction-style work that needs schema validation.
- Do not put provider availability checks in UI components.
- Do not make Terminal Panel parse raw shell commands as the source of truth.
- Do not store adapter-specific memory outside the vault unless explicitly configured.
- Do not build Hermes/OpenCode/Cline integration before the local command bus exists.
