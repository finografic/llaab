/**
 * Retrieval evaluation harness.
 *
 * Runs a gold query set through any retrieval function and reports ranking metrics. The retrieval
 * function is injected so the same gold set can measure the live corpus (CLI) or a frozen fixture
 * corpus (hermetic tests) without duplicating the scoring logic.
 */

import {
  mean,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  relevantRanks,
  roundMetric,
} from './retrieval-metrics.utils.js';

export type RetrievalTier = 'knowledge' | 'vault';

/** Search scope a gold query should be evaluated under, matching `chat.ask --scope`. */
export type RetrievalEvalScope = 'all' | 'knowledge' | 'vault';

export interface RetrievalGoldQuery {
  /** Stable id so a fixture can be referenced in a review comment or a regression report. */
  id: string;
  question: string;
  scope: RetrievalEvalScope;
  /** Document references that should rank. See `documentRef()`. */
  relevant: string[];
  /** Optional per-reference relevance weights for nDCG; default 1. */
  grades?: Record<string, number>;
  /** Why these documents are the right answer — the reviewable part of a fixture. */
  notes?: string;
  /** Set when a fixture records a known miss the current ranking cannot satisfy. */
  known_miss?: boolean;
}

export interface RetrievalQueryReport {
  id: string;
  question: string;
  scope: RetrievalEvalScope;
  known_miss: boolean;
  retrieved_count: number;
  recall_at_k: Record<number, number>;
  precision_at_k: Record<number, number>;
  ndcg_at_k: Record<number, number>;
  reciprocal_rank: number;
  /** 1-indexed rank per expected reference, `null` when missed entirely. */
  ranks: Record<string, number | null>;
}

export interface RetrievalEvalReport {
  generated_at: string;
  query_count: number;
  ks: number[];
  aggregate: {
    recall_at_k: Record<number, number>;
    precision_at_k: Record<number, number>;
    ndcg_at_k: Record<number, number>;
    mrr: number;
  };
  queries: RetrievalQueryReport[];
}

export interface RetrievalBaseline {
  recorded_at: string;
  corpus: { knowledge_docs: number; vault_nodes: number };
  aggregate: RetrievalEvalReport['aggregate'];
}

export interface RetrievalComparison {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  regressed: boolean;
}

export const DEFAULT_EVAL_KS = [1, 3, 5, 10];

/**
 * Retrieval under evaluation: given a question and scope, return document references best-first.
 * Implementations must not truncate below the largest `k` being measured.
 */
export type RetrievalFn = (query: RetrievalGoldQuery) => Promise<string[]> | string[];

/** Encodes a tier-qualified document reference, e.g. `knowledge:wikis/agent-harness.md`. */
export function documentRef(tier: RetrievalTier, id: string): string {
  return `${tier}:${id}`;
}

export function parseDocumentRef(ref: string): { tier: RetrievalTier; id: string } | null {
  const separator = ref.indexOf(':');
  if (separator === -1) return null;
  const tier = ref.slice(0, separator);
  if (tier !== 'knowledge' && tier !== 'vault') return null;
  return { id: ref.slice(separator + 1), tier };
}

export async function evaluateRetrieval(
  queries: RetrievalGoldQuery[],
  retrieve: RetrievalFn,
  ks: number[] = DEFAULT_EVAL_KS,
): Promise<RetrievalEvalReport> {
  const reports: RetrievalQueryReport[] = [];

  for (const query of queries) {
    const retrieved = await retrieve(query);
    reports.push({
      id: query.id,
      known_miss: query.known_miss === true,
      ndcg_at_k: metricByK(ks, (k) => ndcgAtK(retrieved, query.relevant, k, query.grades)),
      precision_at_k: metricByK(ks, (k) => precisionAtK(retrieved, query.relevant, k)),
      question: query.question,
      ranks: relevantRanks(retrieved, query.relevant),
      recall_at_k: metricByK(ks, (k) => recallAtK(retrieved, query.relevant, k)),
      reciprocal_rank: roundMetric(reciprocalRank(retrieved, query.relevant)),
      retrieved_count: retrieved.length,
      scope: query.scope,
    });
  }

  // Known misses are reported but excluded from aggregates, so a recorded failure cannot silently
  // depress the baseline and mask a real regression elsewhere.
  const scored = reports.filter((report) => !report.known_miss);

  return {
    aggregate: {
      mrr: roundMetric(mean(scored.map((report) => report.reciprocal_rank))),
      ndcg_at_k: aggregateByK(ks, scored, 'ndcg_at_k'),
      precision_at_k: aggregateByK(ks, scored, 'precision_at_k'),
      recall_at_k: aggregateByK(ks, scored, 'recall_at_k'),
    },
    generated_at: new Date().toISOString(),
    ks,
    queries: reports,
    query_count: reports.length,
  };
}

/**
 * Compares a report against a recorded baseline. `tolerance` absorbs float noise; anything worse
 * than that counts as a regression.
 */
export function compareToBaseline(
  report: RetrievalEvalReport,
  baseline: RetrievalBaseline,
  tolerance = 0.0001,
): RetrievalComparison[] {
  const comparisons: RetrievalComparison[] = [];

  const push = (metric: string, baselineValue: number | undefined, current: number): void => {
    if (baselineValue === undefined) return;
    const delta = roundMetric(current - baselineValue);
    comparisons.push({
      baseline: baselineValue,
      current,
      delta,
      metric,
      regressed: delta < -tolerance,
    });
  };

  push('mrr', baseline.aggregate.mrr, report.aggregate.mrr);
  for (const k of report.ks) {
    push(`recall@${k}`, baseline.aggregate.recall_at_k[k], report.aggregate.recall_at_k[k] ?? 0);
    push(`ndcg@${k}`, baseline.aggregate.ndcg_at_k[k], report.aggregate.ndcg_at_k[k] ?? 0);
  }

  return comparisons;
}

function metricByK(ks: number[], compute: (k: number) => number): Record<number, number> {
  const byK: Record<number, number> = {};
  for (const k of ks) byK[k] = roundMetric(compute(k));
  return byK;
}

function aggregateByK(
  ks: number[],
  reports: RetrievalQueryReport[],
  field: 'recall_at_k' | 'precision_at_k' | 'ndcg_at_k',
): Record<number, number> {
  const byK: Record<number, number> = {};
  for (const k of ks) {
    byK[k] = roundMetric(mean(reports.map((report) => report[field][k] ?? 0)));
  }
  return byK;
}
