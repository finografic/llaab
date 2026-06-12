import { cn } from '@llaab/ui/lib/utils';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { ScrollArea } from 'components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from 'components/ui/sheet';
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useRunMonitor } from 'queries/runs';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { RunMonitorItem, RunMonitorStep } from '@llaab/schemas';

import styles from './RunMonitor.module.css';

const ACTIVE_STATUSES = new Set<RunMonitorItem['status']>(['pending', 'running']);

function isActiveRun(run: RunMonitorItem) {
  return ACTIVE_STATUSES.has(run.status);
}

function formatDateTime(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusVariant(status: RunMonitorItem['status']) {
  if (status === 'failed') return 'destructive';
  if (status === 'completed') return 'default';
  return 'secondary';
}

function StepIcon({ step }: { step: RunMonitorStep }) {
  if (step.status === 'completed') {
    return <CheckCircle2Icon className={cn(styles.stepIcon, styles.stepIconCompleted)} size={16} />;
  }
  if (step.status === 'running') {
    return (
      <LoaderCircleIcon className={cn(styles.stepIcon, styles.stepIconRunning, 'animate-spin')} size={16} />
    );
  }
  if (step.status === 'failed') {
    return <XCircleIcon className={cn(styles.stepIcon, styles.stepIconFailed)} size={16} />;
  }
  if (step.status === 'pending') {
    return <ClockIcon className={styles.stepIcon} size={16} />;
  }
  return <CircleIcon className={styles.stepIcon} size={16} />;
}

function MonitorCard({ run }: { run: RunMonitorItem }) {
  const { dismissRun } = useRunMonitorState();
  const isActive = isActiveRun(run);
  const timestamp = formatDateTime(run.completed_at ?? run.started_at);
  const summary = run.output_summary ?? run.input_summary ?? run.error;

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <Link to={run.run_link.href} className={styles.title}>
            {run.title}
          </Link>
          {summary ? <p className={styles.summary}>{summary}</p> : null}
        </div>
        <Badge variant={getStatusVariant(run.status)}>{run.status}</Badge>
      </div>

      <div className={styles.meta}>
        {run.primary_link ? (
          <Link to={run.primary_link.href} className={styles.link}>
            <ExternalLinkIcon size={13} aria-hidden />
            <span className={styles.linkText}>{run.primary_link.label}</span>
          </Link>
        ) : null}
        {timestamp ? <time dateTime={run.completed_at ?? run.started_at}>{timestamp}</time> : null}
        {run.produced_node_count > 0 ? <span>{run.produced_node_count} nodes</span> : null}
      </div>

      {run.steps.length > 0 ? (
        <div className={styles.steps}>
          {run.steps.map((step) => (
            <div key={step.id} className={styles.step}>
              <StepIcon step={step} />
              <div>
                <div className={styles.stepTitle}>{step.title}</div>
                {step.detail ? <div className={styles.stepDetail}>{step.detail}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ExtractionModelCard
        variant="compact-bar"
        model={run.model}
        provider={run.provider}
        durationMs={run.duration_ms}
        promptTokens={run.prompt_tokens}
        completionTokens={run.completion_tokens}
        className={styles.modelBar}
      />

      {!isActive ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-end"
          onClick={() => dismissRun(run.id)}
        >
          <XIcon aria-hidden />
          Dismiss
        </Button>
      ) : null}
    </article>
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
        runs.map((run) => <MonitorCard key={run.id} run={run} />)
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
    </section>
  );
}

export function RunMonitor() {
  const { isOpen, setRunMonitorIsOpen, dismissedRunIds } = useRunMonitorState();
  const { data, error, isLoading } = useRunMonitor({ refetchInterval: isOpen ? 3000 : false });
  const dismissedSet = useMemo(() => new Set(dismissedRunIds), [dismissedRunIds]);
  const active = data?.active ?? [];
  const recent = (data?.recent ?? []).filter((run) => !dismissedSet.has(run.id));

  return (
    <Sheet open={isOpen} onOpenChange={setRunMonitorIsOpen}>
      <SheetContent side="right" className={styles.content}>
        <SheetHeader className="border-b border-border text-left">
          <SheetTitle>Run Monitor</SheetTitle>
          <SheetDescription>Durable run progress and recent outputs.</SheetDescription>
        </SheetHeader>
        <ScrollArea className={styles.scroll}>
          <div className={styles.body}>
            {error instanceof Error ? <p className={styles.error}>{error.message}</p> : null}
            {isLoading ? <p className={styles.empty}>Loading runs...</p> : null}
            <MonitorSection title="Active" runs={active} empty="No active runs." />
            <MonitorSection title="Recent" runs={recent} empty="No recent runs." />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function RunMonitorTrigger() {
  const { openRunMonitor } = useRunMonitorState();
  const { data } = useRunMonitor({ refetchInterval: false });
  const activeCount = data?.active.length ?? 0;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={styles.trigger}
      onClick={() => openRunMonitor()}
      aria-label={activeCount > 0 ? `Open run monitor, ${activeCount} active` : 'Open run monitor'}
    >
      <ActivityIcon aria-hidden />
      {activeCount > 0 ? <span className={styles.triggerBadge}>{activeCount}</span> : null}
    </Button>
  );
}
