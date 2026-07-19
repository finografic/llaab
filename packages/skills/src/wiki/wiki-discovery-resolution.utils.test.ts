import { createAmbiguousOverlapFixture, createKnowledgeWikiFixture } from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import { resolveWikiTopicProposal } from './wiki-discovery-resolution.utils.js';

describe('resolveWikiTopicProposal', () => {
  it('returns no-op when one wiki already represents all primary ideas', () => {
    const wiki = createKnowledgeWikiFixture({
      id: 'context-management',
      source_canonical_idea_ids: ['idea-a', 'idea-b'],
    });
    const result = resolveWikiTopicProposal([wiki], {
      topicKey: 'other-key',
      title: 'Different title',
      primaryCanonicalIdeaIds: ['idea-a', 'idea-b'],
      tags: ['d:llm', 'context'],
    });
    expect(result).toMatchObject({ operation: 'no-op', existingWikiId: 'context-management' });
  });

  it('skips ambiguous multi-wiki overlaps without inventing a create topic', () => {
    const fixture = createAmbiguousOverlapFixture();
    const result = resolveWikiTopicProposal(fixture.competingWikis, {
      topicKey: 'fresh-topic',
      title: 'Context windows pressure agent memory',
      primaryCanonicalIdeaIds: ['idea-ambiguous-overlap'],
      tags: ['d:llm', 'context', 'memory'],
    });
    expect(['skipped', 'update', 'no-op']).toContain(result.operation);
    expect(result.operation).not.toBe('create');
  });

  it('does not treat domain-only overlap as sufficient for update', () => {
    const wiki = createKnowledgeWikiFixture({
      id: 'infra-page',
      topic_key: 'infra-page',
      title: 'Infra Page',
      tags: ['d:infra'],
      source_canonical_idea_ids: ['other-idea'],
    });
    const result = resolveWikiTopicProposal([wiki], {
      topicKey: 'new-isolation',
      title: 'Agent Isolation',
      primaryCanonicalIdeaIds: ['idea-isolation'],
      tags: ['d:infra', 'isolation'],
    });
    expect(result.operation).toBe('create');
  });
});
