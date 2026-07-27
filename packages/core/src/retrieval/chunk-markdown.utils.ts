/**
 * Splits markdown into retrievable passages.
 *
 * Whole-document scoring cannot tell a focused wiki from a 90-minute transcript that mentions the
 * answer once, and a radius snippet anchored on the first matching term routinely misses the
 * sentence that actually answers the question. Passages fix both: they are the unit that gets
 * ranked and the unit that becomes model context.
 */

/** Transcript position marker emitted by ingestion, e.g. `<!-- t:1:46 -->`. */
const TIMESTAMP_MARKER = /<!--\s*t:([\d:]+)\s*-->/;
const TIMESTAMP_MARKER_GLOBAL = /<!--\s*t:[\d:]+\s*-->/g;
const HEADING = /^(#{1,6})\s+(.*)$/;
const MAX_HEADING_DEPTH = 6;

export interface MarkdownPassage {
  /** 0-based position in document order. */
  index: number;
  text: string;
  /** Enclosing headings, outermost first, so a passage carries its own context. */
  heading_path: string[];
  char_start: number;
  char_end: number;
  /** Transcript timestamp in effect at this passage, when the document has markers. */
  timestamp?: string;
}

export interface ChunkMarkdownOptions {
  /** Soft ceiling; a block larger than this is split on sentence boundaries. */
  maxCharacters?: number;
  /** Trailing context repeated into the next passage when a block is split. */
  overlapCharacters?: number;
  /** Blocks shorter than this merge forward rather than standing alone. */
  minCharacters?: number;
}

const DEFAULT_MAX_CHARACTERS = 700;
const DEFAULT_OVERLAP_CHARACTERS = 80;
const DEFAULT_MIN_CHARACTERS = 120;

export function chunkMarkdown(body: string, options: ChunkMarkdownOptions = {}): MarkdownPassage[] {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const overlapCharacters = options.overlapCharacters ?? DEFAULT_OVERLAP_CHARACTERS;
  const minCharacters = options.minCharacters ?? DEFAULT_MIN_CHARACTERS;

  const blocks = splitIntoBlocks(body);
  const passages: MarkdownPassage[] = [];

  let pending: Block | null = null;

  const flush = (): void => {
    if (!pending) return;
    for (const piece of splitOversized(pending, maxCharacters, overlapCharacters)) {
      passages.push({ ...piece, index: passages.length });
    }
    pending = null;
  };

  for (const block of blocks) {
    if (!pending) {
      pending = block;
      continue;
    }

    const sameSection = sameHeadingPath(pending.heading_path, block.heading_path);
    const combinedLength = pending.text.length + block.text.length + 2;
    const shouldMerge =
      sameSection &&
      pending.timestamp === block.timestamp &&
      combinedLength <= maxCharacters &&
      (pending.text.length < minCharacters || block.text.length < minCharacters);

    if (shouldMerge) {
      pending = {
        char_end: block.char_end,
        char_start: pending.char_start,
        heading_path: pending.heading_path,
        text: `${pending.text}\n\n${block.text}`,
        timestamp: pending.timestamp,
      };
      continue;
    }

    flush();
    pending = block;
  }

  flush();

  return passages;
}

/** Renders a passage with its heading breadcrumb, for use as model context. */
export function formatPassageForContext(passage: MarkdownPassage): string {
  const breadcrumb = passage.heading_path.join(' › ');
  const prefix = passage.timestamp ? `[${passage.timestamp}] ` : '';
  if (breadcrumb.length === 0) return `${prefix}${passage.text}`;
  return `${breadcrumb}\n${prefix}${passage.text}`;
}

interface Block {
  text: string;
  heading_path: string[];
  char_start: number;
  char_end: number;
  timestamp?: string;
}

function splitIntoBlocks(body: string): Block[] {
  const lines = body.split('\n');
  const blocks: Block[] = [];
  const headings: string[] = [];

  let current: string[] = [];
  let currentStart = 0;
  let offset = 0;
  let timestamp: string | undefined;
  let inFence = false;

  const flushCurrent = (endOffset: number): void => {
    const text = current.join('\n').trim();
    current = [];
    if (text.length === 0) return;
    blocks.push({
      char_end: endOffset,
      char_start: currentStart,
      heading_path: [...headings],
      text,
      timestamp,
    });
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;

    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      if (current.length === 0) currentStart = lineStart;
      current.push(line);
      continue;
    }

    if (inFence) {
      if (current.length === 0) currentStart = lineStart;
      current.push(line);
      continue;
    }

    const headingMatch = HEADING.exec(line);
    if (headingMatch) {
      flushCurrent(lineStart);
      const depth = Math.min(headingMatch[1]!.length, MAX_HEADING_DEPTH);
      headings.length = depth - 1;
      headings[depth - 1] = headingMatch[2]!.trim();
      // A new section starts fresh; stale trailing entries would misattribute the breadcrumb.
      headings.length = depth;
      continue;
    }

    const timestampMatch = TIMESTAMP_MARKER.exec(line);
    if (timestampMatch) {
      flushCurrent(lineStart);
      timestamp = timestampMatch[1];
      const remainder = line.replace(TIMESTAMP_MARKER_GLOBAL, '').trim();
      if (remainder.length > 0) {
        currentStart = lineStart;
        current.push(remainder);
      }
      continue;
    }

    if (line.trim().length === 0) {
      flushCurrent(lineStart);
      continue;
    }

    if (current.length === 0) currentStart = lineStart;
    current.push(line);
  }

  flushCurrent(offset);

  return blocks;
}

function splitOversized(
  block: Block,
  maxCharacters: number,
  overlapCharacters: number,
): Array<Omit<MarkdownPassage, 'index'>> {
  if (block.text.length <= maxCharacters) {
    return [
      {
        char_end: block.char_end,
        char_start: block.char_start,
        heading_path: block.heading_path,
        text: block.text,
        timestamp: block.timestamp,
      },
    ];
  }

  const sentences = splitSentences(block.text);
  const pieces: Array<Omit<MarkdownPassage, 'index'>> = [];
  let current: string[] = [];
  let offset = block.char_start;

  const push = (): void => {
    const text = current.join('').trim();
    if (text.length === 0) return;
    pieces.push({
      char_end: offset + text.length,
      char_start: offset,
      heading_path: block.heading_path,
      text,
      timestamp: block.timestamp,
    });
  };

  for (const sentence of sentences) {
    const currentLength = current.reduce((total, entry) => total + entry.length, 0);
    if (current.length > 0 && currentLength + sentence.length > maxCharacters) {
      push();
      // Overlap is sentence-aligned: repeating a half sentence produces passages that read as
      // broken text and embed poorly later.
      const carried = trailingSentencesWithin(current, overlapCharacters);
      offset += currentLength - carried.reduce((total, entry) => total + entry.length, 0);
      current = carried;
    }
    current.push(sentence);
  }

  push();

  return pieces.length > 0 ? pieces : [{ ...block }];
}

/** Trailing whole sentences whose combined length fits the overlap budget. */
function trailingSentencesWithin(sentences: string[], budget: number): string[] {
  if (budget <= 0) return [];
  const carried: string[] = [];
  let used = 0;

  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    const sentence = sentences[index]!;
    if (used + sentence.length > budget) break;
    carried.unshift(sentence);
    used += sentence.length;
  }

  return carried;
}

function splitSentences(text: string): string[] {
  // Keeps the delimiter attached so reassembled passages read naturally.
  const parts = text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g);
  return parts ?? [text];
}

function sameHeadingPath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}
