import { cn } from '@llaab/ui/lib/utils';
import { AiLatencyMeter, AiLatencyMeterCompact } from 'components/ui/elements/ai-latency-meter';
import {
  AiTokenViewer,
  AiTokenViewerHeader,
  AiTokenViewerStats,
} from 'components/ui/elements/ai-token-viewer';
import { ArrowDownIcon, ArrowUpIcon, HashIcon, TimerIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ExtractionModelCardProps {
  model?: string;
  provider?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** "compact" — latency badge; "compact-bar" — inline model metadata; "full" — detail card */
  variant?: 'compact' | 'compact-bar' | 'full';
  className?: string;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CompactBarMetric({
  Icon,
  value,
  iconSize = 'size-3',
  iconClassName,
}: {
  Icon: LucideIcon;
  value: string;
  iconSize?: string;
  iconClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-muted-foreground">
      <Icon className={cn(iconSize, 'text-muted-foreground', iconClassName)} />
      {value}
    </span>
  );
}

export function ExtractionModelCard({
  model,
  provider,
  durationMs,
  promptTokens,
  completionTokens,
  variant = 'full',
  className,
}: ExtractionModelCardProps) {
  const hasTokens = promptTokens != null || completionTokens != null;

  if (variant === 'compact') {
    if (durationMs == null) return null;
    return (
      <AiLatencyMeter
        variant="compact"
        totalDuration={durationMs}
        className={cn('border-0 bg-transparent p-0 shadow-none', className)}
      >
        <AiLatencyMeterCompact />
      </AiLatencyMeter>
    );
  }

  if (variant === 'compact-bar') {
    const totalTokens = (promptTokens ?? 0) + (completionTokens ?? 0);
    const hasCompactBarContent = model || provider || hasTokens || durationMs != null;

    if (!hasCompactBarContent) return null;

    return (
      <div className={cn('flex w-full items-center justify-between gap-3 leading-none', className)}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {model ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {model}
            </span>
          ) : null}
          {provider ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {provider}
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {promptTokens != null ? (
            <CompactBarMetric Icon={ArrowUpIcon} value={promptTokens.toLocaleString()} />
          ) : null}
          {completionTokens != null ? (
            <CompactBarMetric Icon={ArrowDownIcon} value={completionTokens.toLocaleString()} />
          ) : null}
          {hasTokens ? <CompactBarMetric Icon={HashIcon} value={totalTokens.toLocaleString()} /> : null}
          {durationMs != null ? (
            <CompactBarMetric
              Icon={TimerIcon}
              value={formatDuration(durationMs)}
              iconSize="size-2.5"
              iconClassName="leading-none"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <AiTokenViewer
      inputTokens={promptTokens}
      outputTokens={completionTokens}
      model={model}
      className={className}
    >
      <AiTokenViewerHeader title="Extraction model" />
      {hasTokens ? <AiTokenViewerStats /> : null}
      {durationMs != null ? (
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latency</span>
          <AiLatencyMeter
            variant="compact"
            totalDuration={durationMs}
            className="border-0 bg-transparent p-0 shadow-none"
          >
            <AiLatencyMeterCompact />
          </AiLatencyMeter>
          {provider ? (
            <span className="ml-auto rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {provider}
            </span>
          ) : null}
        </div>
      ) : null}
    </AiTokenViewer>
  );
}
