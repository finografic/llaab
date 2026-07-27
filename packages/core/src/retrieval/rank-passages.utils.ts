/**
 * Passage-level scoring.
 *
 * A document's body score becomes "how well does its best passage answer this?" plus a saturating
 * bonus for corroborating passages — rather than a flat constant for containing a term anywhere.
 * This stops a long transcript from ranking like a focused wiki on the strength of one mention.
 */

import type { ChunkMarkdownOptions, MarkdownPassage } from './chunk-markdown.utils.js';

import { chunkMarkdown } from './chunk-markdown.utils.js';

export interface ScoredPassage {
  passage: MarkdownPassage;
  score: number;
  /** Search terms present in this passage. */
  matched_terms: string[];
}

export interface PassageScoreResult {
  /** Best-first, matching passages only. */
  passages: ScoredPassage[];
  /** Body contribution to the document score. */
  score: number;
}

/** Per distinct term found in a single passage. */
const PASSAGE_TERM_SCORE = 20;
/** Rewards a passage covering several query terms at once over scattered single-term hits. */
const PASSAGE_COVERAGE_BONUS = 10;
/** Saturating credit for corroborating passages; log-scaled so volume cannot dominate. */
const CORROBORATION_WEIGHT = 10;
/**
 * Ceiling on corroboration as a fraction of the best passage's score. Without it a long document
 * accumulates credit purely by having many weakly-matching passages — which is the length bias
 * this phase exists to remove. Proper length normalization is Phase 4 (BM25 `b`).
 */
const MAX_CORROBORATION_RATIO = 0.5;

export function scorePassages(
  body: string,
  searchTerms: string[],
  options: ChunkMarkdownOptions = {},
): PassageScoreResult {
  if (searchTerms.length === 0 || body.trim().length === 0) {
    return { passages: [], score: 0 };
  }

  const scored = chunkMarkdown(body, options)
    .map((passage) => scorePassage(passage, searchTerms))
    .filter((entry): entry is ScoredPassage => entry !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matched_terms.length - a.matched_terms.length ||
        a.passage.index - b.passage.index,
    );

  if (scored.length === 0) return { passages: [], score: 0 };

  const best = scored[0]!;
  const corroboration = Math.min(
    CORROBORATION_WEIGHT * Math.log2(scored.length + 1),
    best.score * MAX_CORROBORATION_RATIO,
  );

  return { passages: scored, score: Math.round(best.score + corroboration) };
}

function scorePassage(passage: MarkdownPassage, searchTerms: string[]): ScoredPassage | null {
  const haystack = `${passage.heading_path.join(' ')} ${passage.text}`.toLowerCase();
  const matched = searchTerms.filter((term) => haystack.includes(term));
  if (matched.length === 0) return null;

  const coverage = matched.length / searchTerms.length;

  return {
    matched_terms: matched,
    passage,
    score: matched.length * PASSAGE_TERM_SCORE + coverage * PASSAGE_COVERAGE_BONUS,
  };
}
