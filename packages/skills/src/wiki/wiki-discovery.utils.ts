import { createHash } from 'node:crypto';
import { normalizeWikiTitleForComparison, toNodeId } from '@llaab/schemas';
import type { CanonicalIdeaNode, KnowledgeWikiPage } from '@llaab/schemas';

const STOP_WORDS = new Set([
  'about',
  'agent',
  'agents',
  'and',
  'for',
  'from',
  'hermes',
  'llaab',
  'that',
  'the',
  'this',
  'with',
  'without',
]);

const PROJECT_NOISE = new Set(['hermes', 'llaab', 'multi', 'agent', 'agents', 'system', 'systems']);

/** Strong edge score floor (used with fine-tag guards). */
const STRONG_SIMILARITY = 3.5;
/** Weak affinity: supporting role only, no primary merge. */
const SUPPORTING_SIMILARITY = 1.75;

function shouldFormStrongEdge(left: CanonicalIdeaNode, right: CanonicalIdeaNode, score: number): boolean {
  if (score < STRONG_SIMILARITY) return false;
  const leftFine = new Set(fineTags(left));
  const rightFine = new Set(fineTags(right));
  const fineOverlap = sharedCount(leftFine, rightFine);
  const domainOverlap = sharedCount(new Set(domainTags(left)), new Set(domainTags(right)));
  const titleOverlap = sharedCount(new Set(tokens(left.title)), new Set(tokens(right.title)));

  // Two+ shared fine tags: confident same topic.
  if (fineOverlap >= 2) return true;
  // One shared fine tag only merges when domains also agree (blocks cross-domain bridges).
  if (fineOverlap === 1 && domainOverlap >= 1 && (titleOverlap >= 1 || score >= 6)) return true;
  return false;
}

export interface WikiDiscoverySimilarityOptions {
  /** Optional replaceable embedding similarity in [0, 1]. Not required at runtime. */
  embeddingSimilarity?: (left: CanonicalIdeaNode, right: CanonicalIdeaNode) => number;
}

export interface WikiDiscoveryCluster {
  id: string;
  ideas: CanonicalIdeaNode[];
  primaryIdeaIds: string[];
  supportingIdeaIds: string[];
  topicKey: string;
  titleHint: string;
  domains: string[];
  tags: string[];
  coherenceScore: number;
}

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [])].filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token) && !PROJECT_NOISE.has(token),
  );
}

function fineTags(idea: CanonicalIdeaNode): string[] {
  return idea.tags.filter((tag) => !tag.startsWith('d:'));
}

function domainTags(idea: CanonicalIdeaNode): string[] {
  return idea.tags.filter((tag) => tag.startsWith('d:'));
}

function ideaFingerprint(idea: CanonicalIdeaNode): string {
  return `${idea.transcript_id}:${normalizeWikiTitleForComparison(idea.title)}`;
}

function sharedCount(left: Iterable<string>, right: Set<string>): number {
  return [...left].filter((value) => right.has(value)).length;
}

/**
 * Weighted similarity. Fine tags dominate; domains are weak compatibility signals only.
 */
export function computeCanonicalIdeaSimilarity(
  left: CanonicalIdeaNode,
  right: CanonicalIdeaNode,
  options: WikiDiscoverySimilarityOptions = {},
): number {
  if (left.id === right.id) return 0;

  const leftFine = new Set(fineTags(left));
  const rightFine = new Set(fineTags(right));
  const fineOverlap = sharedCount(leftFine, rightFine);

  const leftDomains = new Set(domainTags(left));
  const rightDomains = new Set(domainTags(right));
  const domainOverlap = sharedCount(leftDomains, rightDomains);
  const domainConflict = leftDomains.size > 0 && rightDomains.size > 0 && domainOverlap === 0 ? 1 : 0;

  const leftTitle = new Set(tokens(left.title));
  const rightTitle = new Set(tokens(right.title));
  const titleOverlap = sharedCount(leftTitle, rightTitle);

  const leftClaims = new Set(tokens([...left.key_claims, left.body].join(' ')));
  const rightClaims = new Set(tokens([...right.key_claims, right.body].join(' ')));
  const claimOverlap = sharedCount(leftClaims, rightClaims);

  let score =
    fineOverlap * 3 +
    titleOverlap * 2 +
    Math.min(claimOverlap, 4) * 1.25 +
    domainOverlap * 0.35 -
    domainConflict * 0.75;

  // Domain-only overlap without fine tags / claims must not form topics.
  if (fineOverlap === 0 && titleOverlap === 0 && claimOverlap < 2) {
    score = Math.min(score, SUPPORTING_SIMILARITY - 0.01);
  }

  const embedding = options.embeddingSimilarity?.(left, right);
  if (typeof embedding === 'number' && Number.isFinite(embedding)) {
    score += Math.max(0, Math.min(1, embedding)) * 1.5;
  }

  return score;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left: string, right: string): void {
    const rootLeft = this.find(left);
    const rootRight = this.find(right);
    if (rootLeft === rootRight) return;
    // Deterministic link by sorted root id.
    if (rootLeft < rootRight) this.parent.set(rootRight, rootLeft);
    else this.parent.set(rootLeft, rootRight);
  }
}

