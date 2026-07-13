import { toNodeId } from '@llaab/schemas';
import type { CanonicalIdeaNode, TranscriptNode, WikiEvidenceItem } from '@llaab/schemas';

/** A bounded transcript span with a stable paragraph locator for wiki provenance. */
export interface TranscriptSpan {
  locator?: string;
  text: string;
}

const TIMESTAMP_MARKER = /^<!--\s*t:([^\s]+)\s*-->\s*$/;

export function timestampToSeconds(locator: string): number | undefined {
  const parts = locator.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return undefined;
  }
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0]!, parts[1]!];
  if (minutes! >= 60 || seconds! >= 60) return undefined;
  return hours! * 3600 + minutes! * 60 + seconds!;
}

export function youtubeTimestampUrl(
  sourceUrl: string | undefined,
  locator: string | undefined,
): string | undefined {
  if (!sourceUrl || !locator) return undefined;
  const seconds = timestampToSeconds(locator);
  if (seconds === undefined) return undefined;
  try {
    const url = new URL(sourceUrl);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
      return undefined;
    }
    url.searchParams.set('t', String(seconds));
    return url.toString();
  } catch {
    return undefined;
  }
}

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function resolveTranscriptSpans(body: string): TranscriptSpan[] {
  const paragraphs: TranscriptSpan[] = [];
  let locator: string | undefined;
  let lines: string[] = [];

  function flush(): void {
    const text = lines.join(' ').trim();
    if (text) paragraphs.push({ locator: locator ?? `p:${paragraphs.length + 1}`, text });
    lines = [];
  }

  for (const line of body.split(/\r?\n/)) {
    const marker = TIMESTAMP_MARKER.exec(line.trim());
    if (marker) {
      flush();
      locator = marker[1];
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    lines.push(line.trim());
  }
  flush();
  return paragraphs;
}

export const parseTranscriptParagraphs = resolveTranscriptSpans;

export function buildWikiEvidence(
  transcript: TranscriptNode,
  canonicalIdeas: CanonicalIdeaNode[],
): WikiEvidenceItem[] {
  const paragraphs = resolveTranscriptSpans(transcript.body);

  return canonicalIdeas.flatMap((idea) => {
    const terms = new Set(tokenize([idea.title, idea.body, ...idea.key_claims].join(' ')));
    const ranked = paragraphs
      .map((paragraph, index) => ({
        paragraph,
        index,
        score: tokenize(paragraph.text).filter((token) => terms.has(token)).length,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 2);
    const selected: Array<{ paragraph: TranscriptSpan }> =
      ranked.length > 0 ? ranked : [{ paragraph: { text: transcript.summary ?? transcript.title } }];

    return selected.map(({ paragraph }, index) => ({
      id: toNodeId(`${idea.id}-${paragraph.locator ?? 'transcript'}-${index + 1}`),
      canonical_idea_id: idea.id,
      transcript_id: transcript.id,
      ...(transcript.source_id ? { source_id: transcript.source_id } : {}),
      source_url: youtubeTimestampUrl(transcript.source_url, paragraph.locator) ?? transcript.source_url,
      title: transcript.title,
      excerpt: paragraph.text,
      ...(paragraph.locator ? { locator: paragraph.locator } : {}),
      confidence: paragraph.locator ? ('high' as const) : ('medium' as const),
    }));
  });
}
