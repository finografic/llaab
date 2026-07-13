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
    expect(
      analyzeKnowledgeWikiNovelty(wiki, [{ id: 'idea-one', body: 'Text', keyClaims: ['Text'] }]),
    ).toMatchObject({
      has_novel_evidence: false,
      novel_canonical_idea_ids: [],
      recommended_operation: 'no-op',
    });
  });

  it('classifies meaningful mechanisms and new supported claims', () => {
    expect(
      analyzeKnowledgeWikiNovelty(wiki, [
        {
          id: 'idea-two',
          body: 'Retrieval improves context because it removes irrelevant tokens.',
          keyClaims: ['Retrieval improves context because it removes irrelevant tokens.'],
        },
      ]),
    ).toMatchObject({
      has_novel_evidence: true,
      novel_canonical_idea_ids: ['idea-two'],
      mechanisms: ['Retrieval improves context because it removes irrelevant tokens.'],
      recommended_operation: 'update',
    });
  });

  it('routes contradictory evidence to explicit review with lifecycle-aware thresholds', () => {
    const growing = {
      ...wiki,
      status: 'growing' as const,
      body: '## Overview\n\nRetrieval improves context quality.',
    };
    const analysis = analyzeKnowledgeWikiNovelty(growing, [
      {
        id: 'idea-two',
        body: 'Retrieval does not improve context quality.',
        keyClaims: ['Retrieval does not improve context quality.'],
      },
    ]);

    expect(analysis.contradictions).toHaveLength(1);
    expect(analysis.recommended_operation).toBe('needs-review');
  });

  it('requires substantial diverse evidence for a mature page', () => {
    const mature = { ...wiki, status: 'mature' as const };
    const analysis = analyzeKnowledgeWikiNovelty(mature, [
      { id: 'idea-two', body: 'A small extra detail.', keyClaims: ['A small extra detail.'] },
    ]);

    expect(analysis.threshold_met).toBe(false);
    expect(analysis.recommended_operation).toBe('no-op');
  });
});
