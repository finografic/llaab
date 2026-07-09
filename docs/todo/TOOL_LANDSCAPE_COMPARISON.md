# LLAAB — External Tool Landscape

> Purpose: categorize external tools by layer so integration decisions stay clear.
> Updated: 2026-07-09.

## Categories

| Layer                       | What it does                                                    | Tools                               |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Layer 0 — Context hygiene   | Controls read/search/shell context before it reaches agents     | LeanCTX                             |
| Layer 1 — Inference runtime | Runs LLM weights or exposes model APIs                          | Ollama, LM Studio, OpenCode Go      |
| Layer 2 — Coding agent      | Uses an LLM to read, edit, and execute code                     | OpenCode, Cline, Codex, Claude Code |
| Layer 3 — Autonomous agent  | Persistent memory, skills, messaging, and multi-agent workflows | Hermes, Agent Zero                  |

Layer 0 is not an agent. It is a context-control layer used by agents and coding tools.
LLAAB remains the knowledge management and orchestration platform above these layers.

## Layer 0 — Context Hygiene

LeanCTX is the current pilot candidate for controlling context size and reducing noisy reads
without making generated context artifacts part of LLAAB's canonical knowledge model.

Initial decision:

- Use Hybrid mode first for Codex/Claude/Cursor-style development tools.
- Keep Full MCP out of the first trial.
- Keep Hermes integration deferred until the local developer-agent workflow proves useful.
- Preserve raw `rg`, file reads, and shell commands as an escape hatch.
- Treat LeanCTX as context hygiene, not memory, not source of truth, and not a vault format.

Tracking plan: [`TODO_LEANCTX_PILOT.md`](./TODO_LEANCTX_PILOT.md).

## Layer 1 — Inference Runtimes

Ollama and LM Studio both run open-weight models locally. OpenCode Go cloud is available as a
remote provider through the LLM routing layer.

| Tool        | LLAAB relationship                                           | Status |
| ----------- | ------------------------------------------------------------ | ------ |
| Ollama      | Integrated as `ollamaProvider`                               | Active |
| LM Studio   | Integrated as `lmstudioProvider`; local MLX models available | Active |
| OpenCode Go | Integrated as a cloud provider option for routed tasks       | Active |

Operational notes:

- Ollama runs on local port `11434`.
- LM Studio runs OpenAI-compatible local API on port `1234`.
- OpenCode Go uses the configured cloud base URL and API key from env.

## Layer 2 — Coding Agents

Coding agents are consumers of context and tools. They should receive prepared context bundles
and task constraints rather than vague raw prompts.

| Tool        | Fit                               | Notes                                                               |
| ----------- | --------------------------------- | ------------------------------------------------------------------- |
| OpenCode    | Strong programmatic fit           | Terminal-first, scriptable, good future adapter target              |
| Cline       | Good manual IDE fit               | Useful in editor workflows; lower priority as a server-side adapter |
| Codex       | Primary collaborative dev surface | Good first LeanCTX pilot target                                     |
| Claude Code | Useful secondary dev surface      | Candidate after the Codex pilot is stable                           |

Design rules:

- External coding adapters receive prepared task/context bundles.
- External coding adapters must not write vault memory except through LLAAB APIs.
- Paid or cloud-backed calls must log provider, model, duration, and fallback reason.
- Expensive or risky calls should support explicit human confirmation.

## Layer 3 — Autonomous Agents

Hermes remains the best fit for messaging, skills, and persistent agent workflows around
LLAAB. Agent Zero is interesting for sandboxed OS-level execution, but it is lower priority.

| Tool       | LLAAB relationship                               | Status       |
| ---------- | ------------------------------------------------ | ------------ |
| Hermes     | Telegram/Discord-facing operator and inbox agent | Active pilot |
| Agent Zero | Possible sandboxed execution research path       | Not started  |

Near-term Hermes work should stay focused on reliable inbox capture, explicit routing,
useful receipts, and clean separation between Telegram inbox behavior and Discord operator
commands.

## Recommended Order

1. Finish LeanCTX developer-agent pilot in Hybrid mode.
2. Keep OpenCode Go routing stable for extraction/consolidation and future coding adapter work.
3. Continue Hermes inbox improvements and views.
4. Revisit Hermes + LeanCTX only after LeanCTX proves useful for local development.
5. Defer Agent Zero unless isolated execution becomes a concrete requirement.
