import { normalizeWikiTitleForComparison, toNodeId } from '@llaab/schemas';
import type { KnowledgeWikiPage, WikiOperation, WikiTopicMatch } from '@llaab/schemas';

export interface ResolveWikiTopicProposalInput {
  topicKey: string;
  title: string;
  primaryCanonicalIdeaIds: string[];
  tags: string[];
}

export interface ResolveWikiTopicProposalResult {
  operation: Extract<WikiOperation, 'create' | 'update' | 'no-op'> | 'skipped';
  existingWikiId?: string;
  matchReasons: WikiTopicMatch[];
  reason: string;
}

function fineTags(tags: string[]): string[] {
  return tags.filter((tag) => !tag.startsWith('d:'));
}

function normalize(value: string): string {
  return toNodeId(value);
}

function wikiFineTagOverlap(wiki: KnowledgeWikiPage, tags: string[]): number {
  const selected = new Set(fineTags(tags));
  return fineTags(wiki.tags).filter((tag) => selected.has(tag)).length;
}

/**
 * Resolve create / update / no-op for one proposal against the promoted wiki index.
 * Ambiguous multi-matches become skipped — never invent a suffixed create topic.
 * Domain-only overlap is insufficient for auto-update.
 */
export function resolveWikiTopicProposal(
  wikis: KnowledgeWikiPage[],
  input: ResolveWikiTopicProposalInput,
): ResolveWikiTopicProposalResult {
  const primaryIds = [...new Set(input.primaryCanonicalIdeaIds)];
  const normalizedTitle = normalizeWikiTitleForComparison(input.title);

  const exactKey = wikis.filter((wiki) => wiki.topic_key === input.topicKey);
  if (exactKey.length === 1) {
    const wiki = exactKey[0]!;
    const fullyRepresented = primaryIds.every((id) => wiki.source_canonical_idea_ids.includes(id));
    return {
      operation: fullyRepresented ? 'no-op' : 'update',
      existingWikiId: wiki.id,
      matchReasons: [
        {
          wiki_id: wiki.id,
          kind: 'exact-topic-key',
          reason: `Topic key matches ${wiki.topic_key}.`,
        },
      ],
      reason: fullyRepresented
        ? 'Existing wiki already represents the primary evidence.'
        : 'Exact topic key match with novel primary evidence.',
    };
  }
  if (exactKey.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: exactKey.map((wiki) => ({
        wiki_id: wiki.id,
        kind: 'exact-topic-key' as const,
        reason: `Duplicate topic key ${wiki.topic_key}.`,
      })),
      reason: 'Multiple wikis share the exact topic key.',
    };
  }

  const aliasMatches = wikis.filter((wiki) =>
    wiki.aliases.some((alias) => normalizeWikiTitleForComparison(alias) === normalizedTitle),
  );
  if (aliasMatches.length === 1) {
    return {
      operation: 'update',
      existingWikiId: aliasMatches[0]!.id,
      matchReasons: [
        {
          wiki_id: aliasMatches[0]!.id,
          kind: 'alias',
          reason: `A recorded alias matches ${input.title}.`,
        },
      ],
      reason: 'Alias match against an existing wiki.',
    };
  }
  if (aliasMatches.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: aliasMatches.map((wiki) => ({
        wiki_id: wiki.id,
        kind: 'alias' as const,
        reason: `Alias overlap with ${wiki.title}.`,
      })),
      reason: 'Ambiguous alias overlap across multiple wikis.',
    };
  }

  const titleMatches = wikis.filter(
    (wiki) => normalizeWikiTitleForComparison(wiki.title) === normalizedTitle,
  );
  if (titleMatches.length === 1) {
    return {
      operation: 'update',
      existingWikiId: titleMatches[0]!.id,
      matchReasons: [
        {
          wiki_id: titleMatches[0]!.id,
          kind: 'normalized-title',
          reason: `Normalized title matches ${titleMatches[0]!.title}.`,
        },
      ],
      reason: 'Normalized title match against an existing wiki.',
    };
  }
  if (titleMatches.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: titleMatches.map((wiki) => ({
        wiki_id: wiki.id,
        kind: 'normalized-title' as const,
        reason: `Title overlap with ${wiki.title}.`,
      })),
      reason: 'Ambiguous normalized title overlap across multiple wikis.',
    };
  }

  const fullyCovering = wikis.filter((wiki) =>
    primaryIds.every((id) => wiki.source_canonical_idea_ids.includes(id)),
  );
  if (fullyCovering.length === 1) {
    return {
      operation: 'no-op',
      existingWikiId: fullyCovering[0]!.id,
      matchReasons: [
        {
          wiki_id: fullyCovering[0]!.id,
          kind: 'canonical-idea-overlap',
          reason: 'Existing wiki already represents all primary canonical ideas.',
        },
      ],
      reason: 'Primary evidence is already fully represented.',
    };
  }
  if (fullyCovering.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: fullyCovering.map((wiki) => ({
        wiki_id: wiki.id,
        kind: 'canonical-idea-overlap' as const,
        reason: 'Fully covers primary canonical ideas.',
      })),
      reason: 'Multiple wikis fully cover the primary evidence.',
    };
  }

  const partialOverlap = wikis.filter((wiki) =>
    wiki.source_canonical_idea_ids.some((id) => primaryIds.includes(id)),
  );
  if (partialOverlap.length === 1) {
    return {
      operation: 'update',
      existingWikiId: partialOverlap[0]!.id,
      matchReasons: [
        {
          wiki_id: partialOverlap[0]!.id,
          kind: 'canonical-idea-overlap',
          reason: 'Represents at least one primary canonical idea.',
        },
      ],
      reason: 'Partial canonical-idea overlap with novel primary evidence.',
    };
  }
  if (partialOverlap.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: partialOverlap.map((wiki) => ({
        wiki_id: wiki.id,
        kind: 'canonical-idea-overlap' as const,
        reason: 'Partial primary-idea overlap.',
      })),
      reason: 'Ambiguous canonical-idea overlap across multiple wikis.',
    };
  }

  const fineTagCandidates = wikis
    .map((wiki) => ({ wiki, score: wikiFineTagOverlap(wiki, input.tags) }))
    .filter((item) => item.score >= 1)
    .sort((left, right) => right.score - left.score || left.wiki.id.localeCompare(right.wiki.id));
  if (fineTagCandidates.length > 1) {
    const best = fineTagCandidates[0]!.score;
    const tied = fineTagCandidates.filter((item) => item.score === best);
    if (tied.length > 1 || (fineTagCandidates[1] && fineTagCandidates[1].score === best)) {
      return {
        operation: 'skipped',
        matchReasons: fineTagCandidates.map((item) => ({
          wiki_id: item.wiki.id,
          kind: 'fine-tag-overlap' as const,
          reason: `Fine-tag overlap score ${item.score}.`,
        })),
        reason: 'Ambiguous fine-tag overlap across multiple wikis.',
      };
    }
  }
  if (fineTagCandidates.length >= 1 && fineTagCandidates[0]!.score >= 2) {
    const winner = fineTagCandidates[0]!;
    return {
      operation: 'update',
      existingWikiId: winner.wiki.id,
      matchReasons: [
        {
          wiki_id: winner.wiki.id,
          kind: 'fine-tag-overlap',
          reason: 'Shares multiple fine content tags with the proposal.',
        },
      ],
      reason: 'Fine-tag similarity against one existing wiki.',
    };
  }
  // Multiple wikis with single-tag overlap and no clear winner → skip.
  if (fineTagCandidates.length > 1) {
    return {
      operation: 'skipped',
      matchReasons: fineTagCandidates.map((item) => ({
        wiki_id: item.wiki.id,
        kind: 'fine-tag-overlap' as const,
        reason: `Fine-tag overlap score ${item.score}.`,
      })),
      reason: 'Ambiguous fine-tag overlap across multiple wikis.',
    };
  }

  // Domain-only overlap is intentionally insufficient for auto-update.
  return {
    operation: 'create',
    matchReasons: [],
    reason: 'No confident existing-wiki match; create a new topic.',
  };
}

export function suggestTopicKeyFromTitle(title: string): string {
  return normalize(title);
}
