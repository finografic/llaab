import { describe, expect, it } from 'vitest';

import {
  mean,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  relevantRanks,
} from './retrieval-metrics.utils.js';

describe('retrieval metrics', () => {
  describe('recallAtK', () => {
    it('measures the share of relevant documents found within k', () => {
      const retrieved = ['a', 'b', 'c', 'd'];
      expect(recallAtK(retrieved, ['a', 'c'], 4)).toBe(1);
      expect(recallAtK(retrieved, ['a', 'c'], 2)).toBe(0.5);
      expect(recallAtK(retrieved, ['z'], 4)).toBe(0);
    });

    it('treats a query with no relevant documents as trivially satisfied', () => {
      expect(recallAtK(['a'], [], 5)).toBe(1);
    });
  });

  describe('precisionAtK', () => {
    it('measures the share of the top k that is relevant', () => {
      expect(precisionAtK(['a', 'b', 'c', 'd'], ['a', 'b'], 4)).toBe(0.5);
      expect(precisionAtK(['a', 'b'], ['a', 'b'], 2)).toBe(1);
    });

    it('is zero when nothing was retrieved', () => {
      expect(precisionAtK([], ['a'], 5)).toBe(0);
    });

    it('stays zero for an out-of-domain query that should match nothing', () => {
      expect(precisionAtK(['a', 'b'], [], 5)).toBe(0);
    });
  });

  describe('reciprocalRank', () => {
    it('rewards the position of the first relevant hit', () => {
      expect(reciprocalRank(['a', 'b', 'c'], ['a'])).toBe(1);
      expect(reciprocalRank(['a', 'b', 'c'], ['b'])).toBe(0.5);
      expect(reciprocalRank(['a', 'b', 'c'], ['c'])).toBeCloseTo(1 / 3);
    });

    it('is zero when no relevant document was retrieved', () => {
      expect(reciprocalRank(['a', 'b'], ['z'])).toBe(0);
    });
  });

  describe('ndcgAtK', () => {
    it('is 1 when the ideal ordering is returned', () => {
      expect(ndcgAtK(['a', 'b'], ['a', 'b'], 2)).toBe(1);
    });

    it('penalises ranking the more relevant document lower', () => {
      const grades = { a: 3, b: 1 };
      const ideal = ndcgAtK(['a', 'b'], ['a', 'b'], 2, grades);
      const swapped = ndcgAtK(['b', 'a'], ['a', 'b'], 2, grades);
      expect(ideal).toBe(1);
      expect(swapped).toBeLessThan(ideal);
    });

    it('distinguishes ordering where recall cannot', () => {
      const relevant = ['a', 'b'];
      expect(recallAtK(['a', 'z', 'b'], relevant, 3)).toBe(recallAtK(['z', 'a', 'b'], relevant, 3));
      expect(ndcgAtK(['a', 'z', 'b'], relevant, 3)).toBeGreaterThan(ndcgAtK(['z', 'a', 'b'], relevant, 3));
    });

    it('treats an empty relevant set as satisfied only when nothing scored', () => {
      expect(ndcgAtK(['a'], [], 5)).toBe(1);
    });
  });

  describe('relevantRanks', () => {
    it('reports 1-indexed positions and null for misses', () => {
      expect(relevantRanks(['a', 'b', 'c'], ['b', 'z'])).toEqual({ b: 2, z: null });
    });
  });

  describe('mean', () => {
    it('averages values and returns zero for an empty list', () => {
      expect(mean([1, 2, 3])).toBe(2);
      expect(mean([])).toBe(0);
    });
  });
});
