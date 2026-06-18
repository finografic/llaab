import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'components/ui/alert-dialog';
import { QUERY_KEYS as RUN_KEYS, useRunMonitor, useRuns } from 'queries/runs';
import { useResolveCanonicalIdeaConflict } from 'queries/transcripts';
import { QUERY_KEYS as VAULT_KEYS, useVaultNodes } from 'queries/vault';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { TranscriptNode } from '@llaab/schemas';

import { findPendingCanonicalIdeaConflicts } from 'utils/canonical-idea-conflict.utils';

import styles from './CanonicalIdeaConflictWatcher.module.css';

const CONSOLIDATION_SKILL_ID = 'consolidate-canonical-ideas';

/**
 * App-wide watcher for canonical-idea consolidation conflicts. Consolidation survives navigation
 * (it's a tracked run, not page state) — this is what lets the "replace existing set?" prompt
 * surface no matter where you are when it finishes, derived purely from durable run/transcript
 * data rather than any page-local mutation state.
 */
export function CanonicalIdeaConflictWatcher() {
  const queryClient = useQueryClient();
  const { data: monitorData } = useRunMonitor();
  const { data: runs = [] } = useRuns();
  const { data: transcriptNodes = [] } = useVaultNodes({ type: 'transcript' });
  const { data: canonicalIdeaNodes = [] } = useVaultNodes({ type: 'canonical-idea' });
  const resolveConflictMutation = useResolveCanonicalIdeaConflict();
  const previousActiveIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeConsolidationIds = new Set(
      (monitorData?.active ?? [])
        .filter((run) => run.skill_id === CONSOLIDATION_SKILL_ID)
        .map((run) => run.id),
    );

    const justCompleted = [...previousActiveIds.current].some((id) => !activeConsolidationIds.has(id));
    previousActiveIds.current = activeConsolidationIds;

    if (justCompleted) {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
    }
  }, [monitorData, queryClient]);

  const transcriptsById = useMemo(() => {
    const transcripts = transcriptNodes as TranscriptNode[];
    return new Map(transcripts.map((transcript) => [transcript.id, transcript]));
  }, [transcriptNodes]);

  const canonicalIdeaNodeIds = useMemo(
    () => new Set((canonicalIdeaNodes as Array<{ id: string }>).map((node) => node.id)),
    [canonicalIdeaNodes],
  );

  const conflicts = useMemo(
    () => findPendingCanonicalIdeaConflicts(runs, transcriptsById, canonicalIdeaNodeIds),
    [runs, transcriptsById, canonicalIdeaNodeIds],
  );

  const conflict = conflicts[0];

  function handleResolve(keep: 'existing' | 'incoming') {
    if (!conflict) return;

    resolveConflictMutation.mutate(
      {
        transcriptId: conflict.transcriptId,
        payload: {
          keep,
          incomingCanonicalIdeaIds: conflict.incomingCanonicalIdeaIds,
          existingCanonicalIdeaIds: conflict.existingCanonicalIdeaIds,
          pendingCoverage: conflict.pendingCoverage,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            keep === 'incoming'
              ? `Replaced canonical ideas for "${conflict.transcriptTitle}".`
              : `Kept existing canonical ideas for "${conflict.transcriptTitle}".`,
          );
          // findPendingCanonicalIdeaConflicts recomputes from these two queries — without
          // refreshing them the dialog keeps re-deriving the same now-resolved conflict from
          // stale cached data and never closes, even though the resolve call itself succeeded.
          void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
          void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to resolve canonical idea conflict.');
        },
      },
    );
  }

  return (
    <AlertDialog open={conflict != null}>
      <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Replace existing set of canonical ideas with incoming set?
            {conflict ? <span className={styles.transcriptTitle}>{conflict.transcriptTitle}</span> : null}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <span className={styles.scores}>
              <span className={styles.row}>
                <span className={styles.label}>Existing:</span>{' '}
                <span className={styles.quality}>
                  {conflict?.existingQualityScore != null
                    ? `Quality ${conflict.existingQualityScore}%`
                    : 'Quality unavailable'}
                </span>
              </span>
              <span className={styles.row}>
                <span className={`${styles.label} ${styles.labelStrong}`}>Incoming:</span>{' '}
                <span
                  className={`${styles.quality} ${styles.qualityStrong} ${
                    conflict != null &&
                    conflict.existingQualityScore != null &&
                    conflict.incomingQualityScore < conflict.existingQualityScore
                      ? styles.qualityWarning
                      : ''
                  }`}
                >
                  Quality {conflict?.incomingQualityScore}%
                </span>
              </span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={resolveConflictMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleResolve('existing');
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={resolveConflictMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleResolve('incoming');
            }}
          >
            Replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
