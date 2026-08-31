# Process State Architecture

This rule is about **how the client observes work that's already running** — it is not about
adding automation. See `agent-execution.instructions.md` first: that rule (no schedulers, no
background server loops, no timer-driven LLM calls) is still non-negotiable and this file does not
relax it. Every process below is still started by one explicit trigger and still runs once.

## The rule

Any process worth showing status for (a run, a consolidation, an extraction, a future agent task)
must be:

1. **Durable from the moment it starts** — persisted as a `RunNode` (or equivalent) immediately,
   not after it finishes. `runSkill` already does this (`packages/skills/src/runner.ts`).
2. **Globally observable** — its live status (running/complete/failed, elapsed time, badge counts)
   must be derived from shared, durable query state (`useRunMonitor`, `useRuns`, the heartbeat
   store), never from a mutation's own `isPending`/local component state.

The test: if a user starts the process, navigates to an unrelated page, and comes back, the UI
must look exactly as if they'd never left. If it doesn't, something is reading from page-local
state that should be reading from durable state instead.

## Why this is a rule and not just good practice

Consolidation was already wired this way (`CanonicalIdeaConflictWatcher` derives the
replace/keep-existing prompt from durable run + transcript data so it works regardless of route),
but the transcript page's own clock/disabled-state still read `consolidateMutation.isPending` — a
React Query mutation hook's state, which lives and dies with the component instance. Two
symptoms, same root cause:

- Switching transcripts (forcing a remount via `key={transcript.id}`) made the "Consolidating…"
  badge bleed from the previous transcript onto the new one.
- Navigating away and back during an active consolidation made the clock disappear entirely, even
  though the run was still genuinely active server-side.

The fix was the same in both cases: stop trusting the mutation's local state, and instead look up
whether _this_ transcript has a matching active run in `useRunMonitor()`'s durable data, using that
run's own `started_at` for the clock. See `TranscriptDetail.tsx`'s `isConsolidating` /
`activeConsolidateRun` derivation for the pattern to copy.

## What this looks like in code

- A mutation hook (`useFooMutation`) is fine for _triggering_ work and for short-lived optimistic
  UI immediately after the click — but don't let `mutation.isPending` be the only source of truth
  for "is this still running" once any meaningful time has passed or navigation could occur.
- Cross-check `useRunMonitor()` (or the relevant durable list query) for a matching active run, and
  prefer its data (`started_at`, `status`) over local component state when both could apply.
- Elapsed-time clocks must read from the single shared heartbeat store (`lib/heartbeat.ts`), not
  `Date.now()` directly — mixing time sources is what caused the clock-drift bug fixed alongside
  this rule.
- A status surface that only lives on one page (a dialog, a badge, a clock) should be asked: "does
  this need to survive navigation?" If yes, it likely needs to move up to a layout-level watcher
  component (see `CanonicalIdeaConflictWatcher`), not just read durable data from a deeper page.

## When this doesn't apply

Trivial, instantaneous mutations with no meaningful "still running" window (e.g. a toggle, a
rename) don't need this — `isPending` for the duration of one request is fine. This rule is about
processes that take real time and that a user could plausibly navigate away from.
