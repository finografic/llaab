import { toNodeId } from '@llaab/schemas';
import type { KnowledgeWikiPage } from '@llaab/schemas';

export type KnowledgeWikiTopicMatchKind =
  | 'exact-topic-key'
  | 'alias'
  | 'normalized-title'
  | 'canonical-idea-overlap'
  | 'fine-tag-overlap'
  | 'domain-tag-overlap';

export interface KnowledgeWikiTopicMatch {
  wiki_id: string;
  kind: KnowledgeWikiTopicMatchKind;
  reason: string;
}

export interface ResolveKnowledgeWikiTopicInput {
  topicKey: string;
  title: string;
  canonicalIdeaIds: string[];
  tags: string[];
}

export interface KnowledgeWikiTopicResolution {
  operation: 'create' | 'update' | 'needs-review';
  matches: KnowledgeWikiTopicMatch[];
}

function normalize(value: string): string {
  return toNodeId(value);
}

function matchForKind(
  kind: KnowledgeWikiTopicMatchKind,
  wikis: KnowledgeWikiPage[],
  input: ResolveKnowledgeWikiTopicInput,
): KnowledgeWikiTopicMatch[] {
  const canonicalIdeaIds = new Set(input.canonicalIdeaIds);
  const domainTags = new Set(input.tags.filter((tag) => tag.startsWith('d:')));
  const fineTags = new Set(input.tags.filter((tag) => !tag.startsWith('d:')));
  const normalizedTitle = normalize(input.title);

  return wikis.flatMap<KnowledgeWikiTopicMatch>((wiki) => {
    if (kind === 'exact-topic-key' && wiki.topic_key === input.topicKey) {
      return [{ wiki_id: wiki.id, kind, reason: `Topic key matches ${wiki.topic_key}.` }];
    }
    if (kind === 'alias' && wiki.aliases.some((alias) => normalize(alias) === normalizedTitle)) {
      return [{ wiki_id: wiki.id, kind, reason: `A recorded alias matches ${input.title}.` }];
    }
    if (kind === 'normalized-title' && normalize(wiki.title) === normalizedTitle) {
      return [{ wiki_id: wiki.id, kind, reason: `Normalized title matches ${wiki.title}.` }];
    }
    if (
      kind === 'canonical-idea-overlap' &&
      wiki.source_canonical_idea_ids.some((ideaId) => canonicalIdeaIds.has(ideaId))
    ) {
      return [{ wiki_id: wiki.id, kind, reason: 'Represents at least one selected canonical idea.' }];
    }
    if (kind === 'fine-tag-overlap') {
      const overlap = wiki.tags.filter((tag) => !tag.startsWith('d:') && fineTags.has(tag)).length;
      if (overlap >= 2) {
        return [{ wiki_id: wiki.id, kind, reason: 'Shares multiple fine content tags.' }];
      }
      return [];
    }
    if (kind === 'domain-tag-overlap' && wiki.tags.some((tag) => domainTags.has(tag))) {
      return [{ wiki_id: wiki.id, kind, reason: 'Shares a selected domain tag.' }];
    }
    return [];
  });
}

export function resolveKnowledgeWikiTopic(
  wikis: KnowledgeWikiPage[],
  input: ResolveKnowledgeWikiTopicInput,
): KnowledgeWikiTopicResolution {
  for (const kind of [
    'exact-topic-key',
    'alias',
    'normalized-title',
    'canonical-idea-overlap',
    'fine-tag-overlap',
    'domain-tag-overlap',
  ] as const) {
    const matches = matchForKind(kind, wikis, input);
    if (matches.length === 1) return { operation: 'update', matches };
    if (matches.length > 1) return { operation: 'needs-review', matches };
  }
  return { operation: 'create', matches: [] };
}
