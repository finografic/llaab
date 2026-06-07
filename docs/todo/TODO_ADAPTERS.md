# LLAAB Adapter Architecture Plan

> **Status:** Substantially implemented by the orchestration work in
> [DONE_ORCHESTRATION.md](DONE_ORCHESTRATION.md). The stable architecture reference is now
> [07 — Orchestration and adapters](../07_ORCHESTRATION_AND_ADAPTERS.md). Keep this file as
> historical planning context for future adapter expansion.

## Goal

Introduce an adapter pattern so LLAAB remains the portable memory, context, planning, and skill layer, while external tools provide execution.

LLAAB must not become tightly coupled to Hermes, OpenCode, Cline, Claude Code, Codex, Ollama, Gemma, or any specific provider.

Core principle:

LLAAB owns the knowledge model.
Adapters own integration with external runtimes.

## Target Mental Model

```
LLAAB Core
├── project memory
├── context extraction
├── reducers
├── structured task plans
├── skill documents
├── model/tool routing
└── execution contracts

Adapters
├── Hermes adapter
├── OpenCode adapter
├── Cline adapter
├── Claude Code adapter
├── Codex adapter
├── Ollama adapter
├── Gemma adapter
└── OpenAI / Anthropic adapters

Executors
├── coding agents
├── local LLMs
├── cloud LLMs
├── notification agents
└── orchestration agents
```

## Phase 1 — Audit Current Architecture

**Inspect the repo for existing concepts related to:**

- LLAAB memory
- PROJECT_MEMORY_MODEL.md
- AGENTS.md / CLAUDE.md generation
- harness pipelines
- extract / reduce / structure flows
- model routing
- local model usage
- provider abstractions
- CLI commands
- config files
- templates
- tool selection logic

Do not refactor first.

**Produce a short internal map of:**

- current modules
- current data flow
- where adapters naturally belong
- which existing code should remain core
- which code is already adapter-like

## Phase 2 — Define Core Adapter Contracts

Create a small contracts layer.

**Suggested location:**

packages/llaab-core/src/adapters/

or equivalent existing package.

Define interfaces, preferring `interface` over `type` where possible.

**Suggested contracts:**

- `LlaabAdapter`
- `ModelAdapter`
- `CodingExecutorAdapter`
- `OrchestrationAdapter`
- `MemoryAdapter`
- `SkillAdapter`
- `NotificationAdapter`

Keep contracts small and composable.

**Example conceptual shape:**

```ts
export interface LlaabAdapter {
  readonly id: string
  readonly kind: AdapterKind
  readonly displayName: string
  readonly capabilities: AdapterCapability[]

  isAvailable(): Promise<boolean>
}
```

Avoid over-designing. Start with minimum viable contracts.

## Phase 3 — Define Capabilities, Not Tool Names

Do not route based on tool identity first.

Route based on capabilities.

**Suggested capabilities:**

- `chat`
- `reason`
- `summarize`
- `extract`
- `reduce`
- `structure`
- `code_edit`
- `code_review`
- `test_run`
- `shell_exec`
- `browser_use`
- `memory_read`
- `memory_write`
- `skill_read`
- `skill_write`
- `notify`
- `orchestrate`
- `plan`

This lets LLAAB choose:

- Gemma for local summarization/reduction
- OpenCode for code edits
- Cline for VS Code human-in-loop tasks
- Hermes for long-running orchestration
- Claude/OpenAI only when local models are insufficient

## Phase 4 — Add Adapter Registry

**Create an adapter registry responsible for:**

- registering adapters
- checking availability
- exposing capabilities
- selecting candidates
- resolving preferred adapters from config

**Suggested API:**

```ts
export interface AdapterRegistry {
  register(adapter: LlaabAdapter): void
  list(): LlaabAdapter[]
  findByCapability(capability: AdapterCapability): LlaabAdapter[]
  get(id: string): LlaabAdapter | undefined
}
```

Keep this deterministic and testable.

No hidden global magic.

## Phase 5 — Add Routing Policy Layer

Create a routing policy separate from the adapter registry.

The registry knows what exists.
The router decides what to use.

**Suggested routing priorities:**

1. deterministic local code
2. local LLM
3. local coding executor
4. external coding executor
5. paid cloud API

**Example policy:**

```md
Prefer local adapters unless:
- task requires high reasoning quality
- local model confidence is low
- task is high-risk
- user explicitly requested Claude/OpenAI/Codex
- repo modification requires a coding executor
```

The router should support explicit overrides.

**Example config:**

```json
{
  "routing": {
    "preferLocal": true,
    "fallbackToCloud": true,
    "defaultLocalModel": "gemma",
    "codingExecutor": "opencode",
    "orchestrator": "hermes"
  }
}
```

## Phase 6 — Implement Initial Adapters

Start with thin adapters. Do not chase full feature parity.

### 1. Gemma Adapter

**Purpose:**

- local reasoning
- summarization
- reduction
- context compression
- structured extraction
- low-cost planning

**Integration options to investigate locally:**

- Ollama, if Gemma 4 support is available
- llama.cpp / GGUF, if available
- Google-provided tooling
- local OpenAI-compatible server if already used

**The Gemma adapter should expose:**

- `chat`
- `summarize`
- `reduce`
- `structure`
- `reason`

It should not edit files directly.

### 2. Ollama Adapter

**Purpose:**

- generic local model backend
- model discovery
- local inference

Expose Ollama as a backend adapter, not as “the model.”

Gemma can be implemented either as:

- `GemmaAdapter` directly
- or `OllamaModelAdapter` configured with Gemma

