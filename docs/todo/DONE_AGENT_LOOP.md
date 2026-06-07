# DONE — Agent Loop Infrastructure

> **Completed:** 2026-04-16 — all three phases implemented: registry + dedup index, one-shot
> processor, HTTP routes (`POST /api/agent/run`, `GET /api/agent/status`), CLI command
> (`lab agent run [--node] [--force]`). Source Auto-Follow slot reserved in registry (commented out).

---

## Core principle (non-negotiable)

**No always-on background processes. No file watchers. No polling loops.**

The agent loop is a **one-shot processor** — it scans the vault for unprocessed nodes,
runs matching skills, persists RunNodes, and exits. You control when it runs. Zero idle
cost. Fully intentional. Aligns with the project-wide rule in
`.github/instructions/project/13-agent-execution.instructions.md`.

---

## What this is

A processor you invoke explicitly. Each run is a discrete, auditable batch:

```
invoke (CLI / HTTP)
  → scan vault for unprocessed nodes
  → for each node: check registry → check dedup index → run skill
  → RunNode persisted per skill execution (runSkill already does this)
  → exit
```

Three trigger surfaces — LLAAB provides the mechanism, you control the schedule:

| Trigger                   | When to use                                  |
| ------------------------- | -------------------------------------------- |
| `lab agent run`           | On demand from terminal                      |
| `POST /api/agent/run`     | From UI button, CLI, or external integration |
| OS crontab / external job | Automated schedule — not owned by LLAAB      |

LLAAB does **not** own a scheduler. If you want it to run every hour, add a crontab entry.
That keeps the schedule visible, auditable, and under your control.

---

## Architecture

```
apps/server/src/agent/
  registry.ts       — NodeType → SkillName[] routing rules
  processed.ts      — dedup index (vault/.agent-loop/index.json)
  processor.ts      — one-shot scan + dispatch logic
  index.ts          — runAgentLoop() export

apps/server/src/routes/agent/
  agent.routes.ts   — Zod schemas
  agent.handlers.ts
  index.ts          — POST /api/agent/run, GET /api/agent/status

packages/cli/src/commands/
  agent.ts          — lab agent run
```

---

## Skill registry

Explicit routing rules — no magic inference. Adding a new skill to the loop = one line.

```ts
type SkillRoute = {
  nodeType: NodeType;
  skill:    string;
  filter?:  (node: VaultNode) => boolean;
};

const REGISTRY: SkillRoute[] = [
  { nodeType: 'transcript', skill: 'captureIdea' },
  // { nodeType: 'source', skill: 'ingestYouTube', filter: n => n.follow === true },
];
```

The Source Auto-Follow entry is commented out until that feature is built.

---

## Dedup index

Persisted at `vault/.agent-loop/index.json` (gitignored). Maps node ID → skills already
run on it. Survives process restarts — prevents reprocessing a node that was handled in a
previous run.

```ts
type ProcessedIndex = Record<string, string[]>;   // nodeId → skillNames[]

has(nodeId: string, skill: string): boolean
mark(nodeId: string, skill: string): void         // writes to disk
```

Reset by deleting the file — useful for re-processing all nodes during development.
`POST /api/agent/run` with `{ force: true }` re-runs all skills and clears the index.

---

## Server route

| Method | Path                | Description                                       |
| ------ | ------------------- | ------------------------------------------------- |
| POST   | `/api/agent/run`    | Run the processor once; optional `force` flag     |
| GET    | `/api/agent/status` | Last run timestamp, nodes processed, skills fired |

Request body for `POST /api/agent/run`:

```ts
z.object({
  nodeId: z.string().optional(),   // scope to one node; omit to process all pending
  force:  z.boolean().optional(),  // re-run even if already processed
})
```

The handler calls `runAgentLoop()` and returns when it completes. No background fire-and-forget.

---

## `captureIdea` wiring — what changes

Today `captureIdea` is triggered manually. After this, it fires automatically each time
`lab agent run` is invoked and finds unprocessed `TranscriptNode`s:

```
lab agent run
  → finds transcript.i-am-scared-but-excited (not yet processed)
  → REGISTRY: transcript → captureIdea
  → runSkill('captureIdea', execute, { transcriptId, content })
  → IdeaNode(s) created + RunNode persisted
  → processed index marked
```

The skill itself does not change. Only the trigger is new.

---

## Implementation phases

### Phase 1 — Registry + dedup index

- [ ] `registry.ts` — `SkillRoute[]`, `getSkillsFor(nodeType)` fn
- [ ] `processed.ts` — read/write `vault/.agent-loop/index.json`, `has` + `mark`
- [ ] `vault/.agent-loop/` added to `.gitignore`

### Phase 2 — One-shot processor

- [ ] `processor.ts` — `runAgentLoop(opts?)`: list nodes → registry lookup → dedup check → `runSkill`
- [ ] `index.ts` — exports `runAgentLoop`
- [ ] Integration test: drop a transcript node, run processor, assert IdeaNode created

### Phase 3 — HTTP route + CLI command

- [ ] `POST /api/agent/run` handler — calls `runAgentLoop`, returns summary JSON
- [ ] `GET /api/agent/status` — reads last-run metadata from processed index
- [ ] `lab agent run [--node <id>] [--force]` CLI command via citty

---

## Anti-patterns (hard rules — see project instructions)

- No file watcher (`chokidar` or otherwise) triggering skill execution
- No polling loop on an interval inside the server
- No `setInterval` / `setTimeout` background work
- No `AGENT_LOOP=true` always-on server mode
- If you want scheduled runs → OS crontab. LLAAB does not own the schedule.
