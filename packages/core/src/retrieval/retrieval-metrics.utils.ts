/**
 * Ranking metrics for retrieval evaluation.
 *
 * All functions take a ranked list of document references (best first) and a set of references
 * judged relevant for that query. References are opaque strings — see `documentRef()` in
 * `retrieval-eval.utils.ts` for the encoding used across the `knowledge/` and `vault/` tiers.
 */

/** Fraction of relevant documents that appear in the top `k`. Answers "did we find it at all?". */
export function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1;
  const topK = new Set(retrieved.slice(0, k));
  const found = relevant.filter((ref) => topK.has(ref)).length;
  return found / relevant.length;
}

/** Fraction of the top `k` that is relevant. Answers "how much noise did we return?". */
export function precisionAtK(retrieved: string[], relevant: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  const relevantSet = new Set(relevant);
  return topK.filter((ref) => relevantSet.has(ref)).length / topK.length;
}

/**
 * Reciprocal of the rank of the first relevant hit, or 0 if none. Averaged across queries this is
 * MRR. Sensitive to the top of the list, which is what matters when only a few results become
 * model context.
 */
export function reciprocalRank(retrieved: string[], relevant: string[]): number {
  const relevantSet = new Set(relevant);
  const index = retrieved.findIndex((ref) => relevantSet.has(ref));
  return index === -1 ? 0 : 1 / (index + 1);
}

/**
 * Normalized discounted cumulative gain at `k`. Unlike recall it rewards ranking the *most*
 * relevant document highest, so it is the metric to watch when a query has several acceptable
 * answers of differing quality.
 *
 * `grades` optionally assigns a relevance weight per reference (default 1 for anything in
 * `relevant`); higher is better.
 */
export function ndcgAtK(
  retrieved: string[],
  relevant: string[],
  k: number,
  grades: Record<string, number> = {},
): number {
  const gradeFor = (ref: string): number => {
    if (grades[ref] !== undefined) return grades[ref];
    return relevant.includes(ref) ? 1 : 0;
  };

  const dcg = retrieved
    .slice(0, k)
    .reduce((total, ref, index) => total + gradeFor(ref) / Math.log2(index + 2), 0);

  const idealGrades = relevant
    .map((ref) => gradeFor(ref))
    .sort((a, b) => b - a)
    .slice(0, k);
  const idcg = idealGrades.reduce((total, grade, index) => total + grade / Math.log2(index + 2), 0);

  if (idcg === 0) return dcg === 0 ? 1 : 0;
  return dcg / idcg;
}

/** 1-indexed rank of each relevant reference, or `null` when it was not retrieved at all. */
export function relevantRanks(retrieved: string[], relevant: string[]): Record<string, number | null> {
  const ranks: Record<string, number | null> = {};
  for (const ref of relevant) {
    const index = retrieved.indexOf(ref);
    ranks[ref] = index === -1 ? null : index + 1;
  }
  return ranks;
}

/** Arithmetic mean, returning 0 for an empty list so aggregate reports stay numeric. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Rounds to 4 decimal places so recorded baselines stay stable across float noise. */
export function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
