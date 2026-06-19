# TODO — Terminal Agent and Hermes Integrations

> **Status:** Started. The terminal is the command surface. Agent and Hermes integrations should
> use typed commands, durable run records, and one-shot execution. Do not add an always-on agent
> process.

## Goal

Extend the Terminal Panel from a useful command console into the first shared launch surface for
LLAAB agents, future Hermes tasks, and other explicit automation commands.

The important architectural choice: the terminal should not become a second orchestration system.
It should submit typed command envelopes to the existing command bus. Handlers may call local
LLAAB code, Hermes, scripts, or future adapters, but all executions should produce structured
events and durable `RunNode` history.

## Constraints

- No always-on background agents, schedulers, watchers, or polling loops.
- Every agent/Hermes command is an explicit one-shot trigger.
- Terminal commands stay typed and parseable; raw shell is only the session-gated power-user path.
- Run status must be globally observable through persisted runs, not page-local terminal state.
- Hermes is an executor behind `agent.run`, not a parallel terminal protocol.

## Command Shape

Initial command family:

```ts
type AgentRunCommand = {
  kind: 'agent.run';
  executor?: 'llaab' | 'hermes';
  nodeId?: string;
  task?: string;
  taskId?: string;
  force?: boolean;
};
```

Terminal examples:

```bash
agent.run --executor llaab --force
agent.run --executor llaab nodes/transcripts/example.md
agent.run --executor hermes --task inbox-triage
agent.run --executor hermes --task-id task_123
```

`llaab` is the default executor and maps to the existing one-shot agent loop. `hermes` is reserved
until the Hermes adapter exists.

## Phase 1 — Command Protocol Foundation

- [x] Add `executor` to `agent.run`.
- [x] Reserve `hermes` as a typed executor value.
- [x] Add optional `task` and `taskId` fields for future task-oriented launch.
- [x] Update Terminal Panel parsing and suggestions.
- [x] Emit executor metadata before command execution.
- [x] Fail clearly when a requested executor is not implemented.

## Phase 2 — Executor Registry

- [ ] Add a small server-side agent executor registry.
- [ ] Move the local LLAAB one-shot handler behind the registry.
- [ ] Keep executor adapters explicit and side-effect-free until invoked.
- [ ] Return typed capability metadata for terminal autocomplete and future UI injection.

## Phase 3 — Hermes Adapter

- [ ] Define the Hermes task adapter boundary.
- [ ] Map `agent.run --executor hermes --task ...` to a Hermes one-shot call.
- [ ] Persist Hermes executions as `RunNode`s with command metadata.
- [ ] Stream Hermes progress as terminal `meta`, `stdout`, `stderr`, and `error` events.
- [ ] Link terminal completion to `/vault/runs/:id`.

## Phase 4 — Agent Task UX

- [ ] Add command presets for known agent tasks.
- [ ] Add task-specific argument help.
- [ ] Add node/transcript page actions that inject terminal commands.
- [ ] Add run detail links wherever a command persists a run.
- [ ] Add structured output cards for agent summary payloads.

## Phase 5 — Validation

- [ ] Typecheck core, server, and client after command protocol changes.
- [ ] Run a local `agent.run --executor llaab --force` smoke test.
- [ ] Confirm `agent.run --executor hermes --task example` fails with a clear not-implemented error.
- [ ] Confirm terminal output includes a run link after persisted command completion.

## Non-Goals

- No internal scheduler.
- No persistent Hermes worker owned by `apps/server`.
- No background LLM calls.
- No second command parser outside the typed command bus.
