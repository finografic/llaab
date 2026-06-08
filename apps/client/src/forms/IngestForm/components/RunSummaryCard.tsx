import { CheckIcon } from '@llaab/icons';
import { Spinner } from 'components/ui/spinner';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import type { ExtractionPhase, TranscriptPhase } from '../ingest-form.types';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import { runPhase, stepLabel } from '../ingest-form.utils';
import { NodeCountMeta } from './NodeCountMeta';

export function RunSummaryCard({
  transcriptPhase,
  extractionPhase,
  busy,
  runStartedAt,
  totalElapsedSecs,
  nodeCount,
  onKeep,
  onDiscard,
  onRetry,
}: {
  transcriptPhase: TranscriptPhase;
  extractionPhase: ExtractionPhase;
  busy: boolean;
  runStartedAt: number | null;
  totalElapsedSecs: number | null;
  nodeCount?: number | null;
  onKeep: () => void;
  onDiscard: () => Promise<void>;
  onRetry: () => void;
}) {
  const phase = runPhase(transcriptPhase, extractionPhase, busy);
  const liveElapsed = useElapsedSeconds(phase === 'active' ? runStartedAt : null);
  const displayElapsed = totalElapsedSecs != null ? totalElapsedSecs : liveElapsed;

  const transcriptDone = ['saved', 'reused', 'failed'].includes(transcriptPhase);
  const extractionDone = ['success', 'existing', 'extractable', 'failed'].includes(extractionPhase);
  const isComplete = transcriptDone && extractionDone && !busy;

  const [discarding, setDiscarding] = useState(false);

  const handleDiscard = async () => {
    setDiscarding(true);
    await onDiscard();
    setDiscarding(false);
  };

  const statusIcon =
    phase === 'active' ? (
      <Spinner className="size-4" aria-hidden />
    ) : phase === 'success' || phase === 'warning' ? (
      <CheckIcon className="pipeline-icon" aria-hidden />
    ) : null;

  const hasElapsed = runStartedAt != null;

  return (
    <div className={`pipeline-card pipeline-card--${phase} pipeline-card--summary`}>
      <div className="pipeline-card__main">
        <div className="pipeline-card__row">
          <div className="pipeline-summary__left">
            <div className="pipeline-card__status">{statusIcon}</div>
            <span className="pipeline-card__label">Run</span>
            <span className="pipeline-summary__step">{stepLabel(transcriptPhase, extractionPhase)}</span>
          </div>
          <div className="pipeline-card__meta">
            <NodeCountMeta nodeCount={nodeCount} hasElapsed={hasElapsed} />
            {hasElapsed ? (
              <span className="pipeline-card__elapsed">{formatElapsed(displayElapsed)}</span>
            ) : null}
          </div>
        </div>

        {isComplete ? (
          <div className="pipeline-summary__actions">
            <button
              type="button"
              className="pipeline-action-btn pipeline-action-btn--keep"
              onClick={onKeep}
              aria-label="Keep — confirm ingestion and clear the form"
            >
              <CheckIcon size={14} aria-hidden />
              <span>Keep</span>
            </button>
            <button
              type="button"
              className="pipeline-action-btn pipeline-action-btn--discard"
              onClick={handleDiscard}
              disabled={discarding}
              aria-label="Discard — delete ingested nodes and clear the form"
            >
              <Trash2Icon size={14} aria-hidden />
              <span>Discard</span>
            </button>
            <button
              type="button"
              className="pipeline-action-btn pipeline-action-btn--retry"
              onClick={onRetry}
              disabled={discarding}
              aria-label="Retry — delete ingested nodes and re-run this ingest"
            >
              <RotateCcwIcon size={14} aria-hidden />
              <span>Retry</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
