import { CheckIcon } from '@llaab/icons';
import { PipelineNodeCountMeta, RunPipelineCard } from 'components/RunPipelineCard/RunPipelineCard';
import type { RunPipelineStepData } from 'components/RunPipelineCard/RunPipelineCard';
import styles from 'components/RunPipelineCard/RunPipelineCard.module.css';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExtractionPhase, TranscriptData, TranscriptPhase } from '../ingest-form.types';
import type { StepStatus } from 'components/ui/elements/ai-chain-of-thought';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import { extractionStepTitle, stepLabel, transcriptStepTitle } from '../ingest-form.utils';
import { IdeaList } from './IdeaList';
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

  const steps = useMemo((): RunPipelineStepData[] => {
    const transcriptStep: RunPipelineStepData = {
      id: 'transcript',
      status: transcriptChainStepStatus(transcriptPhase),
      title: transcriptStepTitle(transcriptPhase),
      startedAt: transcriptStartedAt,
      elapsedSecs: transcriptElapsedSecs,
      active: transcriptPhase === 'processing',
      nodeCount: transcriptData ? 1 : undefined,
      items: transcriptData
        ? [{ label: transcriptData.filename, href: `/vault/transcripts/${transcriptData.id}` }]
        : undefined,
      children:
        transcriptPhase === 'failed' && transcriptError ? (
          <div className={styles.stepFailure}>
            <span className={styles.stepDetail}>{transcriptError}</span>
            <RetryButton onClick={onRetryIngest} disabled={busy} />
          </div>
        ) : undefined,
    };

    const extractionStep: RunPipelineStepData = {
      id: 'extraction',
      status: extractionChainStepStatus(extractionPhase),
      title: extractionStepTitle(extractionPhase),
      startedAt: extractionStartedAt,
      elapsedSecs: extractionElapsedSecs,
      active: extractionPhase === 'pending',
      nodeCount: extractionIdeas.length > 0 ? extractionIdeas.length : undefined,
      children: (
        <>
          {(extractionPhase === 'success' || extractionPhase === 'existing') && extractionIdeas.length > 0 ? (
            <IdeaList ideas={extractionIdeas} />
          ) : null}
          {extractionPhase === 'extractable' ? (
            <div className={styles.stepFailure}>
              <RetryButton onClick={onRetryExtract} disabled={busy} />
            </div>
          ) : null}
          {extractionPhase === 'failed' ? (
            <div className={styles.stepFailure}>
              {extractionError ? <span className={styles.stepDetail}>{extractionError}</span> : null}
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionRetry}`}
                onClick={onRetryExtract}
                disabled={busy}
                aria-label="Retry — re-run extraction against the saved transcript"
              >
                <RotateCcwIcon size={14} aria-hidden />
                <span>Retry</span>
              </button>
            </div>
          ) : null}
        </>
      ),
    };

    return [transcriptStep, extractionStep];
  }, [
    busy,
    extractionElapsedSecs,
    extractionError,
    extractionIdeas,
    extractionPhase,
    extractionStartedAt,
    onRetryExtract,
    onRetryIngest,
    transcriptData,
    transcriptElapsedSecs,
    transcriptError,
    transcriptPhase,
    transcriptStartedAt,
  ]);

  const footer = isComplete ? (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionKeep}`}
        onClick={onKeep}
        aria-label="Keep — confirm ingestion and clear the form"
      >
        <CheckIcon size={14} aria-hidden />
        <span>Keep</span>
      </button>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionDiscard}`}
        onClick={handleDiscard}
        disabled={discarding}
        aria-label="Discard — delete ingested nodes and clear the form"
      >
        <Trash2Icon size={14} aria-hidden />
        <span>Discard</span>
      </button>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionRetry}`}
        onClick={onRetry}
        disabled={discarding}
        aria-label="Retry — delete ingested nodes and re-run this ingest"
      >
        <RotateCcwIcon size={14} aria-hidden />
        <span>Retry</span>
      </button>
    </div>
  ) : null;

  return (
    <RunPipelineCard
      headerTitle="RUN"
      headerSubtitle={stepLabel(transcriptPhase, extractionPhase)}
      headerMeta={
        hasRunElapsed || totalNodeCount > 0 ? (
          <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground">
            <PipelineNodeCountMeta nodeCount={totalNodeCount} hasElapsed={hasRunElapsed} />
            {hasRunElapsed ? <span>{formatElapsed(displayRunElapsed)}</span> : null}
          </span>
        ) : null
      }
      steps={steps}
      footer={footer}
    />
  );
}
