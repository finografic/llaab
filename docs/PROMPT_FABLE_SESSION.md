# Session Brief — LLAAB: LLM Transport Migration (+ conditional Process-State Audit)

Deferral note: the podcast ingest and vault/knowledge split validation checks in `ROADMAP.md#next`
are explicitly deferred for this run; do not perform them.

You are operating autonomously in the `llaab` monorepo. This brief is the authority for this
session. Read it fully before touching anything.

---

## 0. Operating rules (read first, they override task detail)

1. **Verification-first.** No change is "done" until `pnpm typecheck`, `pnpm test`, `pnpm lint`,
   and `pnpm build` pass. Run them yourself. Do not report success on unverified work.
2. **Green at every commit.** Pre-commit hooks run lint + format + typecheck. Every commit must be
   independently buildable and passing. Never `--no-verify`.
3. **Public API is frozen.** `routeLlm()`, `streamLlm()`, `getLlmStatus()` and every other export of
   `@llaab/llm` keep their exact signatures, return shapes, and error semantics. Consumers
   (`@llaab/ingestion`, `@llaab/skills`, `@llaab/server`) must compile **without edits**. If you
   believe a consumer edit is unavoidable, stop and write it up in the ledger instead of doing it.
4. **Scope discipline.** Do only what Sections 3 and 4 describe. Do not refactor adjacent code,
   rename things, "improve" formatting, upgrade unrelated deps, or fix unrelated lint noise.
   Log anything tempting under `Deferred / noticed` in the ledger.
5. **Do not touch:** the nested `vault/` repo (its own git repo, runtime data — never commit into
   it), `knowledge/`, ingest validation work, `docs/todo/ROADMAP.md` (except the one line described
   in §5), or anything Hermes/Telegram/Discord related.
6. **No git history operations.** Commits on your working branch only. No rebase of pushed work, no
   force-push, no tag deletion, no history rewriting.
7. **Ask-by-writing.** You cannot interactively ask the operator. When you hit a genuine fork that
   changes the contract, pick the **most conservative** option, implement it, and record the fork,
   your choice, and the rejected alternative in the ledger under `Decisions`.
8. **Stop conditions.** Stop and write a final ledger entry if: (a) a phase's acceptance criteria
   cannot be met after two honest attempts, (b) the change would require editing a consumer
   package's source, or (c) you would need to weaken or delete an existing test to go green.

---

## 1. Required reading before any edit

Read these in order. Do not skim; the constraints in them are real.

- `.agents/handoff.md` — project state snapshot. Sections **LLM Layer**, **Architecture**,
  **Stack**, **Local Dev Ops** are load-bearing for this session.
- `docs/todo/TODO_VERCEL_AI_SDK_MIGRATION.md` — the plan you are executing (Task A).
- `docs/todo/TODO_PROCESS_STATE_AUDIT.md` — Task B, including its
  `#blocked-on-a-prerequisite` section.
- `docs/todo/ROADMAP.md` — sections `Next` and `P1 → 1. Vercel AI SDK Transport Standardisation`.
- `.github/instructions/project/process-state-architecture.instructions.md` — the invariant Task B
  enforces.
- `.github/instructions/documentation/todo-done-docs.instructions.md` — TODO/DONE doc conventions
  you must follow when writing docs.
- `packages/llm/` in full — providers, executors, router, cache, catalogs, capability
  registration, LM Studio lifecycle controls.

If any of these files disagree with this brief, **the repo docs win on facts** (paths, names,
current behaviour) and **this brief wins on scope and process**. Note the disagreement in the ledger.

---

## 2. Continuity protocol — non-negotiable

This session may end abruptly (budget exhaustion, context limit, operator interrupt). A different
agent — likely a less capable one — must be able to resume without you. Continuity is a deliverable,
not a courtesy.

**Create and maintain `docs/todo/TODO_FABLE_MIGRATION_LEDGER.md`.** Rules:

