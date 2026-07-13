import { describe, expect, it } from 'vitest';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { analyzeKnowledgeWikiNovelty } from './analyze-knowledge-wiki-novelty.utils.js';

const wiki = {
  id: 'context-management',
  type: 'wiki',
  topic_key: 'context-management',
  title: 'Context Management',
  body: '## Overview\n\nText [^source-ref].',
  summary: 'Summary',
  aliases: [],
  status: 'seed',
  tags: [],
  links: [],
  source_refs: [{ id: 'source-ref', kind: 'transcript', verification: 'source-backed' }],
  source_canonical_idea_ids: ['idea-one'],
  source_transcript_ids: ['transcript-one'],
  revision: 1,
  created_at: '2026-07-13T00:00:00Z',
  updated_at: '2026-07-13T00:00:00Z',
  reviewed_at: '2026-07-13T00:00:00Z',
  verification_status: 'source-backed',
} satisfies KnowledgeWikiPage;

describe('analyzeKnowledgeWikiNovelty', () => {
  it('returns a deterministic no-op signal for fully represented evidence', () => {
    expect(analyzeKnowledgeWikiNovelty(wiki, ['idea-one'])).toMatchObject({
      hasNovelEvidence: false,
      novelCanonicalIdeaIds: [],
    });
  });

  it('reports only canonical ideas not already represented', () => {
    expect(analyzeKnowledgeWikiNovelty(wiki, ['idea-one', 'idea-two'])).toMatchObject({
      hasNovelEvidence: true,
      novelCanonicalIdeaIds: ['idea-two'],
      representedCanonicalIdeaIds: ['idea-one'],
    });
  });
});