function deriveTopicKey(ideas: CanonicalIdeaNode[]): string {
  const fineCounts = new Map<string, number>();
  for (const idea of ideas) {
    for (const tag of fineTags(idea)) {
      fineCounts.set(tag, (fineCounts.get(tag) ?? 0) + 1);
    }
  }
  const topFine = [...fineCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([tag]) => tag);

  if (topFine.length > 0) return toNodeId(topFine.join('-'));

  const titleTerms = tokens(ideas.map((idea) => idea.title).join(' ')).sort();
  if (titleTerms[0]) return toNodeId(titleTerms.slice(0, 3).join('-'));
  return toNodeId(ideas[0]!.title);
}

function deriveTitleHint(ideas: CanonicalIdeaNode[], topicKey: string): string {
  const sorted = [...ideas].sort((left, right) => left.id.localeCompare(right.id));
  const primary = sorted[0]!;
  if (sorted.length === 1) return primary.title;
  const label = topicKey.replace(/-/g, ' ');
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function clusterCoherence(ideaIds: string[], byId: Map<string, CanonicalIdeaNode>): number {
  if (ideaIds.length <= 1) return 100;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < ideaIds.length; i += 1) {
    for (let j = i + 1; j < ideaIds.length; j += 1) {
      total += computeCanonicalIdeaSimilarity(byId.get(ideaIds[i]!)!, byId.get(ideaIds[j]!)!);
      pairs += 1;
    }
  }
  const average = total / Math.max(1, pairs);
  return Math.max(0, Math.min(100, Math.round((average / STRONG_SIMILARITY) * 100)));
}

/**
 * Order-independent similarity-graph clustering.
 * Strong edges form primary components; weaker affinities become supporting roles.
 */
