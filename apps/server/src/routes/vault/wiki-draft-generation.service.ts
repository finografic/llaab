import { readNodeByType } from '@llaab/core';
import { compileWikiDraft } from '@llaab/skills';
import type { CreateWikiDraftBody } from './vault-wiki-drafts.schema.js';
import type { CanonicalIdeaNode } from '@llaab/schemas';

interface WikiDraftIdeaGroup {
  canonicalIdeaIds: string[];
  domains: Set<string>;
  tokens: Set<string>;
}

const MIN_SHARED_TOPIC_TOKENS = 2;
const STOP_WORDS = new Set([
  'about',
  'after',
  'agent',
  'agents',
  'against',
  'also',
  'assisted',
  'because',
  'before',
  'being',
  'code',
  'coding',
  'development',
  'developer',
  'developers',
  'from',
  'generated',
  'into',
  'model',
  'models',
  'more',
  'need',
  'needs',
  'over',
  'should',
  'than',
  'that',
  'their',
  'them',
  'this',
  'through',
  'with',
]);

function normalizeTopicToken(token: string): string {
  return token
    .replace(/(?:ization|isation)$/, 'ize')
    .replace(/(?:ing|ed|es|s)$/, '')
    .trim();
}

function canonicalIdeaDomains(idea: CanonicalIdeaNode): Set<string> {
  return new Set(idea.tags.filter((tag) => tag.startsWith('d:')));
}

function canonicalIdeaTokens(idea: CanonicalIdeaNode): Set<string> {
  const text = [
    idea.title,
    idea.body,
    ...idea.key_claims,
    ...idea.tags.map((tag) => tag.replace(/^d:/, '')),
  ].join(' ');
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(normalizeTopicToken)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function sharedCount(first: Set<string>, second: Set<string>): number {
  return [...first].filter((value) => second.has(value)).length;
}

function hasOverlap(first: Set<string>, second: Set<string>): boolean {
  return [...first].some((value) => second.has(value));
}

function shouldJoinGroup(group: WikiDraftIdeaGroup, domains: Set<string>, tokens: Set<string>): boolean {
  const sharedTokens = sharedCount(group.tokens, tokens);
  if (sharedTokens >= MIN_SHARED_TOPIC_TOKENS) return true;
  return sharedTokens >= 1 && hasOverlap(group.domains, domains);
}

/**
 * Current greedy grouping heuristic (characterization baseline).
 * Phase 2 replaces this with order-independent discovery proposals.
 */
export function groupCanonicalIdeasByHeuristic(
  ideas: CanonicalIdeaNode[],
  options: { forceSingleDraft: boolean } = { forceSingleDraft: false },
): string[][] {
  if (options.forceSingleDraft || ideas.length <= 1) {
    return [ideas.map((idea) => idea.id)];
  }

  const groups: WikiDraftIdeaGroup[] = [];
  for (const idea of ideas) {
    const domains = canonicalIdeaDomains(idea);
    const tokens = canonicalIdeaTokens(idea);
    const group = groups.find((candidate) => shouldJoinGroup(candidate, domains, tokens));
    if (group) {
      group.canonicalIdeaIds.push(idea.id);
      for (const domain of domains) group.domains.add(domain);
      for (const token of tokens) group.tokens.add(token);
    } else {
      groups.push({ canonicalIdeaIds: [idea.id], domains, tokens });
    }
  }

  return groups.map((group) => group.canonicalIdeaIds);
}

export async function groupCanonicalIdeasForWikiDrafts(input: {
  canonicalIdeaIds: string[];
  forceSingleDraft: boolean;
}): Promise<string[][]> {
  if (input.forceSingleDraft || input.canonicalIdeaIds.length <= 1) return [input.canonicalIdeaIds];

  const ideas = await Promise.all(input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)));
  return groupCanonicalIdeasByHeuristic(ideas, { forceSingleDraft: input.forceSingleDraft });
}

export async function compileWikiDraftsForTranscript(input: {
  transcriptId: string;
  body: CreateWikiDraftBody;
}) {
  const forceSingleDraft =
    input.body.target_wiki_id !== undefined ||
    input.body.suggested_topic_key !== undefined ||
    input.body.suggested_title !== undefined;
  const groups = await groupCanonicalIdeasForWikiDrafts({
    canonicalIdeaIds: input.body.canonical_idea_ids,
    forceSingleDraft,
  });
  const results: Array<Awaited<ReturnType<typeof compileWikiDraft>>> = [];

  for (const canonicalIdeaIds of groups) {
    results.push(
      await compileWikiDraft({
        transcriptId: input.transcriptId,
        canonicalIdeaIds,
        suggestedTitle: groups.length === 1 ? input.body.suggested_title : undefined,
        suggestedTopicKey: groups.length === 1 ? input.body.suggested_topic_key : undefined,
        targetWikiId: groups.length === 1 ? input.body.target_wiki_id : undefined,
        entryPath: 'manual',
      }),
    );
  }

  return results;
}
