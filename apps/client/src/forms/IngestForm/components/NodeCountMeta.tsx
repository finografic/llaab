export function NodeCountMeta({ nodeCount, hasElapsed }: { nodeCount?: number | null; hasElapsed: boolean }) {
  const hasNodeCount = nodeCount != null && nodeCount > 0;
  if (!hasNodeCount) return null;

  return (
    <>
      <span className="pipeline-card__node-count">
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
      </span>
      {hasElapsed ? (
        <span className="pipeline-card__meta-sep" aria-hidden="true">
          •
        </span>
      ) : null}
    </>
  );
}
