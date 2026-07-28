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

/** `dd-mm-yyyy hh:mm` for compact list rows (inbox, etc). */
export function formatCompactDateTime(ts?: string): string {
  if (!ts) return '—';
  const date = new Date(ts);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

/** Date-only (no time) for registry detail sidebars. */
export function formatDetailDateOnly(ts?: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** `dd-mm-yyyy` for compact table/list date columns. */
export function formatListDateNumeric(ts?: string): string {
  if (!ts) return '—';
  const date = new Date(ts);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Format duration in ms for run detail pages. Always in seconds, matching other run clocks in the app. */
export function formatDurationMs(ms?: number): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}
