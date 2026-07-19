import type { TtsPlayerSection } from './tts-player.types';

const TIMESTAMP_MARKER_PATTERN = /<!--\s*t:[\d:.]+\s*-->/g;
const TRANSCRIPT_TIME_LINE_PATTERN = /^<--\s*t:[\d:.]+\s*-->$/gm;
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

function splitLongText(text: string, maxChars = MAX_SECTION_CHARS) {
  if (text.length <= maxChars) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
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
  const paragraphs = text
    .split(/\n{2,}/)
    .map(normalizeTtsText)
    .filter(Boolean);

  const source = paragraphs.length > 0 ? paragraphs : [normalizeTtsText(text)].filter(Boolean);
  return source.flatMap((paragraph, paragraphIndex) =>
    splitLongText(paragraph).map((chunk, chunkIndex) => ({
      id: `section-${paragraphIndex}-${chunkIndex}`,
      label: `Section ${paragraphIndex + 1}`,
      text: chunk,
    })),
  );
}