Prefer the second if it keeps the system cleaner.

### 3. OpenCode Adapter

Purpose:

- coding executor
- repo edits
- refactors
- tests
- implementation tasks

**Expose:**

- `code_edit`
- `code_review`
- `test_run`
- `shell_exec`

LLAAB should pass OpenCode a prepared context bundle and task plan, not raw vague instructions.

### 4. Cline Adapter

**Purpose:**

- IDE/human-in-loop coding executor
- VS Code workflow
- MCP-powered tool use

**Expose:**

- `code_edit`
- `code_review`
- `shell_exec`
- `browser_use`
- `human_approval`

Do not make Cline the default unless the workflow is editor-centric.

### 5. Hermes Adapter

**Purpose:**

- long-running orchestration
- memory-aware personal agent
- notifications
- cross-platform messaging
- scheduled/background-style workflows

**Expose:**

- `orchestrate`
- `notify`
- `memory_read`
- `memory_write`
- `skill_read`
- `skill_write`
- `plan`

Hermes should consume and produce LLAAB-compatible documents where possible.

Do not let Hermes become the canonical memory store unless explicitly configured.

### 6. Claude / OpenAI / Codex Adapters

**Purpose:**

- high-quality reasoning fallback
- difficult planning
- final review
- complex refactors
- agentic coding where local models fail

Expose only the required capabilities.

**Add usage controls:**

- estimated cost
- explicit fallback reason
- provider logs
- optional user confirmation for expensive calls

## Phase 7 — Define LLAAB Context Bundle Format

Create a portable bundle that every adapter can consume.

**Suggested shape:**

```md
# LLAAB Context Bundle

## Task

## Repo Summary

## Relevant Files

## Constraints

## Project Memory

## Existing Decisions

## Required Output

## Safety / Risk Notes

## Execution Instructions
```

This is the critical abstraction.

Hermes, OpenCode, Cline, Claude Code, Codex, and Gemma should all receive the same logical bundle, formatted for their interface.

## Phase 8 — Define Skill Document Format

Create portable skill documents independent of Hermes.

**Suggested location:**

`docs/skills/`

or:

`.llabb/skills/`

**Suggested structure:**

```md
# Skill: <name>

## Purpose

## When To Use

## Inputs

## Procedure

## Expected Output

## Validation

## Known Failure Modes

## Related Adapters
```

Hermes may generate or consume these, but the format belongs to LLAAB.

## Phase 9 — Add Adapter-Specific Prompt Renderers

Each adapter may need different formatting.

Create renderers:

- `renderForGemma`
- `renderForOpenCode`
- `renderForCline`
- `renderForHermes`
- `renderForClaudeCode`
- `renderForCodex`

Do not duplicate core logic inside renderers.

Renderers should only transform a normalized LLAAB task/context object into adapter-specific instructions.

## Phase 10 — Add CLI Commands

Add or extend CLI commands such as:

```sh
llaab adapters list
llaab adapters doctor
llaab route "<task>"
llaab plan "<task>"
llaab execute "<task>" --adapter opencode
llaab reduce --model gemma
llaab skill create
llaab skill sync --adapter hermes
```

Useful diagnostics:

```sh
llaab adapters doctor
```

Should report:

- available adapters
- missing binaries
- missing API keys
- local model availability
- configured defaults
- fallback chain

## Phase 11 — Testing Strategy

Add tests for:

- adapter registry
- routing decisions
- capability matching
- config overrides
- prompt rendering
- context bundle creation
- fallback behavior

Avoid tests that require real LLM calls by default.

Use fake adapters.

Example fake adapters:

- `FakeLocalModelAdapter`
- `FakeCodingExecutorAdapter`
- `FakeHermesAdapter`

## Phase 12 — Documentation

Add docs:

```text
docs/architecture/adapters.md
docs/architecture/routing.md
docs/integrations/hermes.md
docs/integrations/opencode.md
docs/integrations/cline.md
docs/integrations/gemma.md
docs/integrations/ollama.md
```

Explain:

- LLAAB owns memory/context
- adapters are replaceable
- Hermes is optional
- OpenCode/Cline are coding executors
- Gemma is a local model adapter
- cloud providers are fallback adapters

## Phase 13 — Suggested First Vertical Slice

Implement the smallest useful end-to-end flow:

```text
User task
  ↓
LLAAB creates context bundle
  ↓
Gemma reduces/summarizes locally
  ↓
LLAAB creates implementation plan
  ↓
OpenCode receives plan
  ↓
OpenCode executes repo changes
```

Then add Hermes:

```text
Hermes receives task
  ↓
Hermes asks LLAAB for context bundle
  ↓
LLAAB routes summarization to Gemma
  ↓
LLAAB routes implementation to OpenCode
  ↓
Hermes reports status / stores skill
```

## Non-Goals

Do not:

- rebuild Hermes inside LLAAB
- make Hermes required
- make OpenCode required
- make Cline required
- hardcode model names into core logic
- let provider SDKs leak into core
- put secrets in repo config
- couple memory format to one runtime

## Acceptance Criteria

The refactor is successful when:

- LLAAB can list available adapters
- LLAAB can route by capability
- Gemma/local model can be used for low-cost reasoning tasks
- OpenCode or Cline can be selected as coding executors
- Hermes can be integrated as an optional orchestrator
- cloud APIs are fallback paths, not the default
- project memory remains portable and adapter-neutral

```
My own recommendation: treat **Cline as “OpenCode-like, but editor/human-loop centric.”** Worth supporting as an adapter, not worth making the conceptual centre.
```
