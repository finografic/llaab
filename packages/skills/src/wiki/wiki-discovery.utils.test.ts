import { describe, expect, it } from 'vitest';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import { clusterCanonicalIdeasForWikiDiscovery } from './wiki-discovery.utils.js';

function idea(id: string, transcriptId: string, title: string): CanonicalIdeaNode {
  return {
    id,
    type: 'canonical-idea',
    title,
    body: `${title} explains context retrieval.`,
    tags: ['d:context'],
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
      idea('first', 'transcript-one', 'Context retrieval'),
      idea('repeat', 'transcript-one', 'Context retrieval'),
      idea('second', 'transcript-two', 'Context retrieval quality'),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.ideas.map((candidate) => candidate.id)).toEqual(['first', 'second']);
    expect(clusters[0]?.topicKey).toBe('context');
  });

  it('keeps unrelated domain signals in separate clusters', () => {
    const clusters = clusterCanonicalIdeasForWikiDiscovery([
      idea('context', 'transcript-one', 'Context retrieval'),
      { ...idea('security', 'transcript-two', 'Threat modeling'), tags: ['d:security'] },
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((cluster) => cluster.topicKey).sort()).toEqual(['context', 'security']);
  });
});
