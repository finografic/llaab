import { describe, expect, it } from 'vitest';

import { scorePassages } from './rank-passages.utils.js';

describe('scorePassages', () => {
  it('ranks the passage covering the most query terms first', () => {
    const body = [
      'This paragraph mentions retrieval and nothing else of note.',
      '',
      'This paragraph covers retrieval quality and evaluation together.',
    ].join('\n');

    const result = scorePassages(body, ['retrieval', 'quality', 'evaluation'], { minCharacters: 0 });

    expect(result.passages[0]?.passage.text).toContain('retrieval quality and evaluation');
    expect(result.passages[0]?.matched_terms).toEqual(['retrieval', 'quality', 'evaluation']);
  });

  it('ignores passages with no matching term', () => {
    const body = ['Nothing relevant here.', '', 'Retrieval appears in this one.'].join('\n');
    const result = scorePassages(body, ['retrieval'], { minCharacters: 0 });

    expect(result.passages).toHaveLength(1);
  });

  it('returns nothing for an empty body or empty term list', () => {
    expect(scorePassages('', ['retrieval'])).toEqual({ passages: [], score: 0 });
    expect(scorePassages('Retrieval.', [])).toEqual({ passages: [], score: 0 });
  });

  it('matches against heading breadcrumbs as well as passage text', () => {
    const body = ['## Retrieval Contract', '', 'The shape is stable across consumers.'].join('\n');
    const result = scorePassages(body, ['retrieval'], { minCharacters: 0 });

    expect(result.passages).toHaveLength(1);
    expect(result.passages[0]?.matched_terms).toEqual(['retrieval']);
  });

  it('caps corroboration so volume cannot outweigh a stronger single passage', () => {
    const focused = scorePassages('Retrieval quality bounds generation quality.', ['retrieval', 'quality']);

    // Many passages, each matching only one of the two terms.
    const diluted = scorePassages(
      Array.from({ length: 40 }, () => 'A passage that mentions retrieval only.').join('\n\n'),
      ['retrieval', 'quality'],
    );

    expect(focused.score).toBeGreaterThan(diluted.score);
  });

  it('still rewards corroboration when passages match equally well', () => {
    // minCharacters: 0 keeps these short blocks as separate passages rather than merging them.
    const single = scorePassages('Retrieval matters.', ['retrieval'], { minCharacters: 0 });
    const repeated = scorePassages(
      ['Retrieval matters.', 'Retrieval matters again.', 'Retrieval matters once more.'].join('\n\n'),
      ['retrieval'],
      { minCharacters: 0 },
    );

    expect(repeated.score).toBeGreaterThan(single.score);
  });
});
