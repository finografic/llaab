import type { RunEvent, RunMonitorItem, RunMonitorStep } from '@llaab/schemas';
import type { StepStatus } from 'components/ui/elements/ai-chain-of-thought';
import type { ReactNode } from 'react';

export interface RunPipelineLink {
  label: string;
  href: string;
}

export interface RunPipelineStepData {
  id: string;
  status: StepStatus;
  title: string;
  nodeCount?: number;
  elapsedSecs?: number | null;
  startedAt?: number | null;
  active?: boolean;
  items?: RunPipelineLink[];
  detail?: string;
  children?: ReactNode;
}

export function mapMonitorStepStatus(status: RunMonitorStep['status']): StepStatus {
  switch (status) {
    case 'running':
      return 'active';
    case 'completed':
      return 'complete';
    case 'failed':
      return 'warning';
    case 'skipped':
    case 'pending':
      return 'pending';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function findEvent(run: RunMonitorItem, pattern: RegExp): RunEvent | undefined {
  return run.events.find((event) => pattern.test(event.message));
}

function stepStatusFromEvents(
  run: RunMonitorItem,
  activePattern: RegExp,
  successPattern: RegExp,
  failed: boolean,
): StepStatus {
  if (failed) return 'warning';
  if (run.status === 'running' || run.status === 'pending') {
    if (findEvent(run, activePattern)) return 'active';
  }
  if (findEvent(run, successPattern) || run.status === 'completed') return 'complete';
  if (findEvent(run, activePattern)) return 'active';
  return 'pending';
}

/** High-level transcript + extraction steps for ingest-youtube monitor rows. */
export function buildIngestYoutubeMonitorSteps(run: RunMonitorItem): RunPipelineStepData[] {
  const reused = Boolean(findEvent(run, /already saved|reused/i));
  const transcriptFailed = run.steps.some(
    (step) => /transcript|dedupe|fetch|store/i.test(step.title) && step.status === 'failed',
  );
  const extractionFailed = run.steps.some(
    (step) => /execute|extract/i.test(step.title) && step.status === 'failed',
  );

  const transcriptStatus = transcriptFailed
    ? 'warning'
    : reused
      ? 'warning'
      : stepStatusFromEvents(run, /fetching transcript|saved transcript/i, /saved transcript/i, false);

  const extractedEvent = findEvent(run, /extracted \d+ ideas?/i);
  const extractingEvent = findEvent(run, /extracting ideas/i);
  let extractionStatus: StepStatus = 'pending';
  if (extractionFailed || run.error) {
    extractionStatus = 'warning';
  } else if (extractedEvent) {
    extractionStatus = 'complete';
  } else if (extractingEvent || run.status === 'running') {
    extractionStatus = 'active';
  } else if (run.status === 'completed' && !extractedEvent) {
    extractionStatus = 'warning';
  }

  const transcriptTitle = transcriptFailed
    ? 'Transcript failed'
    : reused
      ? 'Transcript already saved'
      : transcriptStatus === 'active'
        ? 'Transcript processing'
        : transcriptStatus === 'complete'
          ? 'Transcript saved'
          : 'Transcript pending';

  const extractionTitle = extractionFailed
    ? 'Extraction failed'
    : extractedEvent
      ? 'Ideas extracted'
      : extractingEvent
        ? 'Extraction processing'
        : 'Extraction pending';

  const transcriptItems: RunPipelineLink[] = [];
  if (run.primary_link?.href.includes('/vault/transcripts/')) {
    transcriptItems.push(run.primary_link);
  }

  const ideaItems: RunPipelineLink[] = run.events
    .filter((event) => event.node_ids && event.node_ids.length > 0 && /extracted/i.test(event.message))
    .flatMap((event) =>
      (event.node_ids ?? []).map((id) => ({
        label: id,
        href: `/vault/nodes/${id}`,
      })),
    );

  const extractionNodeCount =
    ideaItems.length > 0 ? ideaItems.length : Math.max(0, run.produced_node_count - transcriptItems.length);

  return [
    {
      id: 'transcript',
      status: transcriptStatus,
      title: transcriptTitle,
      nodeCount: transcriptItems.length > 0 ? 1 : undefined,
      items: transcriptItems,
      detail: transcriptFailed ? run.steps.find((step) => step.status === 'failed')?.detail : undefined,
    },
    {
      id: 'extraction',
      status: extractionStatus,
      title: extractionTitle,
      nodeCount: extractionNodeCount > 0 ? extractionNodeCount : undefined,
      items: ideaItems,
      detail: extractionFailed ? run.error : undefined,
    },
  ];
}

export function buildMonitorPipelineSteps(run: RunMonitorItem): RunPipelineStepData[] {
  if (run.skill_id === 'ingest-youtube') {
    return buildIngestYoutubeMonitorSteps(run);
  }

  return run.steps.map((step) => ({
    id: step.id,
    status: mapMonitorStepStatus(step.status),
    title: step.title,
    detail: step.detail,
  }));
}

export function formatMonitorDateTime(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
