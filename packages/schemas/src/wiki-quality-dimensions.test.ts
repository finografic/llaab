import { describe, expect, it } from 'vitest';

import { computeWikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import {
  evaluateWikiQualityDimensions,
  formatWikiEvidenceMetricsSummary,
} from './wiki-quality-dimensions.js';

describe('wiki quality dimensions', () => {
  const singleSourceMetrics = computeWikiEvidenceMetrics(
    Array.from({ length: 12 }, (_, index) => ({
      id: `ref-${index + 1}`,
      transcript_id: 'transcript-1',
      author: 'Hermes Channel',
      channel: 'Hermes Channel',
      source_id: 'source-1',
      kind: 'transcript' as const,
      canonical_idea_ids: ['idea-a'],
    })),
  );

  it('blocks promotion when coherence fails even if coverage is perfect', () => {
    const report = evaluateWikiQualityDimensions({
      issues: [
        {
          code: 'source-shaped-title',
          message: 'Wiki title appears source-shaped rather than topic-oriented.',
        },
      ],
      evidenceMetrics: singleSourceMetrics,
      pageCoverage: {
        primary_total: 2,
        represented_primary: 2,
        omitted_primary: 0,
        excluded_for_siblings: 0,
      },
      operation: 'create',
      hasValidLinks: true,
    });

    expect(report.passed).toBe(false);
    expect(report.blocking_dimensions).toContain('topic_coherence');
    const coverage = report.dimensions.find((item) => item.dimension === 'primary_evidence_coverage');
    expect(coverage?.passed).toBe(true);
    expect(coverage?.score).toBe(100);
  });

  it('does not penalize pages for ideas correctly excluded for sibling topics', () => {
    const report = evaluateWikiQualityDimensions({
      issues: [],
      evidenceMetrics: singleSourceMetrics,
      pageCoverage: {
        primary_total: 2,
        represented_primary: 2,
        omitted_primary: 0,
        excluded_for_siblings: 3,
      },
      operation: 'create',
      hasValidLinks: true,
    });

    expect(report.dimensions.find((item) => item.dimension === 'primary_evidence_coverage')?.score).toBe(100);
    expect(report.passed).toBe(true);
  });

  it('treats low source diversity as a non-blocking warning dimension', () => {
    const report = evaluateWikiQualityDimensions({
      issues: [{ code: 'single-source', message: 'Independent source corroboration is unavailable.' }],
      evidenceMetrics: singleSourceMetrics,
      pageCoverage: {
        primary_total: 1,
        represented_primary: 1,
        omitted_primary: 0,
        excluded_for_siblings: 0,
      },
      operation: 'create',
      hasValidLinks: true,
    });

    const diversity = report.dimensions.find((item) => item.dimension === 'source_diversity');
    expect(diversity?.blocking).toBe(false);
    expect(diversity?.passed).toBe(true);
    expect(diversity?.score).toBeLessThan(80);
    expect(report.blocking_dimensions).not.toContain('source_diversity');
  });

  it('formats twelve refs from one transcript without calling them twelve sources', () => {
    expect(singleSourceMetrics.evidence_ref_count).toBe(12);
    expect(singleSourceMetrics.independent_source_count).toBe(1);
    expect(formatWikiEvidenceMetricsSummary(singleSourceMetrics)).toBe(
      '12 evidence refs · 1 ideas · 1 transcripts · 1 channels · 1 independent sources',
    );
    expect(formatWikiEvidenceMetricsSummary(singleSourceMetrics)).not.toMatch(/12 sources/);
  });
});
