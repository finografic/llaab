// ============================================================================
// SRT-aware transcript parser
// ============================================================================
// Parses raw SRT subtitle content into clean paragraphs with timestamp markers.
// Replaces the cleanTranscript → structureText flow for SRT input.
//
// The existing cleanTranscript + structureText remain available for non-SRT
// content (articles, raw notes, etc.).
// ============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SrtCue {
  /** Start time in seconds */
  startSeconds: number;
  /** End time in seconds */
  endSeconds: number;
  /** Clean text content (HTML tags stripped) */
  text: string;
}

export interface TimestampedParagraph {
  /** Start time formatted as M:SS or H:MM:SS */
  timestamp: string;
  /** Start time in raw seconds (for linking) */
  startSeconds: number;
  /** Clean paragraph text */
  text: string;
}

export interface ParsedSrtTranscript {
  paragraphs: TimestampedParagraph[];
  /** Full structured content with <!-- t:M:SS --> markers */
  structuredContent: string;
  paragraphCount: number;
  /** Plain text without timestamps (for LLM extraction, search, etc.) */
  plainText: string;
  rawLength: number;
  cleanLength: number;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/**
 * Parse SRT timestamp (HH:MM:SS,mmm) to seconds. Also handles VTT format (HH:MM:SS.mmm).
 */
function parseTimestamp(ts: string): number {
  const match = ts.trim().match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!match) return 0;

  const [, hours, minutes, seconds, millis] = match;
  return (
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10) +
    Number.parseInt(millis, 10) / 1000
  );
}

/**
 * Format seconds as human-readable timestamp. - Under 1 hour: M:SS (e.g. 0:00, 14:23) - Over 1 hour: H:MM:SS
 * (e.g. 1:02:15)
 */
function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }

  return `${minutes}:${ss}`;
}

// ─── SRT parsing ──────────────────────────────────────────────────────────────

/**
 * Parse raw SRT content into an array of cues.
 *
 * SRT format:
 *
 *     1
 *     00:00:00,000 --> 00:00:03,679
 *     So, if you've been using claw code for a
 *
 *     2
 *     00:00:01,760 --> 00:00:05,520
 *     while, you'll remember the old problem.
 */
function parseSrtCues(rawSrt: string): SrtCue[] {
  // Normalise line endings and split on blank lines (cue boundaries)
  const blocks = rawSrt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\n+/)
    .filter((block) => block.trim());

  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');

    // Find the timestamp line (contains " --> ")
    const timestampLineIndex = lines.findIndex((line) => line.includes(' --> '));
    if (timestampLineIndex === -1) continue;

    const timestampLine = lines[timestampLineIndex];
    const [startStr, endStr] = timestampLine.split(' --> ');
    if (!startStr || !endStr) continue;

    // Text is everything after the timestamp line
    const textLines = lines.slice(timestampLineIndex + 1);
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '') // Strip HTML tags (e.g. <font>, <i>)
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    cues.push({
      startSeconds: parseTimestamp(startStr),
      endSeconds: parseTimestamp(endStr),
      text,
    });
  }

  return cues;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * YouTube auto-generated subs have heavy overlap — each cue contains roughly the last half of the previous
 * cue plus new words. Example:
 *
 * Cue 515: "including the command center in the" Cue 516: "academy link in the description. The" Cue 517:
 * "command center first version is" Cue 518: "launching next"
 *
 * Strategy: instead of word-level overlap detection, we track a running transcript as a single string and
 * only append the _suffix_ of each new cue that doesn't already appear at the end of the running text.
 */
function deduplicateCues(cues: SrtCue[]): SrtCue[] {
  if (cues.length === 0) return [];

  const result: SrtCue[] = [cues[0]];
  let running = cues[0].text;

  for (let i = 1; i < cues.length; i++) {
    const cue = cues[i];
    const cueText = cue.text;

    // Find the longest suffix of `running` that matches a prefix of `cueText`.
    // The new content is everything in `cueText` after that overlap.
    let overlapLen = 0;
    const maxCheck = Math.min(running.length, cueText.length);

    for (let len = 1; len <= maxCheck; len++) {
      const runningSuffix = running.slice(-len).toLowerCase();
      const cuePrefix = cueText.slice(0, len).toLowerCase();
      if (runningSuffix === cuePrefix) {
        overlapLen = len;
      }
    }

    const newContent = cueText.slice(overlapLen).trim();

    if (newContent) {
      result.push({
        startSeconds: cue.startSeconds,
        endSeconds: cue.endSeconds,
        text: newContent,
      });
      running += ' ' + newContent;
    }
    // If newContent is empty the cue is fully contained in running — skip it.
    // (The content is already present; forcing it would duplicate the tail fragment.)
  }

  return result;
}

// ─── Paragraph assembly ───────────────────────────────────────────────────────

/**
 * Merge deduplicated cues into paragraphs.
 *
 * A new paragraph starts when: - There is a pause gap > `pauseThresholdSeconds` between cues, OR - The
 * current paragraph has accumulated > `maxSentencesPerParagraph` sentences
 *
 * Each paragraph carries the start timestamp of its first cue.
 */
