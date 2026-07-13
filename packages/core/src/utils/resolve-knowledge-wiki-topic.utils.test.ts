import { describe, expect, it } from 'vitest';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { resolveKnowledgeWikiTopic } from './resolve-knowledge-wiki-topic.utils.js';

function page(overrides: Partial<KnowledgeWikiPage>): KnowledgeWikiPage {
  return {
    id: 'context-management',
    type: 'wiki',
    topic_key: 'context-management',
    title: 'Context Management',
    body: '## Overview\n\nText [^source-ref].',
    summary: 'Summary',
    aliases: ['Managing Context'],
    status: 'seed',
    tags: ['d:agents'],
    links: [],
    source_refs: [{ id: 'source-ref', kind: 'transcript', verification: 'source-backed' }],
    source_canonical_idea_ids: ['idea-one'],
    source_transcript_ids: ['transcript-one'],
    revision: 1,
    created_at: '2026-07-13T00:00:00Z',
    updated_at: '2026-07-13T00:00:00Z',
    reviewed_at: '2026-07-13T00:00:00Z',
    verification_status: 'source-backed',
    ...overrides,
  };
}

describe('resolveKnowledgeWikiTopic', () => {
  it('uses exact topic identity ahead of lower-confidence overlap', () => {
    const result = resolveKnowledgeWikiTopic([page({})], {
      topicKey: 'context-management',
      title: 'Other title',
      canonicalIdeaIds: [],
      tags: ['d:agents'],
    });

    expect(result.operation).toBe('update');
    expect(result.matches[0]?.kind).toBe('exact-topic-key');
  });

  it('requires review when a lower-priority signal is ambiguous', () => {
    const result = resolveKnowledgeWikiTopic(
      [page({ id: 'first', topic_key: 'first' }), page({ id: 'second', topic_key: 'second' })],
      { topicKey: 'new-topic', title: 'New topic', canonicalIdeaIds: [], tags: ['d:agents'] },
    );

    expect(result.operation).toBe('needs-review');
    expect(result.matches.map((match) => match.wiki_id)).toEqual(['first', 'second']);
  });
});
