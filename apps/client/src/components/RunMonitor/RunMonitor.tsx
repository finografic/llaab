import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { buildMonitorPipelineSteps, RunPipelineCard } from 'components/RunPipelineCard/RunPipelineCard';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { ScrollArea } from 'components/ui/scroll-area';
import { ActivityIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useDismissRun, useRetryRun, useRunMonitor } from 'queries/runs';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { RunMonitorItem } from '@llaab/schemas';

import styles from './RunMonitor.module.css';

const ACTIVE_STATUSES = new Set<RunMonitorItem['status']>(['pending', 'running']);
const EMPTY_RUNS: RunMonitorItem[] = [];

function isActiveRun(run: RunMonitorItem) {
  return ACTIVE_STATUSES.has(run.status);
}

function getStatusVariant(status: RunMonitorItem['status']) {
  if (status === 'failed') return 'destructive';
  if (status === 'completed') return 'default';
  return 'secondary';
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

  const headerMeta =
    run.duration_ms != null ? (
      <span className="font-mono text-xs text-muted-foreground">{(run.duration_ms / 1000).toFixed(1)}s</span>
    ) : null;

  const footer = !isActive ? (
    <div className={styles.monitorFooter}>
      {canRetry ? (
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
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={dismissRunMutation.isPending}
        onClick={() => {
          dismissRun(run.id);
          dismissMutate(run.id);
        }}
      >
        <XIcon aria-hidden />
        Dismiss
      </Button>
    </div>
  ) : null;

  if (!hasDetails) {
    return (
      <article className={styles.cardCompact}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <Link to={run.run_link.href} className={styles.title}>
              {run.title}
            </Link>
          </div>
          <Badge variant={getStatusVariant(run.status)}>{run.status}</Badge>
        </div>
        {footer}
      </article>
    );
  }

  return (
    <RunPipelineCard
      className={styles.pipelineCard}
      headerTitle={run.title}
      headerHref={run.run_link.href}
      headerBadge={<Badge variant={getStatusVariant(run.status)}>{run.status}</Badge>}
      headerMeta={headerMeta}
      summary={run.output_summary ?? run.input_summary}
      metaLinks={metaLinks}
      metaTimestampIso={run.completed_at ?? run.started_at}
      metaNodeCount={run.produced_node_count}
      steps={steps}
      events={run.events}
      modelBar={
        run.model || run.provider || run.duration_ms != null ? (
          <ExtractionModelCard
            variant="compact-bar"
            model={run.model}
            provider={run.provider}
            durationMs={run.duration_ms}
            promptTokens={run.prompt_tokens}
            completionTokens={run.completion_tokens}
          />
        ) : null
      }
      footer={footer}
      defaultOpen={isActive || isFailed}
    />
  );
}

function MonitorSection({ title, runs, empty }: { title: string; runs: RunMonitorItem[]; empty: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={styles.count}>{runs.length}</span>
      </div>
      {runs.length > 0 ? (
        runs.map((run) => <MonitorRunCard key={run.id} run={run} />)
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
    </section>
  );
}

export function RunMonitor() {
  const { isOpen, closeRunMonitor, dismissedRunIds } = useRunMonitorState();
  const { data, error, isLoading } = useRunMonitor({ refetchInterval: isOpen ? 3000 : false });
  const dismissedSet = useMemo(() => new Set(dismissedRunIds), [dismissedRunIds]);
  const active = useMemo(() => data?.active ?? EMPTY_RUNS, [data?.active]);
  const recent = useMemo(
    () => (data?.recent ?? EMPTY_RUNS).filter((run) => !dismissedSet.has(run.id)),
    [data?.recent, dismissedSet],
  );

  return (
    <aside className={styles.panel} aria-label="Run Monitor">
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Run Monitor</h2>
          <p className={styles.panelDescription}>Durable run progress and recent outputs.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close run monitor"
          onClick={closeRunMonitor}
        >
          <XIcon aria-hidden />
        </Button>
      </header>
      <ScrollArea className={styles.scroll}>
        <div className={styles.body}>
          {error instanceof Error ? <p className={styles.error}>{error.message}</p> : null}
          {isLoading ? <p className={styles.empty}>Loading runs...</p> : null}
          <MonitorSection title="Active" runs={active} empty="No active runs." />
          <MonitorSection title="Recent" runs={recent} empty="No recent runs." />
        </div>
      </ScrollArea>
    </aside>
  );
}

export function RunMonitorTrigger() {
  const { isOpen, toggleRunMonitor } = useRunMonitorState();
  const { data } = useRunMonitor();
  const activeCount = data?.active.length ?? 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={styles.trigger}
      onClick={() => toggleRunMonitor()}
      aria-pressed={isOpen}
      aria-label={activeCount > 0 ? `Toggle run monitor, ${activeCount} active` : 'Toggle run monitor'}
    >
      <ActivityIcon aria-hidden />
      {activeCount > 0 ? <span className={styles.triggerBadge}>{activeCount}</span> : null}
    </Button>
  );
}
