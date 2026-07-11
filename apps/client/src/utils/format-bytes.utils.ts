/** Format byte counts for registry install-size display (npmx-style). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'] as const;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  const rounded = value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[i]}`;
}
