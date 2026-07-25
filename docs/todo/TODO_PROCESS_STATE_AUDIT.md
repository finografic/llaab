# TODO — Process State Architecture Audit

> **Status:** Confirmed bug-class items fixed. Tracking doc for
> `.github/instructions/project/process-state-architecture.instructions.md` — migrate the items
> below opportunistically (e.g. when touching the relevant file for other reasons), not as a
> standalone sprint.

---

## Background

While fixing the canonical-idea consolidation feature, the same bug showed up twice: a
"Consolidating…" clock/badge on the transcript page read only `consolidateMutation.isPending` and
a local `useState` timestamp. Since `TranscriptDetail` remounts on transcript switch
(`key={transcript.id}` in `TranscriptsSplitView.tsx`), both the mutation state and the local timer
reset to "idle" the moment the component remounted — even though the consolidation run was still
genuinely active server-side. Symptoms: the badge bled from the previously-viewed transcript onto
a new one, and navigating away and back during a real run made the clock vanish entirely.

Fixed by cross-checking `useRunMonitor()`'s durable `active` list for a matching run and using
_its_ `started_at`, falling back to local mutation state only for the immediate post-click window.
See `TranscriptDetail.tsx`'s `isConsolidating` / `activeConsolidateRun` derivation as the pattern
to copy. Full rule: `process-state-architecture.instructions.md`.

This doc tracks where else in the client the same fragility exists, found via a one-time audit
(2026-06-19). Re-run a similar audit if this list goes stale.

---

## Confirmed bug-class risk

- [x] **Ingest form pipeline** (`apps/client/src/forms/IngestForm/IngestForm.tsx`,
      `ingest-form.types.ts`, `ingest-form.utils.ts`, `components/IngestPipeline.tsx`) —
      `transcriptPhase`, `extractionPhase`, `busy`, and every elapsed timer are pure
      `useState`, with no `useRunMonitor()`/`useRuns()` cross-check anywhere in the form. The
      underlying `ingest-youtube` skill **is** `runSkill`-backed (durable RunNode exists), so this
      is fixable today with the same pattern used for consolidation. Navigating away from
      `/ingest` mid-run and back currently loses all pipeline status even though the run is still
      active.
      Fixed by deriving active ingest state from the Activity Monitor query and using the
      run-backed initial ingest path for extraction; retry extraction remains covered by the
      separate prerequisite below.

## Fixed after prerequisite

- [x] **Transcript re-extraction status** (`TranscriptDetail.tsx` — `isExtracting`,
      `extractStatus`, `extractStatusClass`, `handleReExtract`) — previously had the same
      local-state-only fragility, and `extractTranscript`
      (`apps/server/src/routes/vault/vault-transcripts.routes.ts`) did not go through `runSkill`,
      so there was no durable RunNode to cross-check.
      Fixed by routing the server handler through the existing `extractTranscriptIdeas` skill and
      deriving active UI state from the shared run monitor for matching `extract-transcript-ideas`
      runs. Verified with a route regression that returns `runId` and persists produced idea IDs.

## Stylistic migration candidates (not bugs — fast, non-RunNode operations)

Low priority. These disable correctly today because the underlying mutation is fast enough that
the local-state-only window is negligible, and none of them are backed by a RunNode to cross-check
against anyway. Listed for completeness, not because they need to change:

- `dialogs/CleanVaultDialog/CleanVaultDialog.tsx` (`vaultClean.isPending`)
- `components/VaultGitPanel/VaultGitPanel.tsx` (`commitMutation`/`resetMutation.isPending`)
- `components/DeleteRunAction/`, `components/DeleteRunGroupAction/`
- `forms/CreateIdeaPanel.tsx` (`createIdea.isPending`)

## Already correct (reference implementations)

- `components/RunMonitor/RunMonitor.tsx`, `components/RunPipelineCard/components/PipelineStepMeta.tsx`
  — consume `useRunMonitor()` directly.
- `components/CanonicalIdeaConflictWatcher/` — derives conflict-prompt state purely from durable
  run + transcript data, mounted once at the `AppLayout` level so it works from any route.
- `TranscriptDetail.tsx`'s consolidation clock/badge (`isConsolidating`/`activeConsolidateRun`) —
  the fix that prompted this audit.
