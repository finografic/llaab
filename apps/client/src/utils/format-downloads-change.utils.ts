/** Format week-over-week download change for registry sidebars. */

export function formatDownloadsChangeParts(changePercent?: number): {
  arrow: string;
  percent: string;
  tone: 'up' | 'down' | 'flat';
} | null {
  if (changePercent == null || !Number.isFinite(changePercent)) return null;
  const abs = Math.abs(changePercent);
  const percent = `${abs >= 10 ? abs.toFixed(0) : abs.toFixed(1)}%`;
  if (changePercent > 0) return { arrow: '↑', percent, tone: 'up' };
  if (changePercent < 0) return { arrow: '↓', percent, tone: 'down' };
  return { arrow: '→', percent, tone: 'flat' };
}

/** Socket score band — matches trend green for high scores. */
export function socketScoreTone(score: number): 'ok' | 'warn' | 'danger' {
  if (score >= 80) return 'ok';
  if (score >= 50) return 'warn';
  return 'danger';
}
