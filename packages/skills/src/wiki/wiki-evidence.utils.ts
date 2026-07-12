import { toNodeId } from '@llaab/schemas';
import type { CanonicalIdeaNode, TranscriptNode, WikiEvidenceItem } from '@llaab/schemas';

interface TranscriptParagraph {
  locator?: string;
  text: string;
}

const TIMESTAMP_MARKER = /^<!--\s*t:([^\s]+)\s*-->\s*$/;

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function parseTranscriptParagraphs(body: string): TranscriptParagraph[] {
  const paragraphs: TranscriptParagraph[] = [];
  let locator: string | undefined;
  let lines: string[] = [];

  function flush(): void {
    const text = lines.join(' ').trim();
    if (text) paragraphs.push({ locator, text });
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

export function buildWikiEvidence(
  transcript: TranscriptNode,
  canonicalIdeas: CanonicalIdeaNode[],
): WikiEvidenceItem[] {
  const paragraphs = parseTranscriptParagraphs(transcript.body);

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
    const selected: Array<{ paragraph: TranscriptParagraph }> =
      ranked.length > 0 ? ranked : [{ paragraph: { text: transcript.summary ?? transcript.title } }];

    return selected.map(({ paragraph }, index) => ({
      id: toNodeId(`${idea.id}-${paragraph.locator ?? 'transcript'}-${index + 1}`),
      canonical_idea_id: idea.id,
      transcript_id: transcript.id,
      ...(transcript.source_id ? { source_id: transcript.source_id } : {}),
      source_url: transcript.source_url,
      title: transcript.title,
      excerpt: paragraph.text,
      ...(paragraph.locator ? { locator: paragraph.locator } : {}),
      confidence: paragraph.locator ? ('high' as const) : ('medium' as const),
    }));
  });
}
