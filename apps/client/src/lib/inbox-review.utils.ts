import type { LabNode } from '@llaab/schemas';

export const INBOX_REVIEW_TAGS = {
  new: 'inbox:new',
  reviewed: 'inbox:reviewed',
  archived: 'inbox:archived',
  promoted: 'inbox:promoted',
  failed: 'inbox:failed',
} as const;

export type InboxReviewState = keyof typeof INBOX_REVIEW_TAGS;

const REVIEW_TAG_VALUES = new Set<string>(Object.values(INBOX_REVIEW_TAGS));

export function getInboxReviewState(node: LabNode): InboxReviewState {
  const tags = node.tags ?? [];
  if (tags.includes(INBOX_REVIEW_TAGS.failed)) return 'failed';
  if (tags.includes(INBOX_REVIEW_TAGS.promoted)) return 'promoted';
  if (tags.includes(INBOX_REVIEW_TAGS.archived)) return 'archived';
  if (tags.includes(INBOX_REVIEW_TAGS.reviewed)) return 'reviewed';
  return 'new';
}

export function withInboxReviewState(tags: string[], state: InboxReviewState): string[] {
  const withoutReview = tags.filter((tag) => !REVIEW_TAG_VALUES.has(tag) && tag !== INBOX_REVIEW_TAGS.new);
  if (state === 'new') {
    return withoutReview;
  }
  return [...withoutReview, INBOX_REVIEW_TAGS[state]];
}

export function isInboxArchived(node: LabNode): boolean {
  return getInboxReviewState(node) === 'archived';
}
