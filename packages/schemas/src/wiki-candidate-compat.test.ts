import { describe, expect, it } from 'vitest';

import { KnowledgeWikiPageSchema } from './knowledge/wiki-page.schema.js';
import { WikiCandidateNodeSchema } from './wiki-candidate-node.schema.js';
import { computeWikiEvidenceMetrics } from './wiki-evidence-metrics.js';

describe('wiki compatibility defaults', () => {
  it('reads legacy wiki-candidate nodes without primary/supporting roles', () => {
    const candidate = WikiCandidateNodeSchema.parse({
      id: 'candidate-legacy',
      type: 'wiki-candidate',
      title: 'Legacy candidate',
      body: 'Legacy body',
      tags: ['d:agents'],
      status: 'seed',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      topic_key: 'legacy-topic',
      source_canonical_idea_ids: ['idea-a', 'idea-b'],
      source_transcript_ids: ['transcript-a'],
      heat_score: 70,
      novelty_score: 40,
      recommendation: 'create',
    });

    expect(candidate.primary_canonical_idea_ids).toEqual([]);
    expect(candidate.supporting_canonical_idea_ids).toEqual([]);
    expect(candidate.evidence_metrics).toBeUndefined();
    expect(candidate.discovery_batch_id).toBeUndefined();
  });

  it('reads legacy promoted wikis without evidence_metrics and derives unknown-safe metrics', () => {
    const page = KnowledgeWikiPageSchema.parse({
      id: 'legacy-wiki',
      type: 'wiki',
      topic_key: 'legacy-wiki',
      title: 'Legacy Wiki',
      summary: 'Legacy summary',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nBody.[^ref-1]',
      status: 'seed',
      source_refs: [
        { id: 'ref-1', kind: 'transcript', node_id: 'transcript-1', verification: 'source-backed' },
        { id: 'ref-2', kind: 'transcript', node_id: 'transcript-1', verification: 'source-backed' },
      ],
      source_canonical_idea_ids: ['idea-a'],
      source_transcript_ids: ['transcript-1'],
      revision: 1,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      verification_status: 'source-backed',
    });

    expect(page.evidence_metrics).toBeUndefined();
    const metrics = computeWikiEvidenceMetrics(
      page.source_refs.map((ref) => ({
        id: ref.id,
        transcript_id: ref.kind === 'transcript' ? ref.node_id : undefined,
        kind: ref.kind,
      })),
    );
    expect(metrics.evidence_ref_count).toBe(2);
    expect(metrics.unique_transcript_count).toBe(1);
    expect(metrics.independent_source_count).toBe(1);
    expect(metrics.unique_author_channel_count).toBe(0);
  });
});
