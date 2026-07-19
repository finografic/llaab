import { z } from 'zod';
import type { WikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import type { WikiOperation, WikiValidationIssue } from './wiki.schema.js';

/** Named quality dimensions for wiki compile / auto-promotion. */
export const WIKI_QUALITY_DIMENSIONS = [
  'topic_coherence',
  'primary_evidence_coverage',
  'citation_completeness',
  'source_diversity',
  'duplication_avoidance',
  'update_novelty',
  'link_validity',
] as const;

export const WikiQualityDimensionSchema = z.enum(WIKI_QUALITY_DIMENSIONS);
export type WikiQualityDimension = z.infer<typeof WikiQualityDimensionSchema>;

export const WikiQualityDimensionScoreSchema = z.object({
  dimension: WikiQualityDimensionSchema,
  score: z.number().int().min(0).max(100),
  threshold: z.number().int().min(0).max(100),
  passed: z.boolean(),
  /** When false, a low score is a warning / lifecycle input — not a promotion blocker. */
  blocking: z.boolean(),
  issues: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) })).default([]),
});

export type WikiQualityDimensionScore = z.infer<typeof WikiQualityDimensionScoreSchema>;

export const WikiPageCoverageSchema = z.object({
  primary_total: z.number().int().nonnegative(),
  represented_primary: z.number().int().nonnegative(),
  omitted_primary: z.number().int().nonnegative(),
  /** Ideas correctly excluded because sibling topics own them — not a page penalty. */
  excluded_for_siblings: z.number().int().nonnegative().default(0),
});

export type WikiPageCoverage = z.infer<typeof WikiPageCoverageSchema>;

export const WikiBatchCoverageSchema = z.object({
  total_selected: z.number().int().nonnegative(),
  represented: z.number().int().nonnegative(),
  omitted: z.number().int().nonnegative(),
});

export type WikiBatchCoverage = z.infer<typeof WikiBatchCoverageSchema>;

export const WikiQualityReportSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  dimensions: z.array(WikiQualityDimensionScoreSchema).min(1),
  blocking_dimensions: z.array(WikiQualityDimensionSchema).default([]),
  page_coverage: WikiPageCoverageSchema,
  batch_coverage: WikiBatchCoverageSchema.optional(),
});

export type WikiQualityReport = z.infer<typeof WikiQualityReportSchema>;

/** Per-dimension promotion thresholds. Coverage cannot mask poor coherence. */
export const DEFAULT_WIKI_QUALITY_DIMENSION_THRESHOLDS: Record<WikiQualityDimension, number> = {
  topic_coherence: 80,
  primary_evidence_coverage: 70,
  citation_completeness: 80,
  /** Diversity is reported and used for lifecycle — never blocks promotion alone. */
  source_diversity: 0,
  duplication_avoidance: 70,
  update_novelty: 50,
  link_validity: 80,
};

const BLOCKING_DIMENSIONS = new Set<WikiQualityDimension>([
  'topic_coherence',
  'primary_evidence_coverage',
  'citation_completeness',
  'duplication_avoidance',
  'update_novelty',
  'link_validity',
]);

const COHERENCE_ISSUE_CODES = new Set([
  'mechanical-idea-headings',
  'source-shaped-title',
  'over-fragmentation',
  'over-collapse',
  'unrelated-category-merge',
  'unexplained-domain-breadth',
]);

const CITATION_ISSUE_CODES = new Set(['missing-section-idea-roles', 'weak-citation']);
const DUPLICATION_ISSUE_CODES = new Set([
  'duplicate-topic-risk',
  'already-represented',
  'repeated-primary-claims',
]);
const LINK_ISSUE_CODES = new Set(['weak-link', 'invalid-link']);
const NOVELTY_ISSUE_CODES = new Set(['low-novelty']);

