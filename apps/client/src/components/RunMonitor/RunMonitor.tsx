import { CheckCircleIcon, XIcon } from '@llaab/icons';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { buildMonitorPipelineSteps, RunPipelineCard } from 'components/RunPipelineCard/RunPipelineCard';
import { Button } from 'components/ui/button';
import { ScrollArea } from 'components/ui/scroll-area';
import { Spinner } from 'components/ui/spinner';
import { ActivityIcon, RotateCcwIcon } from 'lucide-react';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useDismissAllRuns, useDismissRun, useRetryRun, useRunMonitor } from 'queries/runs';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { RunMonitorItem } from '@llaab/schemas';
import type { ReactNode } from 'react';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import styles from './RunMonitor.module.css';

const ACTIVE_STATUSES = new Set<RunMonitorItem['status']>(['pending', 'running']);
const EMPTY_RUNS: RunMonitorItem[] = [];

function isActiveRun(run: RunMonitorItem) {
  return ACTIVE_STATUSES.has(run.status);
}

function MonitorStatusIcon({ run }: { run: RunMonitorItem }) {
  if (run.status === 'pending' || run.status === 'running') {
    return <Spinner className={styles.statusIconExtracting} aria-label={run.status} />;
  }

  switch (run.status) {
    case 'completed':
      return <CheckCircleIcon size={16} className={styles.statusIconCompleted} aria-label="Completed" />;
    case 'failed':
      return <XIcon size={16} className={styles.statusIconFailed} aria-label="Failed" />;
    case 'cancelled':
      return <XIcon size={16} className={styles.statusIconCancelled} aria-label="Cancelled" />;
    default: {
      const _exhaustive: never = run.status;
      return _exhaustive;
    }
  }
}

function MonitorDismissButton({
  runId,
  disabled,
  onDismiss,
}: {
  runId: string;
  disabled: boolean;
  onDismiss: (runId: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={styles.dismissIconButton}
      disabled={disabled}
      aria-label="Dismiss run"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss(runId);
      }}
    >
      <XIcon aria-hidden />
    </Button>
  );
}

function MonitorRunCard({ run }: { run: RunMonitorItem }) {
  const { dismissRun } = useRunMonitorState();
  const retryRun = useRetryRun();
  const dismissRunMutation = useDismissRun();
  const { mutate: dismissMutate } = dismissRunMutation;
  const isActive = isActiveRun(run);
  const isFailed = run.status === 'failed';
  const canRetry = isFailed && run.skill_id === 'ingest-youtube';
  const steps = useMemo(() => buildMonitorPipelineSteps(run), [run]);
  const metaLinks = useMemo(() => (run.primary_link ? [run.primary_link] : undefined), [run.primary_link]);
  const hasDetails =
    steps.length > 0 || run.events.length > 0 || run.model !== undefined || run.provider !== undefined;

  const startedAtMs = useMemo(() => (run.started_at ? Date.parse(run.started_at) : null), [run.started_at]);
  const liveElapsedSecs = useElapsedSeconds(isActive ? startedAtMs : null);

  const handleDismiss = (runId: string) => {
    dismissRun(runId);
    dismissMutate(runId);
  };

  const latencyMeta =
    isActive && startedAtMs != null ? (
      <span className="font-mono text-xs text-muted-foreground">{formatElapsed(liveElapsedSecs)}</span>
    ) : run.duration_ms != null ? (
      <span className="font-mono text-xs text-muted-foreground">{(run.duration_ms / 1000).toFixed(1)}s</span>
    ) : null;

  const headerMeta = (
    <span className={styles.headerMetaCluster}>
      {latencyMeta}
      {!isActive ? (
        <MonitorDismissButton
          runId={run.id}
          disabled={dismissRunMutation.isPending}
          onDismiss={handleDismiss}
        />
      ) : null}
    </span>
  );

  const headerTitle = (
    <span className={styles.titleWithStatus}>
      <span className={styles.statusIconSlot}>
        <MonitorStatusIcon run={run} />
      </span>
      <span className={styles.titleText}>{run.title}</span>
    </span>
  );

  const footer =
    canRetry && !isActive ? (
      <div className={styles.monitorFooter}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={retryRun.isPending}
          onClick={() => retryRun.mutate(run.id)}
        >
          <RotateCcwIcon aria-hidden className={retryRun.isPending ? 'animate-spin' : undefined} />
          Retry
        </Button>
      </div>
    ) : null;

  if (!hasDetails) {
    return (
      <article className={styles.cardCompact}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <Link to={run.run_link.href} className={styles.title}>
              {headerTitle}
            </Link>
          </div>
          {headerMeta}
        </div>
        {footer}
      </article>
    );
  }

  return (
    <RunPipelineCard
      className={styles.pipelineCard}
      headerTitle={headerTitle}
      headerHref={run.run_link.href}
      headerMeta={headerMeta}
      summary={run.output_summary ?? run.input_summary}
      metaLinks={metaLinks}
      metaTimestampIso={run.completed_at ?? run.started_at}
      metaNodeCount={run.produced_node_count}
      steps={steps}
      events={run.events}
      modelBar={
        run.model || run.provider || run.duration_ms != null || run.progress_tokens != null ? (
          <ExtractionModelCard
            variant="compact-bar"
            model={run.model}
            provider={run.provider}
            durationMs={run.duration_ms}
            promptTokens={run.prompt_tokens}
            completionTokens={run.completion_tokens ?? run.progress_tokens}
          />
        ) : null
      }
      footer={footer}
      defaultOpen={isActive || isFailed}
    />
  );
}

