import { toNodeId } from '@llaab/schemas';
import type { CanonicalIdeaNode } from '@llaab/schemas';

const STOP_WORDS = new Set(['about', 'and', 'for', 'from', 'that', 'the', 'this', 'with']);

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [])].filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token),
  );
}

function ideaFingerprint(idea: CanonicalIdeaNode): string {
  return `${idea.transcript_id}:${idea.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function domainTag(idea: CanonicalIdeaNode): string | undefined {
  return idea.tags.find((tag) => tag.startsWith('d:'));
}

function topicTerms(idea: CanonicalIdeaNode): Set<string> {
  return new Set(tokens([idea.title, idea.body, ...idea.key_claims].join(' ')));
}

function overlap(left: Set<string>, right: Set<string>): number {
  const shared = [...left].filter((term) => right.has(term)).length;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

export interface WikiDiscoveryCluster {
  ideas: CanonicalIdeaNode[];
  topicKey: string;
}

export function clusterCanonicalIdeasForWikiDiscovery(input: CanonicalIdeaNode[]): WikiDiscoveryCluster[] {
  const uniqueIdeas = [...new Map(input.map((idea) => [ideaFingerprint(idea), idea])).values()].sort(
    (left, right) => left.id.localeCompare(right.id),
  );
  const clusters: Array<{ domain?: string; ideas: CanonicalIdeaNode[]; terms: Set<string> }> = [];

  for (const idea of uniqueIdeas) {
    const terms = topicTerms(idea);
    const domain = domainTag(idea);
    const match = clusters.find(
      (cluster) =>
        cluster.domain === domain &&
        (overlap(cluster.terms, terms) >= 0.5 || (cluster.ideas.length > 0 && terms.size === 0)),
    );
    if (match) {
      match.ideas.push(idea);
      for (const term of terms) match.terms.add(term);
      continue;
    }
    clusters.push({ domain, ideas: [idea], terms });
  }

  return clusters.map((cluster) => {
    const topic = cluster.domain?.slice(2) ?? [...cluster.terms].sort()[0] ?? cluster.ideas[0]!.title;
    return { ideas: cluster.ideas, topicKey: toNodeId(topic) };
  });
}
