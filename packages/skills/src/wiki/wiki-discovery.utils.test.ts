import {
  assertRefinedBroadHermesExpectation,
  createBroadHermesFixture,
  createSingleTopicFixture,
} from '@llaab/schemas';
import { describe, expect, it } from 'vitest';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import {
  clusterCanonicalIdeasForWikiDiscovery,
  computeCanonicalIdeaSimilarity,
} from './wiki-discovery.utils.js';

function idea(id: string, transcriptId: string, title: string, tags: string[]): CanonicalIdeaNode {
  return {
    id,
    type: 'canonical-idea',
    title,
    body: `${title} body`,
    tags,
    related: [],
    created_at: '2026-07-13T00:00:00Z',
    status: 'seed',
    transcript_id: transcriptId,
    source_candidate_idea_ids: [],
    key_claims: [title],
  };
}

describe('clusterCanonicalIdeasForWikiDiscovery', () => {
  it('deduplicates repeated canonical wording from one transcript before clustering', () => {
    const clusters = clusterCanonicalIdeasForWikiDiscovery([
      idea('first', 'transcript-one', 'Context retrieval', ['d:llm', 'context', 'retrieval']),
      idea('repeat', 'transcript-one', 'Context retrieval', ['d:llm', 'context', 'retrieval']),
      idea('second', 'transcript-two', 'Context retrieval quality', ['d:llm', 'context', 'retrieval']),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.primaryIdeaIds).toEqual(['first', 'second']);
  });

  it('keeps unrelated topics separate even when domains differ', () => {
    const clusters = clusterCanonicalIdeasForWikiDiscovery([
      idea('context', 'transcript-one', 'Context retrieval', ['d:llm', 'context', 'retrieval']),
      idea('security', 'transcript-two', 'Threat modeling', ['d:infra', 'security', 'threat-modeling']),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('is input-order stable for the broad Hermes fixture and yields multiple focused clusters', () => {
    const fixture = createBroadHermesFixture();
    const forward = clusterCanonicalIdeasForWikiDiscovery(fixture.canonicalIdeas);
    const reversed = clusterCanonicalIdeasForWikiDiscovery([...fixture.canonicalIdeas].reverse());

    expect(forward.map((cluster) => [...cluster.primaryIdeaIds].sort().join(','))).toEqual(
      reversed.map((cluster) => [...cluster.primaryIdeaIds].sort().join(',')),
    );

    expect(() =>
      assertRefinedBroadHermesExpectation({
        topicCount: forward.length,
        topicIdentities: forward.map((cluster) => cluster.topicKey),
        familyHits: fixture.expectedFamilies.slice(0, Math.min(forward.length, 6)),
      }),
    ).not.toThrow();
  });

  it('keeps a focused single-topic fixture as one cluster', () => {
    const fixture = createSingleTopicFixture();
    const clusters = clusterCanonicalIdeasForWikiDiscovery(fixture.canonicalIdeas);
    expect(clusters).toHaveLength(1);
  });

  it('weights fine tags above domain overlap', () => {
    const left = idea('a', 't1', 'Isolation sandboxes', ['d:infra', 'isolation', 'sandbox']);
    const right = idea('b', 't1', 'Isolation boundaries', ['d:infra', 'isolation', 'boundaries']);
    const domainOnly = idea('c', 't1', 'Unrelated infra note', ['d:infra', 'networking']);

    expect(computeCanonicalIdeaSimilarity(left, right)).toBeGreaterThan(
      computeCanonicalIdeaSimilarity(left, domainOnly),
    );
  });
});
