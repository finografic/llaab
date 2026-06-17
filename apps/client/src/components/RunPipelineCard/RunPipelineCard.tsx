import { cn } from '@llaab/ui/lib/utils';
import {
  AiChainOfThought,
  AiChainOfThoughtContent,
  AiChainOfThoughtHeader,
  AiChainOfThoughtStep,
} from 'components/ui/elements/ai-chain-of-thought';
import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RunPipelineLink, RunPipelineStepData } from './run-pipeline-card.utils';
import type { RunEvent } from '@llaab/schemas';
import type { ReactNode } from 'react';

import { PipelineActivityFeed } from './components/PipelineActivityFeed';
import { PipelineStepMeta } from './components/PipelineStepMeta';
import { formatMonitorDateTime } from './run-pipeline-card.utils';
import styles from './RunPipelineCard.module.css';

export interface RunPipelineCardProps {
  headerTitle: ReactNode;
  headerHref?: string;
  headerSubtitle?: string;
  headerMeta?: ReactNode;
  headerBadge?: ReactNode;
  steps: RunPipelineStepData[];
  summary?: string;
  metaLinks?: RunPipelineLink[];
  metaTimestampIso?: string;
  metaNodeCount?: number;
  events?: RunEvent[];
  modelBar?: ReactNode;
  footer?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function StepItems({ items }: { items: RunPipelineLink[] }) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.itemList}>
      {items.map((item) => (
        <li key={item.href}>
          <Link to={item.href} className={styles.itemLink}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StepBody({ step }: { step: RunPipelineStepData }) {
  const hasBody = step.children || (step.items?.length ?? 0) > 0 || step.detail;

  if (!hasBody) return null;

  return (
    <>
      {step.children}
      {step.items ? <StepItems items={step.items} /> : null}
      {step.detail ? <p className={styles.stepDetail}>{step.detail}</p> : null}
    </>
  );
}

export function RunPipelineCard({
  headerTitle,
  headerHref,
  headerSubtitle,
  headerMeta,
  headerBadge,
  steps,
  summary,
  metaLinks,
  metaTimestampIso,
  metaNodeCount,
  events,
  modelBar,
  footer,
  defaultOpen = true,
  className,
}: RunPipelineCardProps) {
  const hasIntro = Boolean(summary || metaLinks?.length || metaTimestampIso || metaNodeCount);
  const hasActivity = (events?.length ?? 0) > 0;
  const lastStepIndex = steps.length - 1;

  return (
    <AiChainOfThought className={cn(styles.chain, className)} defaultOpen={defaultOpen}>
      <AiChainOfThoughtHeader
        title={
          headerHref ? (
            <Link to={headerHref} className={styles.headerTitleLink}>
              {headerTitle}
            </Link>
          ) : (
            headerTitle
          )
        }
        showIcon={false}
        className={styles.header}
      >
        {headerSubtitle ? (
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {headerSubtitle}
          </span>
        ) : null}
        {headerBadge}
        {headerMeta}
      </AiChainOfThoughtHeader>

      <AiChainOfThoughtContent className={styles.content}>
        {hasIntro ? (
          <div className={styles.intro}>
            {summary ? <p className={styles.summary}>{summary}</p> : null}
            {metaLinks?.length || metaTimestampIso || metaNodeCount ? (
              <div className={styles.metaRow}>
                {metaLinks?.map((link) => (
                  <Link key={link.href} to={link.href} className={styles.metaLink}>
                    <ExternalLinkIcon size={13} aria-hidden />
                    <span className={styles.metaLinkText}>{link.label}</span>
                  </Link>
                ))}
                {metaTimestampIso ? (
                  <time dateTime={metaTimestampIso}>{formatMonitorDateTime(metaTimestampIso)}</time>
                ) : null}
                {metaNodeCount != null && metaNodeCount > 0 ? (
                  <span>
                    {metaNodeCount} {metaNodeCount === 1 ? 'node' : 'nodes'}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {steps.map((step, index) => (
          <AiChainOfThoughtStep
            key={step.id}
            status={step.status}
            title={step.title}
            isLast={index === lastStepIndex}
            meta={
              <PipelineStepMeta
                startedAt={step.startedAt}
                finalElapsedSecs={step.elapsedSecs}
                active={step.active ?? false}
                nodeCount={step.nodeCount}
              />
            }
          >
            <StepBody step={step} />
          </AiChainOfThoughtStep>
        ))}

        {hasActivity && events ? <PipelineActivityFeed events={events} /> : null}
        {modelBar ? <div className={styles.modelBar}>{modelBar}</div> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </AiChainOfThoughtContent>
    </AiChainOfThought>
  );
}

export { PipelineNodeCountMeta, PipelineStepMeta } from './components/PipelineStepMeta';
export type { RunPipelineLink, RunPipelineStepData } from './run-pipeline-card.utils';
export {
  buildIngestYoutubeMonitorSteps,
  buildMonitorPipelineSteps,
  formatMonitorDateTime,
  mapMonitorStepStatus,
} from './run-pipeline-card.utils';
