import { cn } from '@llaab/ui/lib/utils';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'components/ui/accordion';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { ScrollArea } from 'components/ui/scroll-area';
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useRetryRun, useRunMonitor } from 'queries/runs';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { RunEvent, RunMonitorItem, RunMonitorStep } from '@llaab/schemas';

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function eventMessageClassName(level: RunEvent['level']) {
  if (level === 'error') return styles.activityMessageError;
  if (level === 'warning') return styles.activityMessageWarning;
  if (level === 'success') return styles.activityMessageSuccess;
  return styles.activityMessage;
}

function ActivityFeed({ events }: { events: RunEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className={styles.activity}>
      <span className={styles.activityTitle}>Activity</span>
      {events.map((event) => (
        <div key={event.id} className={styles.activityEvent}>
          <time className={styles.activityTime} dateTime={event.at}>
            {formatTime(event.at)}
          </time>
          <span className={eventMessageClassName(event.level)}>{event.message}</span>
        </div>
      ))}
    </div>
  );
}

function MonitorCard({ run }: { run: RunMonitorItem }) {
  const { dismissRun } = useRunMonitorState();
  const retryRun = useRetryRun();
  const isActive = isActiveRun(run);
  const isFailed = run.status === 'failed';
  const canRetry = isFailed && run.skill_id === 'ingest-youtube';
  const hasDetails =
    run.steps.length > 0 || run.events.length > 0 || run.model !== undefined || run.provider !== undefined;
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

      {hasDetails ? (
        <Accordion type="single" collapsible defaultValue={isActive || isFailed ? 'details' : undefined}>
          <AccordionItem value="details" className={styles.accordionItem}>
            <AccordionTrigger className={styles.accordionTrigger}>
              {run.steps.length > 0
                ? `${run.steps.length} step${run.steps.length === 1 ? '' : 's'}`
                : 'Activity'}
            </AccordionTrigger>
            <AccordionContent className={styles.accordionContent}>
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

              <ActivityFeed events={run.events} />

              <ExtractionModelCard
                variant="compact-bar"
                model={run.model}
                provider={run.provider}
                durationMs={run.duration_ms}
                promptTokens={run.prompt_tokens}
                completionTokens={run.completion_tokens}
                className={styles.modelBar}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {!isActive ? (
        <div className={styles.footer}>
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
          <Button type="button" variant="ghost" size="sm" onClick={() => dismissRun(run.id)}>
            <XIcon aria-hidden />
            Dismiss
          </Button>
        </div>
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
  const { isOpen, closeRunMonitor, dismissedRunIds } = useRunMonitorState();
  const { data, error, isLoading } = useRunMonitor({ refetchInterval: isOpen ? 3000 : false });
  const dismissedSet = useMemo(() => new Set(dismissedRunIds), [dismissedRunIds]);
  const active = data?.active ?? [];
  const recent = (data?.recent ?? []).filter((run) => !dismissedSet.has(run.id));

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
      variant="outline"
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
