/**
 * YouTube-style duration label.
 * Under 1 hour: `mm:ss`. At/over 1 hour: `h:mm:ss`.
 */
export function formatMediaDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Largest `<!-- t:… -->` marker in a structured transcript body, in seconds. */
export function mediaDurationSecondsFromTranscriptBody(body?: string): number | undefined {
  if (!body) return undefined;

  const markerRe = /<!--\s*t:(\d+):(\d{1,2})(?::(\d{1,2}))?\s*-->/g;
  let maxSeconds = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRe.exec(body)) !== null) {
    const seconds =
      match[3] != null
        ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
        : Number(match[1]) * 60 + Number(match[2]);

    if (Number.isFinite(seconds) && seconds > maxSeconds) maxSeconds = seconds;
  }

  return maxSeconds > 0 ? maxSeconds : undefined;
}
