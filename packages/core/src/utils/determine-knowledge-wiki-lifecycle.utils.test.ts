import { describe, expect, it } from 'vitest';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { determineKnowledgeWikiLifecycle } from './determine-knowledge-wiki-lifecycle.utils.js';

function page(overrides: Partial<KnowledgeWikiPage>): KnowledgeWikiPage {
  return {
    id: 'topic',
    type: 'wiki',
    topic_key: 'topic',
    title: 'Topic',
    summary: 'Summary',
    aliases: [],
    body: '<!-- wiki-section:one -->\n\n## One\n\nText [^source-one].',
    status: 'seed',
    tags: [],
    links: [],
    source_refs: [
      { id: 'source-one', kind: 'transcript', node_id: 'transcript-one', verification: 'source-backed' },
    ],
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

describe('determineKnowledgeWikiLifecycle', () => {
  it('uses evidence coverage and independent sources rather than run frequency', () => {
    expect(determineKnowledgeWikiLifecycle(page({}))).toBe('seed');
    expect(
      determineKnowledgeWikiLifecycle(
        page({
          body: ['one', 'two']
            .map((id) => `<!-- wiki-section:${id} -->\n\n## ${id}\n\nText [^source-one].`)
            .join('\n\n'),
          source_refs: [
            {
              id: 'source-one',
              kind: 'transcript',
              node_id: 'transcript-one',
              verification: 'source-backed',
            },
            {
              id: 'source-two',
              kind: 'transcript',
              node_id: 'transcript-two',
              verification: 'source-backed',
            },
          ],
          source_canonical_idea_ids: ['idea-one', 'idea-two', 'idea-three'],
          source_transcript_ids: ['transcript-one', 'transcript-two'],
        }),
      ),
    ).toBe('growing');
  });

  it('does not mature a contested page', () => {
    expect(determineKnowledgeWikiLifecycle(page({ verification_status: 'contested' }))).toBe('seed');
  });
});
