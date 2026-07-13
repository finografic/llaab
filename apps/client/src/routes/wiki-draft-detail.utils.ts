import type { WikiDraftNode } from '@llaab/schemas';

export type WikiDraftReviewAction = 'promote' | 'reject' | 'edit' | 'regenerate' | 'resolve-topic';

export function getWikiDraftReviewActions(draft: WikiDraftNode): WikiDraftReviewAction[] {
  if (draft.draft_status !== 'proposed') return ['regenerate'];

  const actions: WikiDraftReviewAction[] = ['reject', 'regenerate'];
  if (draft.operation === 'create' || draft.operation === 'update') actions.unshift('promote');
  if (draft.operation !== 'no-op') actions.splice(actions.length - 1, 0, 'edit');
  if (draft.operation === 'needs-review' && draft.topic_matches.length > 0) actions.push('resolve-topic');
  return actions;
}

export function knowledgeWikiDetailPath(id: string): string {
  return `/knowledge/wikis/${id}`;
}

export function wikiDraftDetailPath(id: string): string {
  return `/vault/wiki-drafts/${id}`;
}
