import { describe, expect, it } from 'vitest';

import { computeOrphanTagsToRemove } from './scrub-node-references.js';

describe('computeOrphanTagsToRemove', () => {
  it('removes tags that only lived on the deleted idea', () => {
    expect(
      computeOrphanTagsToRemove(
        ['d:ingest', 'typescript-7', 'shared-topic'],
        ['typescript-7', 'shared-topic'],
        ['shared-topic', 'd:ui'],
      ),
    ).toEqual(['typescript-7']);
  });

  it('keeps transcript-only tags that were never on the deleted idea', () => {
    expect(computeOrphanTagsToRemove(['transcript-only', 'd:ingest'], ['typescript-7'], [])).toEqual([]);
  });

  it('keeps tags still present on a remaining sibling idea', () => {
    expect(computeOrphanTagsToRemove(['d:ingest', 'shared'], ['shared'], ['shared'])).toEqual([]);
  });
});