export interface EvaluateWikiQualityDimensionsInput {
  issues: WikiValidationIssue[];
  evidenceMetrics: WikiEvidenceMetrics;
  pageCoverage: WikiPageCoverage;
  batchCoverage?: WikiBatchCoverage;
  operation: WikiOperation;
  /** 0–1 fine-tag / semantic alignment among primary ideas (domain-only overlap ignored). */
  fineTagAlignment?: number;
  hasNovelEvidence?: boolean;
  hasValidLinks?: boolean;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function issuesFor(codes: Set<string>, issues: WikiValidationIssue[]): WikiValidationIssue[] {
  return issues.filter((issue) => codes.has(issue.code));
}

function scoreTopicCoherence(
  issues: WikiValidationIssue[],
  fineTagAlignment: number | undefined,
): { score: number; issues: WikiValidationIssue[] } {
  const coherenceIssues = issuesFor(COHERENCE_ISSUE_CODES, issues);
  let score = 100;
  for (const issue of coherenceIssues) {
    if (issue.code === 'mechanical-idea-headings' || issue.code === 'source-shaped-title') {
      score -= 40;
    } else if (issue.code === 'over-fragmentation' || issue.code === 'over-collapse') {
      score -= 30;
    } else {
      score -= 20;
    }
  }
  // Fine-tag/semantic alignment is positive evidence; domain-only overlap contributes nothing.
  if (fineTagAlignment != null && fineTagAlignment > 0) {
    score += Math.round(Math.min(1, fineTagAlignment) * 10);
  }
  return { score: clampScore(score), issues: coherenceIssues };
}

function scorePrimaryCoverage(pageCoverage: WikiPageCoverage): {
  score: number;
  issues: WikiValidationIssue[];
} {
  // `primary_total` is already page-scoped. Sibling exclusions are informational only —
  // they must not shrink the denominator or penalize correct topic partitioning.
  const accountable = pageCoverage.primary_total;
  if (accountable === 0) {
    return {
      score: 0,
      issues: [
        {
          code: 'empty-primary-evidence',
          message: 'Page has no primary canonical ideas to cover.',
        },
      ],
    };
  }
  const ratio = pageCoverage.represented_primary / accountable;
  const score = clampScore(ratio * 100);
  const issues: WikiValidationIssue[] = [];
  if (pageCoverage.omitted_primary > 0 && score < 100) {
    issues.push({
      code: 'omitted-primary-ideas',
      message: `${pageCoverage.omitted_primary} primary idea(s) omitted from this page.`,
    });
  }
  return { score, issues };
}

function scoreCitationCompleteness(issues: WikiValidationIssue[]): {
  score: number;
  issues: WikiValidationIssue[];
} {
  const citationIssues = issuesFor(CITATION_ISSUE_CODES, issues);
  const score = clampScore(100 - citationIssues.length * 25);
  return { score, issues: citationIssues };
}

function scoreSourceDiversity(metrics: WikiEvidenceMetrics): {
  score: number;
  issues: WikiValidationIssue[];
} {
  const independent = metrics.independent_source_count;
  let score = 100;
  if (independent <= 0) score = 0;
  else if (independent === 1) score = 40;
  else if (independent === 2) score = 75;
  else score = 100;

  const issues: WikiValidationIssue[] = [];
  if (independent < 2) {
    issues.push({
      code: 'single-source',
      message: 'Independent source corroboration is unavailable.',
    });
  }
  return { score, issues };
}

function scoreDuplicationAvoidance(issues: WikiValidationIssue[]): {
  score: number;
  issues: WikiValidationIssue[];
} {
  const duplicationIssues = issuesFor(DUPLICATION_ISSUE_CODES, issues);
  let score = 100;
  for (const issue of duplicationIssues) {
    score -= issue.code === 'already-represented' ? 5 : 25;
  }
  return { score: clampScore(score), issues: duplicationIssues };
}

function scoreUpdateNovelty(input: {
  operation: WikiOperation;
  hasNovelEvidence?: boolean;
  issues: WikiValidationIssue[];
}): { score: number; issues: WikiValidationIssue[]; blocking: boolean } {
  const noveltyIssues = issuesFor(NOVELTY_ISSUE_CODES, input.issues);
  if (input.operation === 'create' || input.operation === 'no-op' || input.operation === 'needs-review') {
    return { score: 100, issues: [], blocking: false };
  }
  if (input.hasNovelEvidence === false || noveltyIssues.length > 0) {
    return {
      score: 35,
      issues:
        noveltyIssues.length > 0
          ? noveltyIssues
          : [{ code: 'low-novelty', message: 'Update lacks novel evidence relative to the existing wiki.' }],
      blocking: true,
    };
  }
  return { score: 90, issues: [], blocking: true };
}

function scoreLinkValidity(
  issues: WikiValidationIssue[],
  hasValidLinks: boolean | undefined,
): { score: number; issues: WikiValidationIssue[] } {
  const linkIssues = issuesFor(LINK_ISSUE_CODES, issues);
  if (hasValidLinks === false) {
    return {
      score: 0,
      issues: [
        ...linkIssues,
        { code: 'invalid-link', message: 'Proposed links failed structural validation.' },
      ],
    };
  }
  return { score: clampScore(100 - linkIssues.length * 30), issues: linkIssues };
}

/**
 * Score named quality dimensions and apply per-dimension promotion thresholds.
 * High coverage cannot compensate for failed topic coherence.
 */
export function evaluateWikiQualityDimensions(input: EvaluateWikiQualityDimensionsInput): WikiQualityReport {
  const thresholds = DEFAULT_WIKI_QUALITY_DIMENSION_THRESHOLDS;
  const coherence = scoreTopicCoherence(input.issues, input.fineTagAlignment);
  const coverage = scorePrimaryCoverage(input.pageCoverage);
  const citation = scoreCitationCompleteness(input.issues);
  const diversity = scoreSourceDiversity(input.evidenceMetrics);
  const duplication = scoreDuplicationAvoidance(input.issues);
  const novelty = scoreUpdateNovelty({
    operation: input.operation,
    hasNovelEvidence: input.hasNovelEvidence,
    issues: input.issues,
  });
  const links = scoreLinkValidity(input.issues, input.hasValidLinks);

  const scored: Array<{
    dimension: WikiQualityDimension;
    score: number;
    issues: WikiValidationIssue[];
    blockingOverride?: boolean;
  }> = [
    { dimension: 'topic_coherence', score: coherence.score, issues: coherence.issues },
    { dimension: 'primary_evidence_coverage', score: coverage.score, issues: coverage.issues },
    { dimension: 'citation_completeness', score: citation.score, issues: citation.issues },
    { dimension: 'source_diversity', score: diversity.score, issues: diversity.issues },
    { dimension: 'duplication_avoidance', score: duplication.score, issues: duplication.issues },
    {
      dimension: 'update_novelty',
      score: novelty.score,
      issues: novelty.issues,
      blockingOverride: novelty.blocking,
    },
    { dimension: 'link_validity', score: links.score, issues: links.issues },
  ];

  const dimensions: WikiQualityDimensionScore[] = scored.map((item) => {
    const blocking =
      item.blockingOverride !== undefined
        ? item.blockingOverride
        : BLOCKING_DIMENSIONS.has(item.dimension) && item.dimension !== 'source_diversity';
    const threshold = thresholds[item.dimension];
    const passed = !blocking || item.score >= threshold;
    return WikiQualityDimensionScoreSchema.parse({
      dimension: item.dimension,
      score: item.score,
      threshold,
      passed,
      blocking,
      issues: item.issues,
    });
  });

  const blockingFailed = dimensions.filter((dimension) => dimension.blocking && !dimension.passed);
  const overallScore = clampScore(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length,
  );

  return WikiQualityReportSchema.parse({
    overall_score: overallScore,
    passed: blockingFailed.length === 0,
    dimensions,
    blocking_dimensions: blockingFailed.map((dimension) => dimension.dimension),
    page_coverage: WikiPageCoverageSchema.parse(input.pageCoverage),
    batch_coverage: input.batchCoverage ? WikiBatchCoverageSchema.parse(input.batchCoverage) : undefined,
  });
}

/** Format evidence metrics for UI — never conflate refs with independent sources. */
export function formatWikiEvidenceMetricsSummary(metrics: WikiEvidenceMetrics): string {
  return [
    `${metrics.evidence_ref_count} evidence refs`,
    `${metrics.unique_canonical_idea_count} ideas`,
    `${metrics.unique_transcript_count} transcripts`,
    `${metrics.unique_author_channel_count} channels`,
    `${metrics.independent_source_count} independent sources`,
  ].join(' · ');
}
