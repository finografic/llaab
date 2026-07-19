import { normalizeWikiTitleForComparison } from '@llaab/schemas';
import type { WikiCompileResult, WikiValidationIssue } from '@llaab/schemas';

const SOURCE_SHAPED_TITLE_MARKERS = [
  'transcript',
  'youtube',
  'hermes',
  'llaab',
  'episode',
  'podcast',
  'video notes',
  'source digest',
  'from the video',
];

function tokenizeComparable(value: string): Set<string> {
  return new Set(
    normalizeWikiTitleForComparison(value)
      .split(' ')
      .filter((token) => token.length >= 3),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** True when the title reads as a source/transcript digest rather than a reusable topic. */
export function isSourceShapedWikiTitle(
  title: string,
  options: { transcriptTitle?: string; channelOrAuthor?: string } = {},
): boolean {
  const normalized = normalizeWikiTitleForComparison(title);
  if (!normalized) return true;
  if (SOURCE_SHAPED_TITLE_MARKERS.some((marker) => normalized.includes(marker))) return true;
  if (options.transcriptTitle) {
    const transcript = normalizeWikiTitleForComparison(options.transcriptTitle);
    if (transcript && (normalized === transcript || normalized.includes(transcript))) return true;
  }
  if (options.channelOrAuthor) {
    const channel = normalizeWikiTitleForComparison(options.channelOrAuthor);
    if (channel.length >= 4 && normalized.includes(channel)) return true;
  }
  return false;
}

/**
 * Detect one-section-per-canonical-idea structure: same count as primary ideas and each
 * heading near-duplicates an idea title.
 */
export function hasMechanicalIdeaHeadings(input: {
  sections: Array<{ heading: string }>;
  primaryIdeaTitles: string[];
}): boolean {
  const { sections, primaryIdeaTitles } = input;
  if (primaryIdeaTitles.length < 2) return false;
  if (sections.length !== primaryIdeaTitles.length) return false;

  const ideaTokens = primaryIdeaTitles.map(tokenizeComparable);
  const usedIdeas = new Set<number>();
  let matched = 0;

  for (const section of sections) {
    const headingTokens = tokenizeComparable(section.heading);
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < ideaTokens.length; index += 1) {
      if (usedIdeas.has(index)) continue;
      const score = jaccard(headingTokens, ideaTokens[index]!);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0 && bestScore >= 0.66) {
      usedIdeas.add(bestIndex);
      matched += 1;
    }
  }

  return matched === primaryIdeaTitles.length;
}

/** Over-fragmentation: more sections than primary ideas with no synthesis signal. */
export function hasOverFragmentedSections(input: {
  sectionCount: number;
  primaryIdeaCount: number;
}): boolean {
  return input.primaryIdeaCount >= 2 && input.sectionCount > input.primaryIdeaCount + 1;
}

export function evaluateWikiCompileCoherence(input: {
  result: WikiCompileResult;
  primaryIdeaTitles: string[];
  transcriptTitle?: string;
  channelOrAuthor?: string;
}): WikiValidationIssue[] {
  const issues: WikiValidationIssue[] = [];
  if (
    isSourceShapedWikiTitle(input.result.topic.title, {
      transcriptTitle: input.transcriptTitle,
      channelOrAuthor: input.channelOrAuthor,
    })
  ) {
    issues.push({
      code: 'source-shaped-title',
      message: 'Wiki title appears source-shaped rather than topic-oriented.',
    });
  }
  if (
    hasMechanicalIdeaHeadings({
      sections: input.result.sections,
      primaryIdeaTitles: input.primaryIdeaTitles,
    })
  ) {
    issues.push({
      code: 'mechanical-idea-headings',
      message: 'Sections mechanically mirror canonical idea titles instead of synthesizing the topic.',
    });
  }
  if (
    hasOverFragmentedSections({
      sectionCount: input.result.sections.length,
      primaryIdeaCount: input.primaryIdeaTitles.length,
    })
  ) {
    issues.push({
      code: 'over-fragmentation',
      message: 'Too many sections for the primary evidence set; synthesis is missing.',
    });
  }
  return issues;
}

const FIXABLE_ERROR_PATTERNS = [
  /malformed or truncated json/i,
  /wiki compile result/i,
  /unknown source ref/i,
  /duplicate (?:source ref|section id|links)/i,
  /changed the required topic key/i,
  /does not account for selected canonical idea/i,
  /has no source references/i,
  /invalid_type|expected|required/i,
];

const TERMINAL_COHERENCE_CODES = new Set([
  'mechanical-idea-headings',
  'source-shaped-title',
  'over-fragmentation',
]);

export function isFixableWikiCompileFailure(errorMessage: string): boolean {
  return FIXABLE_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export function hasTerminalCoherenceFailure(issues: WikiValidationIssue[]): boolean {
  return issues.some((issue) => TERMINAL_COHERENCE_CODES.has(issue.code));
}
