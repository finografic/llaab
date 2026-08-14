import { CheckIcon } from '@llaab/icons';
import {
  buildMonitorPipelineSteps,
  PipelineNodeCountMeta,
  RunPipelineCard,
} from 'components/RunPipelineCard/RunPipelineCard';
import styles from 'components/RunPipelineCard/RunPipelineCard.module.css';
import { TagList } from 'components/TagList/TagList';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExtractionPhase, TranscriptData, TranscriptPhase } from '../ingest-form.types';
import type { RunMonitorItem } from '@llaab/schemas';
import type { RunPipelineStepData } from 'components/RunPipelineCard/RunPipelineCard';
import type { StepStatus } from 'components/ui/elements/ai-chain-of-thought';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import { extractionStepTitle, stepLabel, transcriptStepTitle } from '../ingest-form.utils';
import { IdeaList } from './IdeaList';
import { RetryButton } from './RetryButton';

function transcriptChainStepStatus(phase: TranscriptPhase): StepStatus {
  if (phase === 'processing') return 'active';
  if (phase === 'saved' || phase === 'reused') return 'complete';
  if (phase === 'failed') return 'warning';
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
  activeRun,
  lockedTags,
  contentNoun = 'Transcript',
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
  activeRun?: RunMonitorItem | null;
  lockedTags: string[];
  /** "Transcript" for YouTube/podcast, "Article" for web pages — drives shared step copy and links. */
  contentNoun?: string;
  onKeep: () => void;
  onDiscard: () => Promise<void>;
  onRetry: () => void;
  onRetryIngest: () => void;
  onRetryExtract: () => void;
}) {
  const activeRunStartedAt = activeRun?.started_at ? Date.parse(activeRun.started_at) : null;
  const liveRunElapsed = useElapsedSeconds(activeRun ? activeRunStartedAt : busy ? runStartedAt : null);
  const displayRunElapsed = activeRun ? liveRunElapsed : (totalElapsedSecs ?? liveRunElapsed);
  const hasRunElapsed = (activeRunStartedAt ?? runStartedAt) != null && displayRunElapsed != null;
  const isBusy = busy || activeRun != null;

  const transcriptDone = ['saved', 'reused', 'failed'].includes(transcriptPhase);
  const extractionDone = ['success', 'existing', 'extractable', 'failed'].includes(extractionPhase);
  const isComplete = transcriptDone && extractionDone && !isBusy;

  const [discarding, setDiscarding] = useState(false);

  const handleDiscard = async () => {
    setDiscarding(true);
    await onDiscard();
    setDiscarding(false);
  };

  const totalNodeCount = activeRun?.produced_node_count ?? (transcriptData ? 1 : 0) + extractionIdeas.length;

  const steps = useMemo((): RunPipelineStepData[] => {
    if (activeRun) return buildMonitorPipelineSteps(activeRun);

    const transcriptStep: RunPipelineStepData = {
      id: 'transcript',
      status: transcriptChainStepStatus(transcriptPhase),
      title: transcriptStepTitle(transcriptPhase, contentNoun),
      startedAt: transcriptStartedAt,
      elapsedSecs: transcriptElapsedSecs,
      active: transcriptPhase === 'processing',
      nodeCount: transcriptData ? 1 : undefined,
      items: transcriptData
        ? [
            {
              label: transcriptData.filename,
              href:
                contentNoun === 'Article'
                  ? `/vault/resources/${transcriptData.id}`
                  : `/vault/transcripts/${transcriptData.id}`,
            },
          ]
        : undefined,
      children:
        transcriptPhase === 'failed' && transcriptError ? (
          <div className={styles.stepFailure}>
            <span className={styles.stepDetail}>{transcriptError}</span>
            <RetryButton onClick={onRetryIngest} disabled={isBusy} />
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
          {lockedTags.length > 0 ? (
            <div className="pipeline-card__tags">
              <TagList tags={lockedTags} size="sm" />
            </div>
          ) : null}
          {(extractionPhase === 'success' || extractionPhase === 'existing') && extractionIdeas.length > 0 ? (
            <IdeaList ideas={extractionIdeas} />
          ) : null}
          {extractionPhase === 'extractable' ? (
            <div className={styles.stepFailure}>
              <RetryButton onClick={onRetryExtract} disabled={isBusy} />
            </div>
          ) : null}
          {extractionPhase === 'failed' ? (
            <div className={styles.stepFailure}>
              {extractionError ? <span className={styles.stepDetail}>{extractionError}</span> : null}
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionRetry}`}
                onClick={onRetryExtract}
                disabled={isBusy}
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
    activeRun,
    contentNoun,
    isBusy,
    extractionElapsedSecs,
    extractionError,
    extractionIdeas,
    extractionPhase,
    extractionStartedAt,
    lockedTags,
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
      headerSubtitle={activeRun ? 'Processing…' : stepLabel(transcriptPhase, extractionPhase, contentNoun)}
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
