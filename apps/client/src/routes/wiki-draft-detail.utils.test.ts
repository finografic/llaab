import { WikiDraftNodeSchema } from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import {
  dedupeWarningMessages,
  getWikiDraftReviewActions,
  knowledgeWikiDetailPath,
  sourceRefInternalPath,
  vaultNodeDetailPath,
  vaultRunDetailPath,
  vaultTranscriptDetailPath,
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
    expect(vaultNodeDetailPath('canonical-1')).toBe('/vault/nodes/canonical-1');
    expect(vaultTranscriptDetailPath('ep-72')).toBe('/vault/transcripts/ep-72');
    expect(vaultRunDetailPath('run-1')).toBe('/vault/runs/run-1');
  });

  it('prefers internal node paths for non-external source refs', () => {
    expect(
      sourceRefInternalPath({
        id: 'ref-1',
        kind: 'transcript',
        node_id: 'ep-72',
        verification: 'source-backed',
        url: 'https://example.com',
      }),
    ).toBe('/vault/transcripts/ep-72');
    expect(
      sourceRefInternalPath({
        id: 'canonical-1',
        kind: 'canonical-idea',
        verification: 'source-backed',
      }),
    ).toBe('/vault/nodes/canonical-1');
    expect(
      sourceRefInternalPath({
        id: 'ext-1',
        kind: 'external',
        verification: 'source-backed',
        url: 'https://example.com',
        retrieval_query: 'q',
        retrieval_provider: 'web',
        retrieved_at: '2026-07-13T00:00:00.000Z',
        excerpt: 'excerpt',
      }),
    ).toBeNull();
  });

  it('dedupes warning blob against validation issue messages', () => {
    expect(
      dedupeWarningMessages(
        'Possible topic overlap with foo. Independent source corroboration is unavailable. Contested claims require review.',
        [
          { message: 'Independent source corroboration is unavailable.' },
          { message: 'Contested claims require review.' },
          { message: 'The draft has unresolved questions.' },
        ],
      ),
    ).toEqual([
      'Independent source corroboration is unavailable.',
      'Contested claims require review.',
      'The draft has unresolved questions.',
      'Possible topic overlap with foo.',
    ]);
  });
});
