import type { KnowledgeWikiPage, WikiLifecycleStatus, WikiNoveltyAnalysis } from '@llaab/schemas';

export interface NoveltyCanonicalIdea {
  id: string;
  body: string;
  keyClaims: string[];
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function claimTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

function similarity(left: string, right: string): number {
  const leftTokens = claimTokens(left);
  const rightTokens = claimTokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1;
  return overlap / union.size;
}

function hasNegation(value: string): boolean {
  return /\b(?:no|not|never|without|cannot|isnt|doesnt|wont)\b/i.test(value);
}

function stripNegation(value: string): string {
  return normalize(value)
    .replace(/\b(?:no|not|never|without|cannot|isnt|doesnt|wont)\b/g, '')
    .trim();
}

function isContradiction(claim: string, existingSentences: string[]): boolean {
  return existingSentences.some(
    (sentence) =>
      hasNegation(claim) !== hasNegation(sentence) &&
      similarity(stripNegation(claim), stripNegation(sentence)) >= 0.5,
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function thresholdFor(
  lifecycle: WikiLifecycleStatus,
  meaningfulScore: number,
  independentIncomingSources: number,
  analysis: Pick<WikiNoveltyAnalysis, 'corrections' | 'contradictions' | 'obsolete_content'>,
): boolean {
  if (lifecycle === 'seed') return meaningfulScore >= 1;
  if (lifecycle === 'growing') return meaningfulScore >= 2;
  return (
    analysis.corrections.length > 0 ||
    analysis.contradictions.length > 0 ||
    analysis.obsolete_content.length > 0 ||
    (meaningfulScore >= 4 && independentIncomingSources >= 2)
  );
}

export function analyzeKnowledgeWikiNovelty(
  wiki: KnowledgeWikiPage,
  canonicalIdeas: NoveltyCanonicalIdea[],
  independentIncomingSources = 1,
): WikiNoveltyAnalysis {
  const represented = new Set(wiki.source_canonical_idea_ids);
  const novelCanonicalIdeaIds = canonicalIdeas
    .filter((idea) => !represented.has(idea.id))
    .map((idea) => idea.id);
  const representedCanonicalIdeaIds = canonicalIdeas
    .filter((idea) => represented.has(idea.id))
    .map((idea) => idea.id);
  const claims = unique(
    canonicalIdeas.flatMap((idea) => (idea.keyClaims.length > 0 ? idea.keyClaims : [idea.body])),
  );
  const normalizedBody = normalize(wiki.body);
  const existingSentences = wiki.body.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const contradictions = claims.filter((claim) => isContradiction(claim, existingSentences));
  const corrections = claims.filter((claim) =>
    /\b(?:correct|incorrect|instead|rather than|revision)\b/i.test(claim),
  );
  const distinctions = claims.filter((claim) =>
    /\b(?:unlike|whereas|distinguish|difference|separate)\b/i.test(claim),
  );
  const mechanisms = claims.filter((claim) =>
    /\b(?:because|through|mechanism|causes|enables|by using)\b/i.test(claim),
  );
  const relevantLinks = claims.filter((claim) => /https?:\/\//i.test(claim));
  const obsoleteContent = claims.filter((claim) =>
    /\b(?:obsolete|deprecated|no longer|superseded)\b/i.test(claim),
  );
  const strongerSupport = claims.filter(
    (claim) => normalizedBody.includes(normalize(claim)) && novelCanonicalIdeaIds.length > 0,
  );
  const newSupportedClaims = claims.filter(
    (claim) => !normalizedBody.includes(normalize(claim)) && !contradictions.includes(claim),
  );
  const meaningfulScore =
    newSupportedClaims.length +
    corrections.length * 2 +
    contradictions.length * 2 +
    distinctions.length +
    mechanisms.length +
    strongerSupport.length +
    relevantLinks.length +
    obsoleteContent.length * 2;
  const thresholdMet = thresholdFor(wiki.status, meaningfulScore, independentIncomingSources, {
    corrections,
    contradictions,
    obsolete_content: obsoleteContent,
  });
  const hasNovelEvidence = novelCanonicalIdeaIds.length > 0 && meaningfulScore > 0;
  const recommendedOperation =
    contradictions.length > 0
      ? ('needs-review' as const)
      : hasNovelEvidence && thresholdMet
        ? ('update' as const)
        : ('no-op' as const);
  const reason = !hasNovelEvidence
    ? 'Selected evidence adds no new supported claim or support.'
    : !thresholdMet
      ? `Novel evidence does not meet the ${wiki.status} lifecycle threshold.`
      : contradictions.length > 0
        ? 'Incoming evidence contradicts promoted content and requires review.'
        : `${novelCanonicalIdeaIds.length} canonical idea(s) add meaningful evidence.`;

  return {
    has_novel_evidence: hasNovelEvidence,
    novel_canonical_idea_ids: novelCanonicalIdeaIds,
    represented_canonical_idea_ids: representedCanonicalIdeaIds,
    new_supported_claims: newSupportedClaims,
    corrections,
    contradictions,
    distinctions,
    mechanisms,
    stronger_support: strongerSupport,
    relevant_links: relevantLinks,
    obsolete_content: obsoleteContent,
    meaningful_score: meaningfulScore,
    threshold_met: thresholdMet,
    recommended_operation: recommendedOperation,
    reason,
  };
}
