import { cn } from '@llaab/ui/lib/utils';
import { AiLatencyMeter, AiLatencyMeterCompact } from 'components/ui/ai-latency-meter';
import { AiTokenViewer, AiTokenViewerHeader, AiTokenViewerStats } from 'components/ui/ai-token-viewer';

export interface ExtractionModelCardProps {
  model?: string;
  provider?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** "compact" — latency badge for list items; "full" — token viewer card for detail views */
  variant?: 'compact' | 'full';
  className?: string;
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

  const hasTokens = promptTokens != null || completionTokens != null;

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