export function clusterCanonicalIdeasForWikiDiscovery(
  input: CanonicalIdeaNode[],
  options: WikiDiscoverySimilarityOptions = {},
): WikiDiscoveryCluster[] {
  const uniqueByFingerprint = new Map<string, CanonicalIdeaNode>();
  for (const idea of [...input].sort((left, right) => left.id.localeCompare(right.id))) {
    const fingerprint = ideaFingerprint(idea);
    if (!uniqueByFingerprint.has(fingerprint)) uniqueByFingerprint.set(fingerprint, idea);
  }
  const uniqueIdeas = [...uniqueByFingerprint.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (uniqueIdeas.length === 0) return [];

  const byId = new Map(uniqueIdeas.map((idea) => [idea.id, idea]));
  const ids = uniqueIdeas.map((idea) => idea.id);
  const union = new UnionFind(ids);

  const edges: Array<{ left: string; right: string; score: number }> = [];
  for (let i = 0; i < uniqueIdeas.length; i += 1) {
    for (let j = i + 1; j < uniqueIdeas.length; j += 1) {
      const left = uniqueIdeas[i]!;
      const right = uniqueIdeas[j]!;
      const score = computeCanonicalIdeaSimilarity(left, right, options);
      edges.push({ left: left.id, right: right.id, score });
    }
  }

  edges
    .filter((edge) => {
      const leftIdea = byId.get(edge.left)!;
      const rightIdea = byId.get(edge.right)!;
      return shouldFormStrongEdge(leftIdea, rightIdea, edge.score);
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.left.localeCompare(right.left) ||
        left.right.localeCompare(right.right),
    )
    .forEach((edge) => union.union(edge.left, edge.right));

  const componentMap = new Map<string, string[]>();
  for (const id of ids) {
    const root = union.find(id);
    const bucket = componentMap.get(root) ?? [];
    bucket.push(id);
    componentMap.set(root, bucket);
  }

  const components = [...componentMap.values()]
    .map((memberIds) => memberIds.sort((left, right) => left.localeCompare(right)))
    .sort((left, right) => left[0]!.localeCompare(right[0]!));

  const primaryOwner = new Map<string, string>();
  const clusters: WikiDiscoveryCluster[] = components.map((memberIds, index) => {
    const clusterId = `cluster-${index + 1}-${memberIds[0]}`;
    for (const id of memberIds) primaryOwner.set(id, clusterId);
    const ideas = memberIds.map((id) => byId.get(id)!);
    const topicKey = deriveTopicKey(ideas);
    const tags = [...new Set(ideas.flatMap((idea) => idea.tags))].sort();
    const domains = tags.filter((tag) => tag.startsWith('d:'));
    return {
      id: clusterId,
      ideas,
      primaryIdeaIds: memberIds,
      supportingIdeaIds: [],
      topicKey,
      titleHint: deriveTitleHint(ideas, topicKey),
      domains,
      tags,
      coherenceScore: clusterCoherence(memberIds, byId),
    };
  });

  // Supporting roles: secondary affinity without changing primary ownership.
  for (const cluster of clusters) {
    const supporting = new Set<string>();
    for (const idea of uniqueIdeas) {
      if (primaryOwner.get(idea.id) === cluster.id) continue;
      const best = Math.max(
        ...cluster.primaryIdeaIds.map((id) => computeCanonicalIdeaSimilarity(idea, byId.get(id)!, options)),
      );
      if (best >= SUPPORTING_SIMILARITY) supporting.add(idea.id);
    }
    cluster.supportingIdeaIds = [...supporting].sort((left, right) => left.localeCompare(right));
  }

  return clusters;
}

export function buildDiscoveryContentHash(input: {
  canonicalIdeaIds: string[];
  ideas: CanonicalIdeaNode[];
  wikiSummaries: Array<{ id: string; topic_key: string; revision: number }>;
}): string {
  const ideaPayload = [...input.ideas]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      body: idea.body,
      tags: [...idea.tags].sort(),
      key_claims: [...idea.key_claims],
    }));
  const wikiPayload = [...input.wikiSummaries]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((wiki) => `${wiki.id}:${wiki.topic_key}:${wiki.revision}`);
  return createHash('sha256')
    .update(
      JSON.stringify({
        canonicalIdeaIds: [...input.canonicalIdeaIds].sort(),
        ideas: ideaPayload,
        wikis: wikiPayload,
      }),
    )
    .digest('hex');
}

export function compactWikiSummaries(wikis: KnowledgeWikiPage[]): Array<{
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  tags: string[];
  source_canonical_idea_ids: string[];
  revision: number;
}> {
  return [...wikis]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((wiki) => ({
      id: wiki.id,
      topic_key: wiki.topic_key,
      title: wiki.title,
      summary: wiki.summary.slice(0, 280),
      tags: wiki.tags,
      source_canonical_idea_ids: wiki.source_canonical_idea_ids,
      revision: wiki.revision,
    }));
}

/** Reject mechanical one-topic-per-domain or single mega-page digests. */
export function isSourceShapedOrDomainQuotaResult(input: {
  proposalCount: number;
  selectedIdeaCount: number;
  domainsUsed: string[];
  proposals: Array<{ domains: string[]; primaryCount: number; topicKey?: string }>;
}): boolean {
  if (input.selectedIdeaCount >= 6 && input.proposalCount <= 1) return true;
  const domainKeyed =
    input.domainsUsed.length >= 3 &&
    input.proposalCount === input.domainsUsed.length &&
    input.proposals.every((proposal) => {
      if (proposal.domains.length !== 1) return false;
      const domain = proposal.domains[0]!;
      return proposal.topicKey === domain.slice(2);
    });
  return domainKeyed;
}
