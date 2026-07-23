export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Token-overlap similarity in [0, 1] — exact match after normalizing is 1, substring match is 0.8. */
export function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  return shared / Math.max(tokensA.size, tokensB.size);
}
