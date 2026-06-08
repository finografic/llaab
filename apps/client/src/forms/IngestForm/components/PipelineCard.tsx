import React from 'react';

import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import { NodeCountMeta } from './NodeCountMeta';

export function PipelineCard({
  phase,
  label,
  statusSlot,
  startedAt,
  finalElapsedSecs,
  nodeCount,
  children,
}: {
  phase: 'success' | 'warning' | 'neutral' | 'active';
  label: string;
  statusSlot: React.ReactNode;
  startedAt?: number | null;
  finalElapsedSecs?: number | null;
  nodeCount?: number | null;
  children?: React.ReactNode;
}) {
  const liveElapsed = useElapsedSeconds(phase === 'active' ? (startedAt ?? null) : null);
  const displayElapsed = phase === 'active' ? liveElapsed : (finalElapsedSecs ?? null);
  const bodyChildren = React.Children.toArray(children);
  const hasBody = bodyChildren.length > 0;
  const hasElapsed = startedAt != null && displayElapsed != null;

  return (
    <div className={`pipeline-card pipeline-card--${phase}`}>
      <div className="pipeline-card__main">
        <div className="pipeline-card__row">
          <div className="pipeline-card__title">
            <div className="pipeline-card__status">{statusSlot}</div>
            <span className="pipeline-card__label">{label}</span>
          </div>
          <div className="pipeline-card__meta">
            <NodeCountMeta nodeCount={nodeCount} hasElapsed={hasElapsed} />
            {hasElapsed ? (
              <span className="pipeline-card__elapsed">{formatElapsed(displayElapsed)}</span>
            ) : null}
          </div>
        </div>
        {hasBody ? <div className="pipeline-card__body">{bodyChildren}</div> : null}
      </div>
    </div>
  );
}