- **Create it in your first commit, before any source change.** An empty plan with zero progress is
  a valid first state.
- **Update it at every phase boundary**, before starting anything long-running, and immediately
  before any context compaction.
- **It must be true at all times.** If a phase is half-done, say exactly which half. Never write
  aspirational status. A successor trusting a wrong ledger is worse than no ledger.
- Keep it under ~200 lines. Prune superseded detail; this is state, not a diary.
- No narration of routine edits. Phase-level facts only.

Required structure:

```markdown
# Fable Migration Ledger

Branch: <branch> · Started: <date> · Last updated: <date/commit>

## Status
<one paragraph: what is done, what is in flight, what is untouched>

## Resume here
<the single next concrete action a fresh agent should take, with file paths>

## Phase log
| Phase | State | Commit | Verified by |
| ----- | ----- | ------ | ----------- |
| A0 characterization tests | done | abc1234 | pnpm test (N passing) |
| A1 ... | in progress — X done, Y not started | — | — |

## Decisions
<fork encountered · option chosen · option rejected · why · where it's encoded in code>

## Deferred / noticed
<out-of-scope things you saw and did NOT do>

## Risks & landmines
<anything a successor could break without knowing>
```

**Commits are the other half of the handoff.** Conventional Commits (commitlint is enforced), one
logical phase per commit, message body stating what was verified. A successor should be able to
reconstruct the session from `git log` alone; the ledger just saves them the reading.

**Update `.agents/handoff.md` only at the end**, or when architecture genuinely changes. Obey its
own rules: present tense, no code snippets, under 150 lines total, update only changed sections,
never duplicate `.agents/memory.md`.

---

## 3. Task A — Vercel AI SDK transport standardisation (primary)

Adopt Vercel AI SDK Core as the transport inside `@llaab/llm` while preserving LLAAB's existing
surface and behaviour. Follow `TODO_VERCEL_AI_SDK_MIGRATION.md`; the phases below are the required
_shape_ of the work, and where that doc is more specific, it wins.

### Invariants that must survive

- `routeLlm()` / `streamLlm()` / `getLlmStatus()` signatures and return shapes.
- Task routing table and every `LLAAB_*_MODEL` env override.
- The 24h response cache — same key derivation, same hit/miss behaviour.
- Model catalogs and provider-qualified labels shown on `/llm`
  (e.g. `(Ollama) …`, `(LM Studio) …`), and persistence to `configs/llm-routing.json`.
- LM Studio lifecycle controls and `LLAAB_LMSTUDIO_BASE_URL` (default `http://localhost:1234/v1`).
- Ollama via the **chat** API, not `generate` — system/user separation must not regress.
- OpenCode registered as an external executor adapter that reports unavailable when the `opencode`
  binary is absent.
- RunNode telemetry: every field currently written by an LLM call still written, same names, same
  timing semantics.
- Deterministic validation and auto-retry behaviour in the extraction/consolidation paths.
- Token-aware chunking with overlap + reduce/dedupe of chunk outputs.

### Phases

**A0 — Characterization tests (do this first, commit before changing transport).**
Write tests that pin _current_ behaviour of `routeLlm`, `streamLlm`, cache keys and hits, routing
resolution under env overrides, error/timeout mapping, and RunNode telemetry field emission.
Use fixtures and fakes at the HTTP/provider boundary — **tests must not require a live Ollama, LM
Studio, or `opencode` binary**, and must pass on a machine with none of them running. These tests
are the migration's safety net; if you cannot pin a behaviour, record it in the ledger as an
unprotected area.

**A1 — Dependencies and boundary.**
Add the AI SDK packages to `packages/llm` only (never the workspace root, never a consumer package).
Define the internal adapter boundary: SDK-facing code isolated behind LLAAB's own types so the SDK
never leaks into exported signatures.

