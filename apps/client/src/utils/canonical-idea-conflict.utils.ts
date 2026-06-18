import type { RunNode, TranscriptCanonicalCoverage, TranscriptNode } from '@llaab/schemas';

export interface PendingCanonicalIdeaConflict {
  runId: string;
  transcriptId: string;
  transcriptTitle: string;
  existingQualityScore?: number;
  incomingQualityScore: number;
  existingCanonicalIdeaIds: string[];
  incomingCanonicalIdeaIds: string[];
  pendingCoverage: TranscriptCanonicalCoverage;
}

interface ConsolidateStageOutput {
  conflict: boolean;
  canonicalIdeaIds: string[];
  existingCanonicalIdeaIds?: string[];
  existingQualityScore?: number;
  pendingCoverage?: TranscriptCanonicalCoverage;
  qualityValidation?: { score: number };
}

function isConsolidateStageOutput(value: unknown): value is ConsolidateStageOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'conflict' in value &&
    typeof (value as { conflict: unknown }).conflict === 'boolean' &&
    'canonicalIdeaIds' in value &&
    Array.isArray((value as { canonicalIdeaIds: unknown }).canonicalIdeaIds)
  );
}

function parseTranscriptId(inputSummary: string | undefined): string | undefined {
  if (!inputSummary) return undefined;

  try {
    const parsed = JSON.parse(inputSummary) as { transcriptId?: unknown };
    return typeof parsed.transcriptId === 'string' ? parsed.transcriptId : undefined;
  } catch {
    return undefined;
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = a.toSorted();
  const sortedB = b.toSorted();
  return sortedA.every((id, index) => id === sortedB[index]);
}

/**
 * Finds consolidate-canonical-ideas runs that produced a conflicting second canonical-idea set
 * which is still unresolved. Purely derived from already-fetched runs + transcripts + canonical
 * idea ids, so it works regardless of which page (if any) triggered the original consolidation.
 *
 * "Resolved" can happen two ways and both must be checked: replacing moves canonical_coverage to
 * the incoming set (coverage-based check), but keeping the existing set never touches
 * canonical_coverage at all — the only signal there is that the incoming candidate nodes were
 * deleted, so `existingCanonicalIdeaNodeIds` is required to catch that path too.
 */
export function findPendingCanonicalIdeaConflicts(
  runs: RunNode[],
  transcriptsById: Map<string, TranscriptNode>,
  existingCanonicalIdeaNodeIds: ReadonlySet<string>,
): PendingCanonicalIdeaConflict[] {
  // Newest-first so the per-transcript dedupe below keeps only the most recent conflicting run.
  const sortedRuns = runs.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  const conflictsByTranscript = new Map<string, PendingCanonicalIdeaConflict>();

  for (const run of sortedRuns) {
    if (run.skill_id !== 'consolidate-canonical-ideas' || run.run_status !== 'completed') continue;

    const output = run.stages.find((stage) => stage.name === 'execute')?.output;
    if (!isConsolidateStageOutput(output) || !output.conflict || !output.pendingCoverage) continue;

    const transcriptId = parseTranscriptId(run.input_summary);
    if (!transcriptId || conflictsByTranscript.has(transcriptId)) continue;

    const transcript = transcriptsById.get(transcriptId);
    if (!transcript) continue;

    const currentIds = transcript.canonical_coverage?.canonical_idea_ids ?? [];
    const existingIds = output.existingCanonicalIdeaIds ?? [];
    const incomingIds = output.pendingCoverage.canonical_idea_ids;

    const coverageStillPointsAtExisting =
      sameIds(currentIds, existingIds) && !sameIds(currentIds, incomingIds);
    const incomingNodesStillExist = incomingIds.some((id) => existingCanonicalIdeaNodeIds.has(id));
    const stillPending = coverageStillPointsAtExisting && incomingNodesStillExist;
    if (!stillPending) continue;

    conflictsByTranscript.set(transcriptId, {
      runId: run.id,
      transcriptId,
      transcriptTitle: transcript.title,
      existingQualityScore: output.existingQualityScore,
      incomingQualityScore: output.qualityValidation?.score ?? 0,
      existingCanonicalIdeaIds: existingIds,
      incomingCanonicalIdeaIds: incomingIds,
      pendingCoverage: output.pendingCoverage,
    });
  }

  return [...conflictsByTranscript.values()];
}
