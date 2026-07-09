# Runtime Agents

> **Purpose:** Define the vocabulary, file locations, and boundaries for agents that LLAAB runs
> internally, so external coding agents do not reinvent the layout.

## Core Distinction

LLAAB uses two different agent categories:

| Term             | Meaning                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `external agent` | A tool that works on the LLAAB repo from outside: Codex, Claude Code, Cursor, Hermes, OpenCode, etc. |
| `runtime agent`  | An agent executed by LLAAB as part of the product/runtime.                                           |

The rule:

```text
External agent files instruct agents working on LLAAB.
Runtime agent files define agents that LLAAB runs.
```

Do not mix these two layers in the same file unless the file is only pointing to the canonical
runtime-agent documentation.

## Vocabulary

Use these terms consistently:

| Term               | Meaning                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `LLAAB agent`      | Umbrella term for runtime agents owned by LLAAB                     |
| `runtime agent`    | Canonical term for an agent executed by LLAAB                       |
| `local agent`      | Runtime agent that runs on the user's machine or Mac Studio         |
| `worker agent`     | Runtime agent that processes one job/run                            |
| `operator agent`   | Runtime agent with permission to act on behalf of the user          |
| `external agent`   | Codex/Claude/Cursor/Hermes/OpenCode-style agent working on the repo |
| `agent definition` | A promoted description/configuration of an agent LLAAB can run      |
| `agent draft`      | Working/generated candidate for a future agent definition           |

Prefer `runtime agent` unless the location, role, or permission level matters.

## File Placement

### External Agent Instructions

These files tell external tools how to work on the LLAAB repository:

```text
AGENTS.md
.github/instructions/
.claude/
.codex/
.cursor/
.mcp.json
Hermes/OpenCode/Codex/Claude local config
```

Use them for:

- repo editing rules
- coding conventions
- safety boundaries for development agents
- MCP/tool config for external tools
- links to runtime-agent architecture docs

Do not use them as the canonical home for runtime agent prompts, skills, or definitions.

### Runtime Agent Architecture

Use `docs/agents/` for source-controlled architecture and implementation rules:

```text
docs/agents/
  RUNTIME_AGENTS.md
  runtime-agent-lifecycle.md
  runtime-agent-permissions.md
  runtime-agent-tooling.md
```

Use this layer for:

- lifecycle rules
- permission models
- execution boundaries
- tool/MCP contracts
- implementation guidance for LLAAB-owned agents

### Promoted Agent Definitions

Use `knowledge/agents/` for reviewed, promoted runtime agent definitions:

```text
knowledge/agents/
  runtime-agents/
  worker-agents/
  operator-agents/
```

Use this layer for:

- stable agent definitions
- durable prompts/system contracts
- tool allowlists
- expected inputs/outputs
- reviewable agent behavior

These files travel with the source repo because they are mature, canonical LLAAB knowledge.

### Runtime Skills

Use `knowledge/skills/` for promoted, reusable skills:

```text
knowledge/skills/
  runtime/
  development/
```

Guidance:

- `knowledge/skills/runtime/` = skills LLAAB runtime agents can use.
- `knowledge/skills/development/` = mature skills for working on LLAAB itself.
- Tool-specific external-agent instructions still belong in `AGENTS.md` or `.github/instructions/`.

### Drafts and Generated Candidates

Use `vault/` for working material:

```text
vault/
  nodes/
  raw/
  ...
```

Use this layer for:

- generated agent candidates
- draft skills
- inbox captures
- experiment notes
- run traces
- extracted ideas

Promote from `vault/` to `knowledge/` only after review.

## MCP, Hooks, and Agentic Config

MCP and hooks follow the same distinction:

| Concern                        | Location                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| External-agent MCP config      | Tool-native config: `.mcp.json`, `.claude/`, `.codex/`, Hermes config, etc.                          |
| LLAAB runtime tool definitions | `docs/agents/` for architecture; `knowledge/agents/` or `knowledge/skills/` for promoted definitions |
| Repo-development hooks         | Existing dev-tooling hooks/config                                                                    |
| LLAAB runtime hooks/events     | Model as runtime tools/events; do not hide them in repo-development hooks                            |

Do not make runtime behavior depend on hidden development hooks.

## Implementation Rules

- Runtime agents must follow the one-shot processor pattern from
  `.github/instructions/project/agent-execution.instructions.md`.
- Runtime agent status must be durable and globally observable when shown in UI; see
  `.github/instructions/project/process-state-architecture.instructions.md`.
- Runtime agents must write through LLAAB APIs/tools, not arbitrary filesystem mutation.
- Runtime agents should produce `RunNode` traces for meaningful execution.
- Runtime agent definitions should include explicit inputs, outputs, tools, permissions, and failure
  behavior.
- Runtime agent drafts start in `vault/`; stable definitions move to `knowledge/`.
- External agents editing runtime-agent files must update this doc if they introduce new locations
  or lifecycle states.

## Recommended First Structure

When runtime-agent work begins, create only the folders that are needed:

```text
docs/agents/
  RUNTIME_AGENTS.md

knowledge/agents/
  runtime-agents/
  worker-agents/
  operator-agents/

knowledge/skills/
  runtime/
  development/
```

Avoid overbuilding. Add concrete files when the first runtime agent or runtime skill needs them.
