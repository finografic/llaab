import { formatElapsed, useElapsedSeconds } from 'lib/heartbeat';

import styles from '../RunPipelineCard.module.css';

export function PipelineNodeCountMeta({
  nodeCount,
  hasElapsed,
}: {
  nodeCount?: number | null;
  hasElapsed: boolean;
}) {
  const hasNodeCount = nodeCount != null && nodeCount > 0;
  if (!hasNodeCount) return null;

  return (
    <>
      <span className={styles.nodeCount}>
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
      </span>
      {hasElapsed ? (
        <span className={styles.metaSep} aria-hidden="true">
          •
        </span>
      ) : null}
    </>
  );
}

export function PipelineStepMeta({
  startedAt,
  finalElapsedSecs,
  active,
  nodeCount,
}: {
  startedAt?: number | null;
  finalElapsedSecs?: number | null;
  active: boolean;
  nodeCount?: number | null;
}) {
  const liveElapsed = useElapsedSeconds(active ? (startedAt ?? null) : null);
  const displayElapsed = active ? liveElapsed : (finalElapsedSecs ?? null);
  const hasElapsed = startedAt != null && displayElapsed != null;

  if (!hasElapsed && (nodeCount == null || nodeCount <= 0)) return null;

  return (
    <span className="flex items-center gap-2">
      <PipelineNodeCountMeta nodeCount={nodeCount} hasElapsed={hasElapsed} />
      {hasElapsed ? <span>{formatElapsed(displayElapsed)}</span> : null}
    </span>
  );
}
