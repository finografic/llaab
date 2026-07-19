import type { TtsPlayerSection } from './tts-player.types';

const TIMESTAMP_MARKER_PATTERN = /<!--\s*t:[\d:.]+\s*-->/g;
const TRANSCRIPT_TIME_LINE_PATTERN = /^<--\s*t:[\d:.]+\s*-->$/gm;
const TRANSCRIPT_TIME_LINE_ONLY_PATTERN = /^<--\s*t:[\d:.]+\s*-->$/;
const TRANSCRIPT_HEADING_PATTERN = /^#{1,6}\s+transcript\s*$/i;
/** Document title: exactly one leading `#` (not `##` / `###`). */
const DOCUMENT_TITLE_HEADING_PATTERN = /^#\s+\S/;
const TRANSCRIPT_HEADER_LINK_LINE_PATTERN = /^\[\*{0,2}https?:\/\/[^\]]+\*{0,2}\]\([^)]+\)$/i;
const TRANSCRIPT_METADATA_LINE_PATTERN =
  /^(?:[-*]\s*)?(?:\*\*)?(?:author|uploaded|ingested|source|url|video|channel|duration|published)(?:\*\*)?\s*:/i;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const MARKDOWN_EMPHASIS_PATTERN = /[*_`#>]+/g;
const WHITESPACE_PATTERN = /\s+/g;
const MAX_SECTION_CHARS = 1_200;

export function formatTtsTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function normalizeTtsText(text: string) {
  return text
    .replace(TIMESTAMP_MARKER_PATTERN, ' ')
    .replace(TRANSCRIPT_TIME_LINE_PATTERN, ' ')
    .replace(MARKDOWN_LINK_PATTERN, '$1')
    .replace(MARKDOWN_EMPHASIS_PATTERN, '')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

function isDocumentTitleHeading(line: string) {
  const trimmed = line.trim();
  return DOCUMENT_TITLE_HEADING_PATTERN.test(trimmed) && !trimmed.startsWith('##');
}

function shouldDropTranscriptMetadataLine(line: string, hasReachedTranscriptHeading: boolean) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (TRANSCRIPT_TIME_LINE_ONLY_PATTERN.test(trimmed)) return true;
  if (TRANSCRIPT_METADATA_LINE_PATTERN.test(trimmed)) return true;
  if (!hasReachedTranscriptHeading && TRANSCRIPT_HEADER_LINK_LINE_PATTERN.test(trimmed)) return true;
  // Keep the H1 title; drop other pre-transcript headings (## Transcript is handled separately).
  if (!hasReachedTranscriptHeading && trimmed.startsWith('#')) return !isDocumentTitleHeading(trimmed);
  return false;
}

export function stripTtsMetadataLines(text: string) {
  const lines: string[] = [];
  let hasReachedTranscriptHeading = false;

  for (const line of text.split(/\r?\n/)) {
    if (TRANSCRIPT_HEADING_PATTERN.test(line.trim())) {
      hasReachedTranscriptHeading = true;
      continue;
    }

    if (shouldDropTranscriptMetadataLine(line, hasReachedTranscriptHeading)) continue;
    lines.push(line);
  }

  return lines.join('\n').trim();
}

export function splitTtsSentences(text: string) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]).map((sentence) => sentence.trim()).filter(Boolean);
}

function splitLongText(text: string, maxChars = MAX_SECTION_CHARS) {
  if (text.length <= maxChars) return [text];

  const sentences = splitTtsSentences(text);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = sentence.trim();
  }

  if (current) chunks.push(current);
  return chunks;
}

export function createTtsSectionsFromText(text: string): TtsPlayerSection[] {
  const audioText = stripTtsMetadataLines(text);
  const paragraphs = audioText
    .split(/\n{2,}/)
    .map(normalizeTtsText)
    .filter(Boolean);

  const source = paragraphs.length > 0 ? paragraphs : [normalizeTtsText(audioText)].filter(Boolean);
  return source.flatMap((paragraph, paragraphIndex) =>
    splitLongText(paragraph).map((chunk, chunkIndex) => ({
      id: `section-${paragraphIndex}-${chunkIndex}`,
      label: `Section ${paragraphIndex + 1}`,
      text: chunk,
    })),
  );
}