function MonitorSection({
  title,
  runs,
  empty,
  action,
}: {
  title: string;
  runs: RunMonitorItem[];
  empty: string;
  action?: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={styles.sectionHeaderMeta}>
          {action}
          <span className={styles.count}>{runs.length}</span>
        </div>
      </div>
      {runs.length > 0 ? (
        runs.map((run) => <MonitorRunCard key={run.id} run={run} />)
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
    </section>
  );
}

export function RunMonitor({ onClose }: { onClose: () => void }) {
  const { dismissRuns, dismissedRunIds } = useRunMonitorState();
  const { data, error, isLoading } = useRunMonitor({ refetchInterval: 3000 });
  const dismissAllRuns = useDismissAllRuns();
  const dismissedSet = useMemo(() => new Set(dismissedRunIds), [dismissedRunIds]);
  const active = useMemo(() => data?.active ?? EMPTY_RUNS, [data?.active]);
  const recent = useMemo(
    () => (data?.recent ?? EMPTY_RUNS).filter((run) => !dismissedSet.has(run.id)),
    [data?.recent, dismissedSet],
  );

  return (
    <aside className={styles.panel} aria-label="Activity Monitor">
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Activity Monitor</h2>
          <p className={styles.panelDescription}>
            Durable run and background-process progress and recent outputs.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close activity monitor"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </header>
      <ScrollArea className={styles.scroll}>
        <div className={styles.body}>
          {error instanceof Error ? <p className={styles.error}>{error.message}</p> : null}
          {isLoading ? <p className={styles.empty}>Loading runs...</p> : null}
          <MonitorSection title="Active" runs={active} empty="No active runs." />
          <MonitorSection
            title="Recent"
            runs={recent}
            empty="No recent runs."
            action={
              recent.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={dismissAllRuns.isPending}
                  onClick={() => {
                    dismissRuns(recent.map((run) => run.id));
                    dismissAllRuns.mutate();
                  }}
                >
                  <XIcon aria-hidden />
                  Dismiss all
                </Button>
              ) : null
            }
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

export function RunMonitorTrigger({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { data } = useRunMonitor();
  const activeCount = data?.active.length ?? 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={styles.trigger}
      onClick={onToggle}
      aria-pressed={isOpen}
      aria-label={
        activeCount > 0 ? `Toggle activity monitor, ${activeCount} active` : 'Toggle activity monitor'
      }
    >
      <ActivityIcon aria-hidden />
      {activeCount > 0 ? <span className={styles.triggerBadge}>{activeCount}</span> : null}
    </Button>
  );
}
