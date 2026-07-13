import { WikiDraftNodeSchema } from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import {
  getWikiDraftReviewActions,
  knowledgeWikiDetailPath,
  wikiDraftDetailPath,
} from './wiki-draft-detail.utils';

function draft(overrides: Record<string, unknown> = {}) {
  return WikiDraftNodeSchema.parse({
    id: 'draft-1',
    type: 'wiki-draft',
    title: 'Draft',
    tags: [],
    related: [],
    created_at: '2026-07-13T00:00:00Z',
    status: 'seed',
    body: '',
    topic_key: 'draft',
    operation: 'create',
    draft_status: 'proposed',
    ...overrides,
  });
}

describe('wiki draft review actions', () => {
  it('allows promotion only for proposed create or update drafts', () => {
    expect(getWikiDraftReviewActions(draft())).toEqual(['promote', 'reject', 'edit', 'regenerate']);
    expect(getWikiDraftReviewActions(draft({ operation: 'update' }))).toContain('promote');
    expect(getWikiDraftReviewActions(draft({ operation: 'needs-review' }))).not.toContain('promote');
  });

  it('exposes review-safe actions for no-op, ambiguous, and terminal drafts', () => {
    expect(getWikiDraftReviewActions(draft({ operation: 'no-op' }))).toEqual(['reject', 'regenerate']);
    expect(
      getWikiDraftReviewActions(
        draft({
          operation: 'needs-review',
          topic_matches: [{ wiki_id: 'existing', kind: 'exact-topic-key', reason: 'Exact match' }],
        }),
      ),
    ).toEqual(['reject', 'edit', 'regenerate', 'resolve-topic']);
    expect(getWikiDraftReviewActions(draft({ draft_status: 'rejected' }))).toEqual(['regenerate']);
  });

  it('uses stable knowledge and vault routes after review actions', () => {
    expect(knowledgeWikiDetailPath('context-management')).toBe('/knowledge/wikis/context-management');
    expect(wikiDraftDetailPath('draft-1')).toBe('/vault/wiki-drafts/draft-1');
  });
});
