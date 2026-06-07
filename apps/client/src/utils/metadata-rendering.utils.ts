/** Matches http(s) URLs in plain text metadata strings. */
export const METADATA_URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

export interface MetadataLinkTargetOptions {
  /** Defaults to `_blank`. */
  target?: '_blank' | '_self' | '_parent' | '_top';
}

/**
 * Parse JSON stored in run/node metadata fields.
 * Handles YAML double-encoding where quotes appear as literal `\"` sequences.
 */
export function parseMetadataJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const candidates = [trimmed, trimmed.replace(/\\"/g, '"')];

  for (const candidate of candidates) {
    if (!candidate.startsWith('{') && !candidate.startsWith('[')) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }

  try {
    const decoded = JSON.parse(trimmed) as unknown;
    if (typeof decoded === 'string') {
      return parseMetadataJson(decoded);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/** Render metadata JSON as a readable string without escaped quote artifacts. */
export function formatMetadataJson(value: string, indent = 0): string {
  const parsed = parseMetadataJson(value);
  if (parsed === undefined) return value;
  return indent > 0 ? JSON.stringify(parsed, null, indent) : JSON.stringify(parsed);
}

/** Extract a top-level `url` field from skill run input metadata. */
export function extractMetadataUrl(value: string): string | undefined {
  const parsed = parseMetadataJson(value);
  if (!parsed || typeof parsed !== 'object' || parsed === null) return undefined;

  const url = (parsed as Record<string, unknown>).url;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
}

export interface MetadataTextSegment {
  type: 'text' | 'url';
  value: string;
  start: number;
}

/** Split plain text into text/url segments for link rendering. */
export function splitMetadataTextWithUrls(text: string): MetadataTextSegment[] {
  const segments: MetadataTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(METADATA_URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index), start: lastIndex });
    }
    segments.push({ type: 'url', value: match[0], start: index });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex), start: lastIndex });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text, start: 0 }];
}
