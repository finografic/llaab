import {
  assertRefinedBroadHermesExpectation,
  createBroadHermesFixture,
  createSingleTopicFixture,
  evaluateWikiAutoPromotionPolicy,
} from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import { groupCanonicalIdeasByHeuristic } from './wiki-draft-generation.service.js';

describe('legacy greedy grouping characterization (not production)', () => {
  it('over-collapses the broad Hermes fixture into fewer than the refined multi-topic range', () => {
    const fixture = createBroadHermesFixture();
    const groups = groupCanonicalIdeasByHeuristic(fixture.canonicalIdeas);

    // Baseline: greedy token/domain joining produces a source-shaped over-collapse.
    expect(groups.length).toBeLessThan(fixture.expectedTopicCount.min);
    expect(groups.some((ideaIds) => ideaIds.length >= 5)).toBe(true);

    expect(() =>
      assertRefinedBroadHermesExpectation({
        topicCount: groups.length,
        topicIdentities: groups.map((_ideaIds, index) => `group-${index}`),
        familyHits: [],
      }),
    ).toThrow();
  });

  it('still produces a single group for a focused single-topic fixture', () => {
    const fixture = createSingleTopicFixture();
    const groups = groupCanonicalIdeasByHeuristic(fixture.canonicalIdeas);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('is input-order sensitive today (documents why Phase 2 must be order-independent)', () => {
    const fixture = createBroadHermesFixture();
    const forward = groupCanonicalIdeasByHeuristic(fixture.canonicalIdeas);
    const reversed = groupCanonicalIdeasByHeuristic([...fixture.canonicalIdeas].reverse());
    // Characterization only: capture shapes; Phase 2 will require equality.
    expect(forward.length).toBeGreaterThan(0);
    expect(reversed.length).toBeGreaterThan(0);
  });
});

describe('refined one-step policy vs current ambiguous auto-suffix behavior', () => {
  it('refined policy rejects the current needs-review → suffixed-create path', () => {
    const refined = evaluateWikiAutoPromotionPolicy({
      operation: 'needs-review',
      verificationStatus: 'source-backed',
      qualityScore: 84,
      coherencePassed: true,
      evidenceGatesPassed: true,
      hasValidLinks: true,
      hasValidSourceRefs: true,
      inventedSuffixedTopicKey: true,
    });

    expect(refined.allow).toBe(false);
    expect(refined.outcome).toBe('failed');
    expect(refined.reasons.join(' ')).toMatch(/suffixed|needs-review|Invented/i);
  });
});
