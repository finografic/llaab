import { CheckIcon } from '@llaab/icons';
import {
  AiChainOfThought,
  AiChainOfThoughtContent,
  AiChainOfThoughtHeader,
  AiChainOfThoughtStep,
} from 'components/ui/elements/ai-chain-of-thought';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExtractionPhase, TranscriptData, TranscriptPhase } from '../ingest-form.types';
import type { StepStatus } from 'components/ui/elements/ai-chain-of-thought';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import { extractionStepTitle, stepLabel, transcriptStepTitle } from '../ingest-form.utils';
import { IdeaList } from './IdeaList';
import { NodeCountMeta } from './NodeCountMeta';
import { RetryButton } from './RetryButton';

function transcriptChainStepStatus(phase: TranscriptPhase): StepStatus {
  if (phase === 'processing') return 'active';
  if (phase === 'saved') return 'complete';
  if (phase === 'reused' || phase === 'failed') return 'warning';
  return 'pending';
}

function extractionChainStepStatus(phase: ExtractionPhase): StepStatus {
  if (phase === 'waiting' || phase === 'idle') return 'pending';
  if (phase === 'pending') return 'active';
  if (phase === 'success' || phase === 'existing') return 'complete';
  if (phase === 'extractable' || phase === 'failed') return 'warning';
  return 'pending';
}

function StepElapsedMeta({
  startedAt,
  finalElapsedSecs,
  active,
  nodeCount,
}: {
  startedAt?: number | null;
  finalElapsedSecs?: number | null;
  active: boolean;
  nodeCount?: number | null;
}) {
  const liveElapsed = useElapsedSeconds(active ? (startedAt ?? null) : null);
  const displayElapsed = active ? liveElapsed : (finalElapsedSecs ?? null);
  const hasElapsed = startedAt != null && displayElapsed != null;

  if (!hasElapsed && (nodeCount == null || nodeCount <= 0)) return null;

  return (
    <span className="flex items-center gap-2">
      <NodeCountMeta nodeCount={nodeCount} hasElapsed={hasElapsed} />
      {hasElapsed ? <span>{formatElapsed(displayElapsed)}</span> : null}
    </span>
  );
}

export function IngestPipeline({
  transcriptPhase,
  transcriptData,
  transcriptError,
  transcriptStartedAt,
  transcriptElapsedSecs,
  extractionPhase,
  extractionIdeas,
  extractionError,
  extractionStartedAt,
  extractionElapsedSecs,
  busy,
  runStartedAt,
  totalElapsedSecs,
  onKeep,
  onDiscard,
  onRetry,
  onRetryIngest,
  onRetryExtract,
}: {
  transcriptPhase: TranscriptPhase;
  transcriptData: TranscriptData | null;
  transcriptError: string | null;
  transcriptStartedAt: number | null;
  transcriptElapsedSecs: number | null;
  extractionPhase: ExtractionPhase;
  extractionIdeas: Array<{ id: string; title: string }>;
  extractionError: string | null;
  extractionStartedAt: number | null;
  extractionElapsedSecs: number | null;
  busy: boolean;
  runStartedAt: number | null;
  totalElapsedSecs: number | null;
  onKeep: () => void;
  onDiscard: () => Promise<void>;
  onRetry: () => void;
  onRetryIngest: () => void;
  onRetryExtract: () => void;
}) {
  const liveRunElapsed = useElapsedSeconds(busy ? runStartedAt : null);
  const displayRunElapsed = totalElapsedSecs ?? liveRunElapsed;
  const hasRunElapsed = runStartedAt != null && displayRunElapsed != null;

  const transcriptDone = ['saved', 'reused', 'failed'].includes(transcriptPhase);
  const extractionDone = ['success', 'existing', 'extractable', 'failed'].includes(extractionPhase);
  const isComplete = transcriptDone && extractionDone && !busy;

  const [discarding, setDiscarding] = useState(false);

  const handleDiscard = async () => {
    setDiscarding(true);
    await onDiscard();
    setDiscarding(false);
  };

  const totalNodeCount = (transcriptData ? 1 : 0) + extractionIdeas.length;

  return (
    <AiChainOfThought className="pipeline-chain" defaultOpen>
      <AiChainOfThoughtHeader title="RUN" showIcon={false} className="pipeline-chain__header">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {stepLabel(transcriptPhase, extractionPhase)}
        </span>
        {hasRunElapsed || totalNodeCount > 0 ? (
          <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground">
            <NodeCountMeta nodeCount={totalNodeCount} hasElapsed={hasRunElapsed} />
            {hasRunElapsed ? <span>{formatElapsed(displayRunElapsed)}</span> : null}
          </span>
        ) : null}
      </AiChainOfThoughtHeader>

      <AiChainOfThoughtContent className="pipeline-chain__content">
        <AiChainOfThoughtStep
          status={transcriptChainStepStatus(transcriptPhase)}
          title={transcriptStepTitle(transcriptPhase)}
          meta={
            <StepElapsedMeta
              startedAt={transcriptStartedAt}
              finalElapsedSecs={transcriptElapsedSecs}
              active={transcriptPhase === 'processing'}
              nodeCount={transcriptData ? 1 : null}
            />
          }
        >
          {transcriptData ? (
            <ul className="pipeline-card__item-list">
              <li>
                <Link to={`/vault/transcripts/${transcriptData.id}`} className="pipeline-card__link">
                  {transcriptData.filename}
                </Link>
              </li>
            </ul>
          ) : null}
          {transcriptPhase === 'failed' && transcriptError ? (
            <div className="pipeline-card__failure">
              <span className="pipeline-card__text">{transcriptError}</span>
              <RetryButton onClick={onRetryIngest} disabled={busy} />
            </div>
          ) : null}
        </AiChainOfThoughtStep>

        <AiChainOfThoughtStep
          status={extractionChainStepStatus(extractionPhase)}
          title={extractionStepTitle(extractionPhase)}
          isLast
          meta={
            <StepElapsedMeta
              startedAt={extractionStartedAt}
              finalElapsedSecs={extractionElapsedSecs}
              active={extractionPhase === 'pending'}
              nodeCount={extractionIdeas.length}
            />
          }
        >
          {(extractionPhase === 'success' || extractionPhase === 'existing') && extractionIdeas.length > 0 ? (
            <IdeaList ideas={extractionIdeas} />
          ) : null}
          {extractionPhase === 'extractable' ? (
            <div className="pipeline-card__failure">
              <RetryButton onClick={onRetryExtract} disabled={busy} />
            </div>
          ) : null}
          {extractionPhase === 'failed' ? (
            <div className="pipeline-card__failure">
              {extractionError ? <span className="pipeline-card__text">{extractionError}</span> : null}
              <button
                type="button"
                className="pipeline-action-btn pipeline-action-btn--retry"
                onClick={onRetryExtract}
                disabled={busy}
                aria-label="Retry — re-run extraction against the saved transcript"
              >
                <RotateCcwIcon size={14} aria-hidden />
                <span>Retry</span>
              </button>
            </div>
          ) : null}
        </AiChainOfThoughtStep>

        {isComplete ? (
          <div className="pipeline-summary__actions pipeline-chain__actions">
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
      </AiChainOfThoughtContent>
    </AiChainOfThought>
  );
}
