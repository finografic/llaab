/** Locale-formatted date/time for vault detail pages. */
export function formatDetailDate(ts?: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format duration in ms for run detail pages. Always in seconds, matching other run clocks in the app. */
export function formatDurationMs(ms?: number): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}
