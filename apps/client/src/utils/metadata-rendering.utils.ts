/** Matches http(s) URLs in plain text metadata strings. */
export const METADATA_URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

export interface MetadataLinkTargetOptions {
  /** Defaults to `_blank`. */
  target?: '_blank' | '_self' | '_parent' | '_top';
}

function decodeEscapedJsonQuotes(value: string): string {
  let candidate = value;

  for (let pass = 0; pass < 6; pass++) {
    const decoded = candidate.replace(/\\+"/g, '"');
    if (decoded === candidate) return candidate;
    candidate = decoded;
  }

  return candidate;
}

/**
 * Parse JSON stored in run/node metadata fields.
 * Handles YAML double- (and triple-) encoding where quotes appear as literal
 * `\"` / `\\\"` sequences — the frontmatter writer can re-stringify an already-
 * JSON-stringified summary, nesting the escaping a level deeper each time.
 */
export function parseMetadataJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let candidate = trimmed;
  for (let pass = 0; pass < 6; pass++) {
    try {
      const decoded = JSON.parse(candidate) as unknown;
      if (typeof decoded !== 'string') return decoded;

      const nested = decoded.trim();
      if (!nested || nested === candidate) return decoded;
      candidate = nested;
      continue;
    } catch {
      // Not parseable at this escape depth — unescape one more level and retry.
    }

    const unescaped = decodeEscapedJsonQuotes(candidate);
    if (unescaped === candidate) break;
    candidate = unescaped;
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
  if (parsed === undefined) return decodeEscapedJsonQuotes(value);
  return indent > 0 ? JSON.stringify(parsed, null, indent) : JSON.stringify(parsed);
}

/** Extract a top-level `url` field from skill run input metadata. */
export function extractMetadataUrl(value: string): string | undefined {
  const parsed = parseMetadataJson(value);
  if (!parsed || typeof parsed !== 'object' || parsed === null) {
    const [fallbackUrl] = value.match(METADATA_URL_PATTERN) ?? [];
    return fallbackUrl;
  }

  const { url } = parsed as Record<string, unknown>;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
}

function readMetadataStringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = (value as Record<string, unknown>)[field];
  if (typeof candidate !== 'string') return undefined;

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readMetadataStringFields(value: unknown, fields: string[]): string | undefined {
  for (const field of fields) {
    const candidate = readMetadataStringField(value, field);
    if (candidate) return candidate;
  }

  return undefined;
}

/** Human-facing subject title for a run (video/article title, idea title, etc.). */
export function extractRunSubjectTitle(run: {
  stages?: Array<{ status?: string; output?: unknown }>;
  output_summary?: string;
}): string | undefined {
  for (const stage of run.stages ?? []) {
    if (stage.status !== 'completed') continue;

    const stageTitle = readMetadataStringField(stage.output, 'title');
    if (stageTitle) return stageTitle;
  }

  if (run.output_summary) {
    const parsed = parseMetadataJson(run.output_summary);
    const summaryTitle = readMetadataStringField(parsed, 'title');
    if (summaryTitle) return summaryTitle;
  }

  return undefined;
}

/** Vault route for the primary artifact a run produced, when known. */
export function extractRunSubjectHref(run: {
  output_summary?: string;
  stages?: Array<{ name?: string; status?: string; output?: unknown }>;
}): string | undefined {
  if (run.output_summary) {
    const parsed = parseMetadataJson(run.output_summary);
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const id = readMetadataStringField(record, 'id');
      if (id) {
        const type = readMetadataStringField(record, 'type');
        if (type === 'transcript') return `/vault/transcripts/${id}`;
        if (type === 'source') return `/vault/sources/${id}`;

        return `/vault/nodes/${id}`;
      }
    }
  }

  for (const stage of run.stages ?? []) {
    if (stage.status !== 'completed') continue;

    if (stage.name === 'store:transcript') {
      const id = readMetadataStringField(stage.output, 'id');
      if (id) return `/vault/transcripts/${id}`;
    }

    if (stage.name === 'store:source') {
      const id = readMetadataStringField(stage.output, 'id');
      if (id) return `/vault/sources/${id}`;
    }
  }

  return undefined;
}

function parseMetadataDateToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.length === 8 && /^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T00:00:00.000Z`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Source publish date captured during ingestion (e.g. YouTube `uploadDate` on `fetch:youtube`). */
export function extractRunPublishedAt(run: {
  stages?: Array<{ name?: string; status?: string; output?: unknown }>;
}): string | undefined {
  for (const stage of run.stages ?? []) {
    if (stage.status !== 'completed') continue;

    const rawDate =
      stage.name === 'fetch:youtube'
        ? readMetadataStringField(stage.output, 'uploadDate')
        : readMetadataStringFields(stage.output, ['uploadDate', 'publishedAt', 'published_at']);
    if (!rawDate) continue;

    const iso = parseMetadataDateToIso(rawDate);
    if (iso) return iso;
  }

  return undefined;
}

/** Channel or author name captured during ingestion (e.g. YouTube `fetch:youtube` stage). */
export function extractRunAuthor(run: {
  stages?: Array<{ name?: string; status?: string; output?: unknown }>;
}): string | undefined {
  for (const stage of run.stages ?? []) {
    if (stage.status !== 'completed') continue;

    const channel = readMetadataStringField(stage.output, 'channel');
    if (channel) return channel;

    const author = readMetadataStringField(stage.output, 'author');
    if (author) return author;
  }

  return undefined;
}

/** Source node id produced or referenced by a run, when known. */
export function extractRunSourceId(run: {
  output_summary?: string;
  stages?: Array<{ name?: string; status?: string; output?: unknown; input?: unknown }>;
}): string | undefined {
  if (run.output_summary) {
    const parsed = parseMetadataJson(run.output_summary);
    const summarySourceId = readMetadataStringFields(parsed, ['sourceId', 'source_id']);
    if (summarySourceId) return summarySourceId;
  }

  for (const stage of run.stages ?? []) {
    if (stage.status !== 'completed') continue;

    const outputSourceId = readMetadataStringFields(stage.output, ['sourceId', 'source_id']);
    if (outputSourceId) return outputSourceId;

    const inputSourceId = readMetadataStringFields(stage.input, ['sourceId', 'source_id']);
    if (inputSourceId) return inputSourceId;

    if (stage.name !== 'store:source') continue;

    const outputId = readMetadataStringField(stage.output, 'id');
    if (outputId) return outputId;

    const inputId = readMetadataStringField(stage.input, 'id');
    if (inputId) return inputId;
  }

  return undefined;
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
