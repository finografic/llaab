import { describe, expect, it } from 'vitest';
import type { WikiSourceRef } from './wiki.schema.js';

import { computeWikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import { determineWikiVerificationStatus } from './wiki-verification.js';

const transcriptRef = (id: string, nodeId = 'transcript-1'): WikiSourceRef => ({
  id,
  kind: 'transcript',
  node_id: nodeId,
  verification: 'source-backed',
});

describe('wiki verification semantics', () => {
  it('marks single-source non-conflicting material as source-backed', () => {
    const sourceRefs = Array.from({ length: 12 }, (_, index) => transcriptRef(`ref-${index + 1}`));
    const evidenceMetrics = computeWikiEvidenceMetrics(
      sourceRefs.map((ref) => ({
        id: ref.id,
        transcript_id: ref.node_id,
        author: 'Hermes Channel',
        channel: 'Hermes Channel',
        source_id: 'source-1',
        kind: 'transcript' as const,
      })),
    );

    expect(
      determineWikiVerificationStatus({
        sourceRefs,
        contestedClaims: [],
        contestedClaimEvidence: [],
        evidenceMetrics,
      }),
    ).toBe('source-backed');
  });

  it('requires explicit opposing evidence groups for contested', () => {
    expect(
      determineWikiVerificationStatus({
        sourceRefs: [transcriptRef('ref-1')],
        contestedClaims: ['Agents should always share memory.'],
        contestedClaimEvidence: [
          {
            claim: 'Agents should always share memory.',
            existing_source_ref_ids: [],
            incoming_source_ref_ids: ['ref-1'],
          },
        ],
        evidenceMetrics: computeWikiEvidenceMetrics([
          {
            id: 'ref-1',
            transcript_id: 'transcript-1',
            author: 'Hermes Channel',
            kind: 'transcript',
          },
        ]),
      }),
    ).toBe('source-backed');

    expect(
      determineWikiVerificationStatus({
        sourceRefs: [transcriptRef('ref-1'), transcriptRef('ref-2', 'transcript-2')],
        contestedClaims: ['Agents should always share memory.'],
        contestedClaimEvidence: [
          {
            claim: 'Agents should always share memory.',
            existing_source_ref_ids: ['ref-1'],
            incoming_source_ref_ids: ['ref-2'],
          },
        ],
      }),
    ).toBe('contested');
  });

  it('requires claim-level independent support or validated external evidence for corroborated', () => {
    expect(
      determineWikiVerificationStatus({
        sourceRefs: [
          {
            id: 'external-1',
            kind: 'external',
            url: 'https://example.com/docs',
            retrieval_query: 'agent isolation',
            retrieval_provider: 'manual',
            retrieved_at: '2026-07-19T00:00:00Z',
            excerpt: 'Authoritative guidance.',
            verification: 'corroborated',
            validation_notes: [],
          },
        ],
        evidenceMetrics: computeWikiEvidenceMetrics([
          {
            id: 'external-1',
            kind: 'external',
            url: 'https://example.com/docs',
          },
        ]),
      }),
    ).toBe('corroborated');

    // Two independent origins without material claim support stay source-backed.
    expect(
      determineWikiVerificationStatus({
        sourceRefs: [transcriptRef('ref-1'), transcriptRef('ref-2', 'transcript-2')],
        evidenceMetrics: computeWikiEvidenceMetrics([
          {
            id: 'ref-1',
            transcript_id: 'transcript-1',
            author: 'Author A',
            source_id: 'source-a',
            kind: 'transcript',
          },
          {
            id: 'ref-2',
            transcript_id: 'transcript-2',
            author: 'Author B',
            source_id: 'source-b',
            kind: 'transcript',
          },
        ]),
      }),
    ).toBe('source-backed');

    expect(
      determineWikiVerificationStatus({
        sourceRefs: [transcriptRef('ref-1'), transcriptRef('ref-2', 'transcript-2')],
        evidenceMetrics: computeWikiEvidenceMetrics([
          {
            id: 'ref-1',
            transcript_id: 'transcript-1',
            author: 'Author A',
            source_id: 'source-a',
            kind: 'transcript',
          },
          {
            id: 'ref-2',
            transcript_id: 'transcript-2',
            author: 'Author B',
            source_id: 'source-b',
            kind: 'transcript',
          },
        ]),
        materialClaims: [
          {
            claim: 'Agent isolation requires separate memory boundaries.',
            supporting_origin_ids: ['author-channel:author a', 'author-channel:author b'],
          },
        ],
      }),
    ).toBe('corroborated');
  });

  it('keeps low diversity and unresolved questions from implying contested', () => {
    expect(
      determineWikiVerificationStatus({
        sourceRefs: [transcriptRef('ref-1')],
        contestedClaims: [],
        contestedClaimEvidence: [],
        evidenceMetrics: computeWikiEvidenceMetrics([
          {
            id: 'ref-1',
            transcript_id: 'transcript-1',
            author: 'Hermes Channel',
            kind: 'transcript',
          },
        ]),
      }),
    ).toBe('source-backed');
  });
});
