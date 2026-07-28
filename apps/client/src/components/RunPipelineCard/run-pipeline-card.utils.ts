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

/**
 * High-level content + extraction steps for ingest monitor rows.
 *
 * Shared by `ingest-youtube`, `ingest-podcast`, and `ingest-article`; `noun` swaps the step copy and
 * the vault link family so an article run never reads as a transcript.
 */
export function buildIngestMonitorSteps(
  run: RunMonitorItem,
  noun: 'Transcript' | 'Article' = 'Transcript',
): RunPipelineStepData[] {
  const isArticle = noun === 'Article';
  const linkPrefix = isArticle ? '/vault/resources/' : '/vault/transcripts/';
  const fetchPattern = isArticle
    ? /fetching article|saved article/i
    : /fetching transcript|saved transcript/i;
  const savedPattern = isArticle ? /saved article/i : /saved transcript/i;

  const reused = Boolean(findEvent(run, /already saved|reused/i));
  const transcriptFailed = run.steps.some(
    (step) => /transcript|article|dedupe|fetch|store/i.test(step.title) && step.status === 'failed',
  );
  const extractionFailed = run.steps.some(
    (step) => /execute|extract/i.test(step.title) && step.status === 'failed',
  );
  const extractedEvent = findEvent(run, /extracted \d+ ideas?/i);
  const extractingEvent = findEvent(run, /extracting ideas/i);

  const transcriptStatus = transcriptFailed
    ? 'warning'
    : reused || extractingEvent || extractedEvent
      ? 'complete'
      : run.status === 'running' || run.status === 'pending'
        ? 'active'
        : stepStatusFromEvents(run, fetchPattern, savedPattern, false);

  let extractionStatus: StepStatus = 'pending';
  if (extractionFailed || run.error) {
    extractionStatus = 'warning';
  } else if (extractedEvent) {
    extractionStatus = 'complete';
  } else if (extractingEvent) {
    extractionStatus = 'active';
  } else if (run.status === 'completed' && !extractedEvent) {
    extractionStatus = 'warning';
  }

  const transcriptTitle = transcriptFailed
    ? `${noun} failed`
    : reused
      ? `${noun} already saved`
      : transcriptStatus === 'active'
        ? `${noun} processing`
        : transcriptStatus === 'complete'
          ? `${noun} saved`
          : `${noun} pending`;

  const extractionTitle = extractionFailed
    ? 'Extraction failed'
    : extractedEvent
      ? 'Ideas extracted'
      : extractingEvent
        ? 'Extraction processing'
        : 'Extraction pending';

  const transcriptItems: RunPipelineLink[] = [];
  if (run.primary_link?.href.includes(linkPrefix)) {
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

export const CONSOLIDATION_SKILL_ID = 'consolidate-canonical-ideas';

const STEP_TITLE_BY_STATUS: Record<string, Record<StepStatus, string>> = {
  [CONSOLIDATION_SKILL_ID]: {
    pending: 'Consolidation pending',
    active: 'Consolidating canonical ideas',
    complete: 'Canonical ideas consolidated',
    warning: 'Consolidation failed',
  },
  'compile-transcript-wikis': {
    pending: 'Wiki creation pending',
    active: 'Creating wiki pages',
    complete: 'Wiki pages published',
    warning: 'Wiki creation failed',
  },
  'compile-wiki-draft': {
    pending: 'Wiki topic pending',
    active: 'Compiling wiki topic',
    complete: 'Wiki topic compiled',
    warning: 'Wiki topic failed',
  },
};

export function buildMonitorPipelineSteps(run: RunMonitorItem): RunPipelineStepData[] {
  if (run.skill_id === 'ingest-article') {
    return buildIngestMonitorSteps(run, 'Article');
  }

  if (run.skill_id === 'ingest-youtube' || run.skill_id === 'ingest-podcast') {
    return buildIngestMonitorSteps(run, 'Transcript');
  }

  const titleByStatus = run.skill_id ? STEP_TITLE_BY_STATUS[run.skill_id] : undefined;

  // A skill's sole "execute" stage stays 'pending' on the persisted run node until it finishes —
  // there's no mid-run stage update — so while the run itself is still running, show it as active
  // rather than a frozen pending dot.
  return run.steps.map((step) => {
    const status: StepStatus =
      step.status === 'pending' && run.status === 'running' ? 'active' : mapMonitorStepStatus(step.status);

    return {
      id: step.id,
      status,
      title: titleByStatus?.[status] ?? step.title,
      detail: step.detail,
    };
  });
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