**A2 — Provider-by-provider migration.**
Migrate one provider per commit, tests green after each. Suggested order: Ollama → LM Studio →
Anthropic → OpenCode adapter. Do not migrate the next provider until the previous is verified.

**A3 — Streaming.**
Real streaming for LM Studio and OpenCode paths. Confirm the server's streaming surface and the
client's consumption of it are unchanged from the caller's point of view.

**A4 — Cross-cutting behaviour.**
Unify usage accounting, error mapping, and timeout handling through the SDK layer while keeping the
externally observed shapes identical. Add the typed structured-output path if
`TODO_VERCEL_AI_SDK_MIGRATION.md` specifies it; otherwise leave it for a follow-up and say so.

**A5 — Verification and documentation.**
Full `pnpm build && pnpm typecheck && pnpm test && pnpm lint`. Then update `.agents/handoff.md`
**LLM Layer** section and finalise the ledger.

### Build gotcha you must respect

TypeScript 7 resolves cross-package types through a `composite` package's **built `dist`
declarations**, not `paths`-mapped source. A stale `dist` surfaces as a confusing `TS2305`/`TS2883`
on an apparently unrelated consumer package. `turbo.json`'s `typecheck` now `dependsOn: ["^build",
"^typecheck"]`. When a type error looks impossible, **rebuild dependencies first** before believing
it. Do not "fix" a consumer to work around a stale build artifact.

### Acceptance criteria

- All consumers compile with zero source edits.
- Characterization tests from A0 pass unmodified. (If a test _must_ change, that is a behaviour
  change — stop, log it under `Decisions`, do not silently rewrite the test.)
- `/llm` still shows correct provider/model routing and availability.
- No new required runtime dependency on a live local provider for tests or typecheck.

---

## 4. Task B — Process-state audit (only if Task A is fully complete and verified)

Do **not** start this if Task A is unfinished. A complete Task A plus an untouched Task B is a good
outcome; two half-finished tasks is a bad one. If you have budget and Task A is committed and green:

Work `docs/todo/TODO_PROCESS_STATE_AUDIT.md`. Read its `#blocked-on-a-prerequisite` section first
and honour the stated prerequisite ordering — wrap the server-side transcript re-extraction workflow
in `runSkill` **before** deriving its UI state from the shared monitor.

The invariant, per `.github/instructions/project/process-state-architecture.instructions.md`: any
process with live-status UI derives that status from durable shared query state (`useRunMonitor`),
**never** from a mutation's own `isPending` or local component state — components remount (e.g.
switching transcripts) and lose it.

Also respect: `useRunMonitor`'s adaptive `refetchInterval` (2.5s active / 20s idle) is the single
source of truth for polling cadence. Callers must not pass a hardcoded override, and no component
may invalidate on every poll tick.

One commit per non-compliant surface fixed. Ledger updated per surface.

---

## 5. Definition of done

- Working branch with a clean, green, conventionally-committed history.
- `docs/todo/TODO_FABLE_MIGRATION_LEDGER.md` accurate as of the final commit.
- `.agents/handoff.md` updated for any architecture change (LLM Layer at minimum).
- If Task A is fully complete: per the repo's TODO/DONE conventions, rename
  `TODO_VERCEL_AI_SDK_MIGRATION.md` → `DONE_VERCEL_AI_SDK_MIGRATION.md`, update inbound links, and
  update the corresponding `ROADMAP.md` entries (`Next Large Initiative` and the `P1` item, plus a
  `Delivered` row). This is the **only** roadmap edit you are authorised to make.
- A final summary in the ledger: what shipped, what is unprotected by tests, what a human must
  verify manually.

---

## 6. If you are a successor agent picking this up

Read `docs/todo/TODO_FABLE_MIGRATION_LEDGER.md` → `Resume here` first, then `git log` on the
working branch, then this brief in full. Verify the ledger against reality by running the test and
typecheck suites **before** trusting its status. Every rule in Sections 0 and 2 applies to you
unchanged, regardless of which model you are.