function assembleParagraphs(
  cues: SrtCue[],
  options: {
    pauseThresholdSeconds: number;
    maxSentencesPerParagraph: number;
    minParagraphSeconds: number;
  },
): TimestampedParagraph[] {
  if (cues.length === 0) return [];

  const { pauseThresholdSeconds, maxSentencesPerParagraph, minParagraphSeconds } = options;
  const paragraphs: TimestampedParagraph[] = [];

  let currentText = cues[0].text;
  let paragraphStartSeconds = cues[0].startSeconds;

  function countSentences(text: string): number {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 0;
  }

  function flushParagraph(): void {
    const trimmed = currentText.trim();
    if (trimmed) {
      paragraphs.push({
        timestamp: formatTimestamp(paragraphStartSeconds),
        startSeconds: Math.floor(paragraphStartSeconds),
        text: trimmed,
      });
    }
  }

  for (let i = 1; i < cues.length; i++) {
    const prevCue = cues[i - 1];
    const cue = cues[i];

    const gap = cue.startSeconds - prevCue.endSeconds;
    const sentenceCount = countSentences(currentText);

    const paragraphDuration = cue.startSeconds - paragraphStartSeconds;
    const endsWithSentence = /[.!?][\s"'""''»)]*$/.test(currentText.trimEnd());
    const isPause = gap > pauseThresholdSeconds && endsWithSentence;
    const isFull = sentenceCount >= maxSentencesPerParagraph && endsWithSentence;
    const isLongEnough = paragraphDuration >= minParagraphSeconds;

    if ((isPause || isFull) && isLongEnough) {
      flushParagraph();
      currentText = cue.text;
      paragraphStartSeconds = cue.startSeconds;
    } else {
      currentText += ' ' + cue.text;
    }
  }

  // Flush the last paragraph
  flushParagraph();

  return paragraphs;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface ParseSrtOptions {
  /**
   * Minimum gap (seconds) between cues to trigger a new paragraph. YouTube auto-subs rarely have real pauses,
   * so this catches topic shifts. Default: 1.5
   */
  pauseThresholdSeconds?: number;

  /**
   * Maximum sentences per paragraph before forcing a break. Default: 5 (matches the existing structureText
   * default)
   */
  maxSentencesPerParagraph?: number;

  /** Minimum paragraph duration in seconds. Default: 25 */
  minParagraphSeconds?: number;
}

/**
 * Parse raw SRT subtitle content into timestamped paragraphs.
 *
 * Output `structuredContent` uses HTML comment markers:
 *
 * ```markdown
 * <!-- t:0:00 -->
 *
 * First paragraph of speech...
 *
 * <!-- t:0:42 -->
 *
 * Second paragraph of speech...
 * ```
 *
 * These are invisible in Obsidian reading view but parseable by code. The wiki compile step can later convert
 * them to clickable YouTube links.
 */
export function parseSrtTranscript(rawSrt: string, options: ParseSrtOptions = {}): ParsedSrtTranscript {
  const rawLength = rawSrt.length;

  if (!rawSrt.trim()) {
    return {
      paragraphs: [],
      structuredContent: '',
      paragraphCount: 0,
      plainText: '',
      rawLength,
      cleanLength: 0,
    };
  }

  const {
    pauseThresholdSeconds = 1.5,
    maxSentencesPerParagraph = 6,
    //  minParagraphSeconds = 25
    minParagraphSeconds = 25,
  } = options;

  // 1. Parse raw SRT into cues
  const rawCues = parseSrtCues(rawSrt);

  // 2. Deduplicate overlapping auto-generated cues
  const cues = deduplicateCues(rawCues);

  // 3. Assemble into timestamped paragraphs
  const paragraphs = assembleParagraphs(cues, {
    pauseThresholdSeconds,
    maxSentencesPerParagraph,
    minParagraphSeconds,
  });

  // 3b. Trim trailing incomplete sentence from the last paragraph.
  // YouTube subtitles often end mid-sentence because the caption generator cuts off before the
  // final word(s). If the last paragraph doesn't end with sentence-closing punctuation, strip the
  // dangling fragment so the transcript ends at the last complete sentence.
  if (paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1];
    if (!/[.!?]["'""''»)\s]*$/.test(last.text.trimEnd())) {
      const match = last.text.match(/^([\s\S]*[.!?]["'""''»)]*)/);
      if (match) {
        paragraphs[paragraphs.length - 1] = { ...last, text: match[1].trimEnd() };
      }
    }
  }

  // 4. Build output formats
  const structuredContent = paragraphs.map((p) => `<!-- t:${p.timestamp} -->\n${p.text}`).join('\n\n');

  const plainText = paragraphs.map((p) => p.text).join('\n\n');

  return {
    paragraphs,
    structuredContent,
    paragraphCount: paragraphs.length,
    plainText,
    rawLength,
    cleanLength: plainText.length,
  };
}

// ─── Detection helper ─────────────────────────────────────────────────────────

/**
 * Check whether a raw transcript string looks like SRT format. Used by the pipeline to decide between
 * parseSrtTranscript and the existing cleanTranscript → structureText flow.
 */
export function isSrtFormat(raw: string): boolean {
  const trimmed = raw.trim();
  // VTT files start with "WEBVTT"
  if (/^WEBVTT/.test(trimmed)) return true;
  // SRT files start with a cue number and have " --> " timestamp separators
  return /^\d+\s*\n\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed);
}
