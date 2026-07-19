import { toNodeId } from '@llaab/schemas';
import type { CanonicalIdeaNode, TranscriptNode, WikiEvidenceItem, WikiEvidenceRole } from '@llaab/schemas';

/** A bounded transcript span with a stable paragraph locator for wiki provenance. */
export interface TranscriptSpan {
  locator?: string;
  text: string;
}

export const WIKI_EVIDENCE_MAX_ITEMS = 24;
export const WIKI_EVIDENCE_MAX_EXCERPT_CHARS = 1_200;
export const WIKI_EVIDENCE_MAX_PACKET_CHARS = 16_000;
export const WIKI_EVIDENCE_MAX_ESTIMATED_TOKENS = 4_000;
const MAX_SPANS_PER_IDEA = 3;

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
  candidateTitlesByCanonicalId: Map<string, string[]> = new Map(),
  evidenceRoleByCanonicalId: Map<string, WikiEvidenceRole> = new Map(),
): WikiEvidenceItem[] {
  const paragraphs = resolveTranscriptSpans(transcript.body);
  const evidence = canonicalIdeas.flatMap((idea) => {
    const evidenceRole = evidenceRoleByCanonicalId.get(idea.id);
    const terms = new Set(
      tokenize(
        [
          idea.title,
          idea.body,
          ...idea.key_claims,
          ...(candidateTitlesByCanonicalId.get(idea.id) ?? []),
        ].join(' '),
      ),
    );
    const ranked = paragraphs
      .map((paragraph, index) => ({
        paragraph,
        index,
        score: tokenize(paragraph.text).filter((token) => terms.has(token)).length,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 2);
    const selectedIndexes = new Set<number>();
    for (const match of ranked) {
      selectedIndexes.add(match.index);
      if (match.index > 0 && tokenize(paragraphs[match.index - 1]!.text).some((token) => terms.has(token))) {
        selectedIndexes.add(match.index - 1);
      }
      if (
        match.index + 1 < paragraphs.length &&
        tokenize(paragraphs[match.index + 1]!.text).some((token) => terms.has(token))
      ) {
        selectedIndexes.add(match.index + 1);
      }
    }
    const selected: Array<{ paragraph: TranscriptSpan; score: number }> =
      ranked.length > 0
        ? [...selectedIndexes]
            .sort((left, right) => left - right)
            .slice(0, MAX_SPANS_PER_IDEA)
            .map((index) => ({
              paragraph: paragraphs[index]!,
              score: tokenize(paragraphs[index]!.text).filter((token) => terms.has(token)).length,
            }))
        : [{ paragraph: { text: transcript.summary ?? transcript.title }, score: 0 }];

    return selected.map(({ paragraph, score }, index) => {
      const timestampUrl = youtubeTimestampUrl(transcript.source_url, paragraph.locator);
      const isTimestamp =
        paragraph.locator !== undefined && timestampToSeconds(paragraph.locator) !== undefined;
      const resolvedLocator = isTimestamp && !timestampUrl ? undefined : paragraph.locator;
      return {
        id: toNodeId(`${idea.id}-${resolvedLocator ?? 'transcript'}-${index + 1}`),
        canonical_idea_id: idea.id,
        canonical_idea_ids: [idea.id],
        transcript_id: transcript.id,
        ...(transcript.source_id ? { source_id: transcript.source_id } : {}),
        source_url: timestampUrl ?? transcript.source_url,
        ...(transcript.author ? { author: transcript.author } : {}),
        ...(transcript.author ? { channel: transcript.author } : {}),
        title: transcript.title,
        excerpt: paragraph.text.slice(0, WIKI_EVIDENCE_MAX_EXCERPT_CHARS),
        ...(resolvedLocator ? { locator: resolvedLocator } : {}),
        confidence:
          score >= 4 && resolvedLocator && !resolvedLocator.startsWith('p:')
            ? ('high' as const)
            : score > 0
              ? ('medium' as const)
              : ('low' as const),
        ...(evidenceRole ? { evidence_role: evidenceRole } : {}),
      };
    });
  });

  const merged = new Map<string, WikiEvidenceItem>();
  for (const item of evidence) {
    const key = `${item.transcript_id}:${item.locator ?? 'transcript'}:${item.excerpt}`;
    const existing = merged.get(key);
    if (existing) {
      existing.canonical_idea_ids = [
        ...new Set([...existing.canonical_idea_ids, ...item.canonical_idea_ids]),
      ];
      if (existing.evidence_role !== 'primary' && item.evidence_role === 'primary') {
        existing.evidence_role = 'primary';
      } else if (!existing.evidence_role && item.evidence_role) {
        existing.evidence_role = item.evidence_role;
      }
      continue;
    }
    merged.set(key, item);
  }

  const bounded: WikiEvidenceItem[] = [];
  let totalChars = 0;
  for (const item of merged.values()) {
    if (bounded.length >= WIKI_EVIDENCE_MAX_ITEMS) break;
    if (totalChars + item.excerpt.length > WIKI_EVIDENCE_MAX_PACKET_CHARS) break;
    if (Math.ceil((totalChars + item.excerpt.length) / 4) > WIKI_EVIDENCE_MAX_ESTIMATED_TOKENS) break;
    bounded.push(item);
    totalChars += item.excerpt.length;
  }
  return bounded;
}
