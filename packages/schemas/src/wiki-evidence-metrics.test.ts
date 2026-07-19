import { describe, expect, it } from 'vitest';

import {
  computeWikiEvidenceMetrics,
  resolveWikiSourceOriginIdentity,
  WikiEvidenceMetricsSchema,
} from './wiki-evidence-metrics.js';

describe('wiki evidence metrics', () => {
  it('counts twelve timestamps from one transcript as one independent source', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `ref-${index + 1}`,
      transcript_id: 'hermes-transcript',
      source_id: 'hermes-channel-source',
      author: 'Hermes Channel',
      channel: 'Hermes Channel',
      canonical_idea_ids: index < 3 ? ['idea-isolation'] : ['idea-automation'],
      kind: 'transcript' as const,
    }));

    const metrics = computeWikiEvidenceMetrics(items);

    expect(metrics).toEqual(
      WikiEvidenceMetricsSchema.parse({
        evidence_ref_count: 12,
        unique_canonical_idea_count: 2,
        unique_transcript_count: 1,
        unique_source_node_count: 1,
        unique_author_channel_count: 1,
        independent_source_count: 1,
        unknown_source_identity_count: 0,
      }),
    );
  });

  it('does not treat multiple transcripts from one author as independent corroboration', () => {
    const metrics = computeWikiEvidenceMetrics([
      {
        id: 'ref-a',
        transcript_id: 'transcript-a',
        source_id: 'source-a',
        author: 'Same Author',
        kind: 'transcript',
      },
      {
        id: 'ref-b',
        transcript_id: 'transcript-b',
        source_id: 'source-b',
        author: 'Same Author',
        kind: 'transcript',
      },
    ]);

    expect(metrics.unique_transcript_count).toBe(2);
    expect(metrics.unique_source_node_count).toBe(2);
    expect(metrics.unique_author_channel_count).toBe(1);
    expect(metrics.independent_source_count).toBe(1);
  });

  it('preserves missing source identity as unknown without inventing diversity', () => {
    const metrics = computeWikiEvidenceMetrics([
      { id: 'ref-unknown-1', kind: 'transcript' },
      { id: 'ref-unknown-2', kind: 'transcript' },
    ]);

    expect(resolveWikiSourceOriginIdentity({}).kind).toBe('unknown');
    expect(metrics.independent_source_count).toBe(0);
    expect(metrics.unknown_source_identity_count).toBe(2);
  });
});
