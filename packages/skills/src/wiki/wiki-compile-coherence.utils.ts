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

/**
 * Over-collapse by claim/topic diversity: many diverse primary ideas forced into one section.
 * Section count alone is insufficient — low title diversity is allowed to share a section.
 */
export function hasOverCollapsedByClaimDiversity(input: {
  sectionCount: number;
  primaryIdeaTitles: string[];
}): boolean {
  if (input.sectionCount !== 1 || input.primaryIdeaTitles.length <= 2) return false;
  const tokens = input.primaryIdeaTitles.map(tokenizeComparable);
  let diversePairs = 0;
  let pairs = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      pairs += 1;
      if (jaccard(tokens[i]!, tokens[j]!) < 0.2) diversePairs += 1;
    }
  }
  return pairs > 0 && diversePairs / pairs >= 0.5;
}

/** Sibling sections that nearly repeat the same primary claim wording. */
export function hasRepeatedPrimaryClaims(sections: Array<{ heading: string; body: string }>): boolean {
  if (sections.length < 2) return false;
  const bodies = sections
    .map((section) => tokenizeComparable(`${section.heading} ${section.body.slice(0, 280)}`))
    .filter((tokens) => tokens.size >= 4);
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      if (jaccard(bodies[i]!, bodies[j]!) >= 0.72) return true;
    }
  }
  return false;
}

/**
 * Fine-tag overlap among primary ideas (`t:` tags). Domain tags (`d:`) alone never score.
 * Returns 0–1 alignment ratio.
 */
export function fineTagAlignmentScore(ideaTagSets: string[][]): number {
  if (ideaTagSets.length < 2) return 0;
  const fineSets = ideaTagSets.map((tags) => new Set(tags.filter((tag) => tag.startsWith('t:'))));
  // Broad domain overlap alone contributes no coherence score.
  if (fineSets.every((set) => set.size === 0)) return 0;

  let sharedPairs = 0;
  let pairs = 0;
  for (let i = 0; i < fineSets.length; i += 1) {
    for (let j = i + 1; j < fineSets.length; j += 1) {
      pairs += 1;
      const left = fineSets[i]!;
      const right = fineSets[j]!;
      for (const tag of left) {
        if (right.has(tag)) {
          sharedPairs += 1;
          break;
        }
      }
    }
  }
  return pairs === 0 ? 0 : sharedPairs / pairs;
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
  if (
    hasOverCollapsedByClaimDiversity({
      sectionCount: input.result.sections.length,
      primaryIdeaTitles: input.primaryIdeaTitles,
    })
  ) {
    issues.push({
      code: 'over-collapse',
      message: 'Diverse primary claims were collapsed into a single section without topic separation.',
    });
  }
  if (hasRepeatedPrimaryClaims(input.result.sections)) {
    issues.push({
      code: 'repeated-primary-claims',
      message: 'Sibling sections repeat the same primary claims; topics should be merged or differentiated.',
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
  'over-collapse',
]);

export function isFixableWikiCompileFailure(errorMessage: string): boolean {
  return FIXABLE_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export function hasTerminalCoherenceFailure(issues: WikiValidationIssue[]): boolean {
  return issues.some((issue) => TERMINAL_COHERENCE_CODES.has(issue.code));
}
